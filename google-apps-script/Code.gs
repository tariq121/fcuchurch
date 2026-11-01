/**
 * FCU Daily Verse — Google Apps Script web app
 * ---------------------------------------------------------------------------
 * Lives inside a Google Sheet (Extensions > Apps Script). The website asks this
 * script "what is today's verse?" and gets back a small JSON packet:
 *
 *   { ok: true, reference: "Ephesians 4:32", text: "...", translation: "KJV", ... }
 *
 * Choosing today's verse (in this order):
 *   1. The Week tab row for today has a Reference  -> use that verse.
 *   2. It has only a Topic                          -> pick a verse for that topic
 *                                                      from the Topics tab (rotates weekly).
 *   3. Anything goes wrong                          -> { ok: false, error: "..." }
 *                                                      and the website shows its built-in verses.
 *
 * Verse text comes from https://bible-api.com (free, no key; public-domain
 * translations only). Results are cached so the site stays fast.
 *
 * Setup: see google-apps-script/README.md in the website repo.
 */

var TAB_WEEK = 'Week';
var TAB_TOPICS = 'Topics';
var TAB_SETTINGS = 'Settings';

var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Translations bible-api.com serves (all public domain). Keys are what you type in the sheet.
var TRANSLATIONS = {
  kjv: 'King James Version',
  web: 'World English Bible',
  asv: 'American Standard Version (1901)',
  bbe: 'Bible in Basic English',
  'oeb-us': 'Open English Bible, US Edition',
  darby: 'Darby Bible'
};

var MAX_TEXT_LENGTH = 1000;       // keeps the verse card readable; use shorter ranges if exceeded
var RESULT_CACHE_SECONDS = 300;   // sheet edits show up on the site within ~5 minutes
var TEXT_CACHE_SECONDS = 21600;   // verse wording never changes, so cache it for 6 hours

/* ============================== Web endpoint ============================== */

function doGet(e) {
  var out;
  try {
    out = getVerse_((e && e.parameter) || {});
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Run this from the editor to preview today's verse in the Execution log. */
function testToday() {
  Logger.log(JSON.stringify(getVerse_({ nocache: '1' }), null, 2));
}

/* ============================ Choosing the verse ========================== */

function getVerse_(params) {
  var settings = readSettings_();
  var tz = settings.timezone || 'America/Chicago';
  var today = todayInfo_(tz, params.day);

  var cache = CacheService.getScriptCache();
  var cacheKey = 'day|' + today.dateStr + '|' + today.dayName;
  if (!params.nocache) {
    var hit = cache.get(cacheKey);
    if (hit) return JSON.parse(hit);
  }

  var row = null;
  readRows_(TAB_WEEK).forEach(function (r) {
    if (String(r[0]).trim().toLowerCase() === today.dayName.toLowerCase()) row = r;
  });
  if (!row) throw new Error('No row for ' + today.dayName + ' on the ' + TAB_WEEK + ' tab.');

  var reference = clean_(row[1]);
  var topic = clean_(row[2]);
  var note = String(row[4] == null ? '' : row[4]).trim();

  var translation = clean_(row[3]).toLowerCase() || String(settings.defaulttranslation || '').toLowerCase() || 'kjv';
  var warning;
  if (!TRANSLATIONS[translation]) {
    warning = 'Unknown translation "' + translation + '" - showing KJV instead.';
    translation = 'kjv';
  }

  var source = 'reference';
  if (!reference) {
    if (!topic) throw new Error(today.dayName + ' has neither a Reference nor a Topic.');
    reference = pickFromTopic_(topic, today);
    source = 'topic';
  }

  var verse = fetchVerse_(reference, translation);

  var result = {
    ok: true,
    day: today.dayName,
    date: today.dateStr,
    source: source,
    topic: topic || undefined,
    reference: verse.reference,
    text: verse.text,
    translation: translation.toUpperCase(),
    translationName: verse.translationName || TRANSLATIONS[translation],
    note: note || undefined,
    warning: warning
  };
  cache.put(cacheKey, JSON.stringify(result), RESULT_CACHE_SECONDS);
  return result;
}

/** Topic -> one verse from the Topics tab. Rotates weekly, and differs between days that share a topic. */
function pickFromTopic_(topic, today) {
  var wanted = topic.toLowerCase();
  var refs = [];
  readRows_(TAB_TOPICS).forEach(function (r) {
    if (clean_(r[0]).toLowerCase() === wanted && clean_(r[1])) refs.push(clean_(r[1]));
  });
  if (!refs.length) {
    throw new Error('No verses listed for topic "' + topic + '" on the ' + TAB_TOPICS + ' tab.');
  }
  return refs[(today.weekIndex + today.dayIndex) % refs.length];
}

/** Looks up verse text, with caching, a rate-limit retry, and friendly errors. */
function fetchVerse_(reference, translation) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'txt|' + translation + '|' + reference.toLowerCase();
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  var url = 'https://bible-api.com/' + encodeURIComponent(reference) + '?translation=' + encodeURIComponent(translation);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() === 429) {      // rate limited: wait a moment and try once more
    Utilities.sleep(2000);
    res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  }
  var code = res.getResponseCode();
  if (code === 404) throw new Error('Verse not found: "' + reference + '" (check the spelling on the sheet).');
  if (code !== 200) throw new Error('Bible service returned an error (' + code + '). Try again shortly.');

  var data = JSON.parse(res.getContentText());
  var text = String(data.text || '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('No text returned for "' + reference + '".');
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error('"' + reference + '" is too long for the verse card - use a shorter passage.');
  }

  var out = {
    reference: String(data.reference || reference).replace(/^Psalms /, 'Psalm '),
    text: text,
    translationName: data.translation_name
  };
  cache.put(cacheKey, JSON.stringify(out), TEXT_CACHE_SECONDS);
  return out;
}

