(function () {
  "use strict";

  // ---------- Image fallbacks ----------
  // If an image hasn't been added to assets/ yet, hide the broken-image icon
  // (the colored frame stays) and swap the logo for a text wordmark.
  function handleMissing(img) {
    var logo = img.closest(".logo");
    if (logo) logo.classList.add("fallback");
    else img.classList.add("missing");
  }
  document.querySelectorAll("img").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) handleMissing(img);
    else img.addEventListener("error", function () { handleMissing(img); });
  });

  // ---------- Daily Bread (verse of the day) ----------
  // The church edits each weekday's verse in a Google Sheet. The Google Apps
  // Script in google-apps-script/Code.gs turns that sheet into JSON; paste its
  // web-app URL into VERSE_ENDPOINT. While it is blank, slow, or returns an
  // error, the built-in KJV verses below are shown instead, so this section
  // always has something to display.
  var VERSE_ENDPOINT = "";
  var CHURCH_TZ = "America/Chicago";

  // Built-in backup verses (King James Version, public domain): [reference, text]
  var fallbackVerses = [
    ["Psalm 23:1", "The LORD is my shepherd; I shall not want."],
    ["Proverbs 3:5", "Trust in the LORD with all thine heart; and lean not unto thine own understanding."],
    ["Philippians 4:13", "I can do all things through Christ which strengtheneth me."],
    ["Jeremiah 29:11", "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end."],
    ["Ephesians 4:32", "And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ’s sake hath forgiven you."],
    ["2 Corinthians 5:17", "Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new."],
    ["Matthew 11:28", "Come unto me, all ye that labour and are heavy laden, and I will give you rest."],
    ["Psalm 34:18", "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit."],
    ["1 John 1:9", "If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness."],
    ["Romans 8:28", "And we know that all things work together for good to them that love God, to them who are the called according to his purpose."],
    ["Joshua 1:9", "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest."],
    ["Isaiah 43:19", "Behold, I will do a new thing; now it shall spring forth; shall ye not know it? I will even make a way in the wilderness, and rivers in the desert."],
    ["Luke 6:38", "Give, and it shall be given unto you; good measure, pressed down, and shaken together, and running over, shall men give into your bosom. For with the same measure that ye mete withal it shall be measured to you again."],
    ["Hebrews 11:1", "Now faith is the substance of things hoped for, the evidence of things not seen."],
    ["Lamentations 3:22-23", "It is of the LORD’S mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness."],
    ["Isaiah 40:31", "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."],
    ["Psalm 103:12", "As far as the east is from the west, so far hath he removed our transgressions from us."],
    ["1 Peter 5:7", "Casting all your care upon him; for he careth for you."],
    ["Galatians 6:9", "And let us not be weary in well doing: for in due season we shall reap, if we faint not."],
    ["Matthew 18:20", "For where two or three are gathered together in my name, there am I in the midst of them."],
    ["Colossians 3:13", "Forbearing one another, and forgiving one another, if any man have a quarrel against any: even as Christ forgave you, so also do ye."]
  ];

  var verseEl = document.querySelector("[data-daily-verse]");
  if (verseEl) {
    var textEl = verseEl.querySelector("[data-verse-text]");
    var refEl = verseEl.querySelector("[data-verse-ref]");
    var noteEl = verseEl.querySelector("[data-verse-note]");
    var dateEl = verseEl.querySelector("[data-verse-date]");

    var now = new Date();
    var todayKey = now.toLocaleDateString("en-CA", { timeZone: CHURCH_TZ }); // YYYY-MM-DD, church time
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: CHURCH_TZ
      });
    }

    var showVerse = function (v) {
      textEl.textContent = "“" + v.text + "”";
      refEl.textContent = v.reference + (v.translation ? " (" + v.translation + ")" : "");
      refEl.title = v.translationName || "";
      if (noteEl) {
        noteEl.textContent = v.note || "";
        noteEl.hidden = !v.note;
      }
    };

    var showFallback = function () {
      var p = todayKey.split("-");
      var day = Math.floor(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
      var f = fallbackVerses[day % fallbackVerses.length];
      showVerse({ reference: f[0], text: f[1], translation: "KJV", translationName: "King James Version" });
    };

    // Remember the sheet's answer for 30 minutes so page-to-page navigation is instant.
    var CACHE_KEY = "fcu-verse-v1";
    var CACHE_MS = 30 * 60 * 1000;
    var readCache = function () {
      try {
        var c = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (c && c.day === todayKey && Date.now() - c.at < CACHE_MS) return c.verse;
      } catch (e) { /* storage unavailable */ }
      return null;
    };
    var writeCache = function (verse) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ day: todayKey, at: Date.now(), verse: verse }));
      } catch (e) { /* storage unavailable */ }
    };

    var cached = VERSE_ENDPOINT ? readCache() : null;
    if (cached) {
      showVerse(cached);
    } else if (!VERSE_ENDPOINT || !window.fetch) {
      showFallback();
    } else {
      verseEl.classList.add("is-loading"); // hides the placeholder verse briefly to avoid a visible swap
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5000);
      fetch(VERSE_ENDPOINT, ctrl ? { signal: ctrl.signal } : {})
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          if (!data || !data.ok || !data.text || !data.reference) throw new Error((data && data.error) || "No verse");
          showVerse(data);
          writeCache(data);
        })
        .catch(function () { showFallback(); })
        .finally(function () {
          clearTimeout(timer);
          verseEl.classList.remove("is-loading");
        });
    }
  }

  // ---------- Newsletter signup ----------
  // Subscribers are added to the church's Google Sheet through a Google Apps
  // Script web app (same one used on forgivenchurchunusual.com). It expects a
  // JSON body of { "email": "..." }. Google doesn't return a readable response
  // to browsers, so "no-cors" is used and a completed request counts as success.
  var NEWSLETTER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbzOGsxUL1wV7p5kU_-I9SEvqERQh0fTfNgcWaPNeTaLhf5iclxlh4L9BNsEh_698LG0/exec";

  document.querySelectorAll("form.newsletter-form").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var status = form.querySelector(".status");
      var input = form.querySelector("input[type=email]");
      var button = form.querySelector("button[type=submit]");
      var email = input.value.trim();
      if (!email) return;

      button.disabled = true;
      if (status) status.textContent = "Signing you up…";

      fetch(form.getAttribute("data-endpoint") || NEWSLETTER_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ email: email })
      })
        .then(function () {
          form.reset();
          if (status) status.textContent = "Thank you! You’ve been added to our newsletter list.";
        })
        .catch(function () {
          if (status) status.textContent = "Something went wrong. Please try again or email members@forgivenchurchunusual.com.";
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  });

  // ---------- Footer year ----------
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