/* ================================ Helpers ================================= */

function readRows_(tabName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
  if (!sheet) throw new Error('Missing tab "' + tabName + '". Run setupSheet() once from the editor.');
  return sheet.getDataRange().getValues().slice(1); // drop the header row
}

function readSettings_() {
  var settings = {};
  readRows_(TAB_SETTINGS).forEach(function (r) {
    var key = String(r[0]).replace(/\s+/g, '').toLowerCase();
    if (key) settings[key] = String(r[1] == null ? '' : r[1]).trim();
  });
  return settings;
}

/** Trim, collapse spaces, and turn en/em dashes (common when pasting) into plain hyphens. */
function clean_(value) {
  return String(value == null ? '' : value)
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Today's date and weekday in the church's time zone (not the visitor's, not the server's). */
function todayInfo_(tz, dayParam) {
  var dateStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var p = dateStr.split('-');
  var epochDays = Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  var dayIndex = new Date(epochDays * 86400000).getUTCDay();   // 0 = Sunday

  if (dayParam) {                                              // ?day=Friday previews another day
    var want = String(dayParam).trim().toLowerCase();
    for (var i = 0; i < DAYS.length; i++) {
      if (DAYS[i].toLowerCase() === want) dayIndex = i;
    }
  }
  return {
    dateStr: dateStr,
    dayName: DAYS[dayIndex],
    dayIndex: dayIndex,
    weekIndex: Math.floor((epochDays + 4) / 7)                 // Sunday-based week counter
  };
}

/* =============================== One-time setup =========================== */

/**
 * Run this ONCE from the editor. It creates the Week, Topics and Settings tabs
 * with starter content and dropdowns. It never overwrites a tab that already has data.
 */
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ---- Week ----
  var week = getOrCreateTab_(ss, TAB_WEEK);
  if (week.getLastRow() === 0) {
    var weekData = [
      ['Day', 'Reference', 'Topic', 'Translation', 'Note (optional)'],
      ['Sunday', 'Psalm 122:1', '', '', ''],
      ['Monday', '', 'strength', '', ''],
      ['Tuesday', '', 'prayer', '', ''],
      ['Wednesday', '', 'hope', '', ''],
      ['Thursday', 'Romans 8:28', '', '', ''],
      ['Friday', 'Philippians 4:6-7', '', '', ''],
      ['Saturday', 'Psalm 118:24', '', '', '']
    ];
    week.getRange(1, 1, weekData.length, 5).setValues(weekData);
    styleHeader_(week, 5);
    week.setColumnWidths(1, 1, 110);
    week.setColumnWidths(2, 1, 200);
    week.setColumnWidths(3, 1, 150);
    week.setColumnWidths(4, 1, 120);
    week.setColumnWidths(5, 1, 320);
    week.getRange('D2:D8').setDataValidation(translationRule_());
    week.getRange('A10').setValue('How to use: type a Reference (e.g. John 3:16) OR a Topic (e.g. hope). Reference wins if both are filled. Leave Translation blank to use the default on the Settings tab.')
      .setFontStyle('italic').setFontColor('#666666');
  }

  // ---- Topics ----
  var topics = getOrCreateTab_(ss, TAB_TOPICS);
  if (topics.getLastRow() === 0) {
    var topicData = [['Topic', 'Reference']].concat(starterTopics_());
    topics.getRange(1, 1, topicData.length, 2).setValues(topicData);
    styleHeader_(topics, 2);
    topics.setColumnWidths(1, 1, 150);
    topics.setColumnWidths(2, 1, 200);
  }

  // ---- Settings ----
  var settings = getOrCreateTab_(ss, TAB_SETTINGS);
  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, 3, 2).setValues([
      ['Setting', 'Value'],
      ['Default translation', 'kjv'],
      ['Time zone', 'America/Chicago']
    ]);
    styleHeader_(settings, 2);
    settings.setColumnWidths(1, 1, 170);
    settings.setColumnWidths(2, 1, 200);
    settings.getRange('B2').setDataValidation(translationRule_());
    settings.getRange('A5').setValue('Translations available: ' + Object.keys(TRANSLATIONS).join(', '))
      .setFontStyle('italic').setFontColor('#666666');
  }

  // Remove the blank default tab Google creates with a new sheet
  var blank = ss.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);

  ss.setActiveSheet(week);
  SpreadsheetApp.flush();
}

function getOrCreateTab_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function styleHeader_(sheet, cols) {
  sheet.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#4a2470').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

function translationRule_() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(TRANSLATIONS), true)
    .setAllowInvalid(false)
    .setHelpText('Pick a translation: ' + Object.keys(TRANSLATIONS).join(', '))
    .build();
}

/** Starter topics (every reference verified against bible-api.com). Edit freely on the Topics tab. */
function starterTopics_() {
  var t = {
    forgiveness: ['Ephesians 4:32', 'Colossians 3:13', '1 John 1:9', 'Psalm 103:12'],
    hope: ['Jeremiah 29:11', 'Romans 15:13', 'Psalm 42:11', 'Lamentations 3:22-23'],
    healing: ['Psalm 147:3', 'Jeremiah 17:14', 'Isaiah 53:5', 'Psalm 34:18'],
    faith: ['Hebrews 11:1', 'Mark 11:24', '2 Corinthians 5:7', 'Romans 10:17'],
    provision: ['Philippians 4:19', 'Matthew 6:33', 'Psalm 23:1', 'Luke 6:38'],
    family: ['Joshua 24:15', 'Psalm 127:3', 'Proverbs 22:6', 'Acts 16:31'],
    marriage: ['Ecclesiastes 4:12', 'Ephesians 5:25', '1 Corinthians 13:4-7', 'Genesis 2:24'],
    leadership: ['Proverbs 11:14', 'Proverbs 29:18', '1 Timothy 4:12', 'Mark 10:45'],
    peace: ['John 14:27', 'Isaiah 26:3', 'Philippians 4:6-7'],
    courage: ['Joshua 1:9', 'Deuteronomy 31:6', 'Psalm 27:1', '2 Timothy 1:7'],
    gratitude: ['1 Thessalonians 5:18', 'Psalm 107:1', 'Psalm 100:4'],
    prayer: ['Philippians 4:6-7', 'Matthew 7:7', 'James 5:16', '1 Thessalonians 5:17'],
    purpose: ['Romans 8:28', 'Ephesians 2:10', 'Proverbs 19:21', 'Jeremiah 1:5'],
    restoration: ['Joel 2:25', 'Isaiah 43:19', 'Psalm 23:3', '2 Corinthians 5:17'],
    strength: ['Isaiah 40:31', 'Philippians 4:13', 'Psalm 46:1', 'Nehemiah 8:10'],
    love: ['John 3:16', '1 John 4:19', 'Romans 5:8', 'Romans 8:38-39']
  };
  var rows = [];
  Object.keys(t).forEach(function (topic) {
    t[topic].forEach(function (ref) { rows.push([topic, ref]); });
  });
  return rows;
}
