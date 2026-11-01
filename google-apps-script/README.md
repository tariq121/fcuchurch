# Daily Verse — Google Sheet setup

The homepage "Daily Bread" section shows a verse chosen in a Google Sheet. Edit the sheet and
the website updates within about five minutes — no code, no deploy.

## One-time setup (about 10 minutes)

1. **Create the sheet.** Go to [sheets.google.com](https://sheets.google.com) and create a blank
   spreadsheet named **FCU Daily Verse**.
2. **Add the script.** In the sheet choose **Extensions → Apps Script**. Delete the sample code,
   paste in everything from [`Code.gs`](Code.gs), and click **Save**.
3. **Create the tabs.** In the function dropdown pick **`setupSheet`** and click **Run**.
   Google asks you to authorize the script: *Review permissions → choose your account →
   Advanced → Go to (project name) → Allow*. (It shows a warning because the script is your
   own, not a published app.) Switch back to the sheet: you now have **Week**, **Topics** and
   **Settings** tabs with starter content.
4. **Preview it.** Back in Apps Script pick **`testToday`**, click **Run**, and read the
   **Execution log** — you should see today's verse as JSON.
5. **Publish it.** Click **Deploy → New deployment → ⚙ → Web app**, then set
   **Execute as: Me** and **Who has access: Anyone**, and click **Deploy**. Copy the
   **Web app URL** (it ends in `/exec`).
6. **Connect the website.** Paste that URL into `VERSE_ENDPOINT` at the top of the
   "Daily Bread" section in [`assets/js/main.js`](../assets/js/main.js), then commit and push.

Until step 6 is done the site simply shows its built-in verses.

## Choosing verses (the everyday part)

Open the **Week** tab — one row per day:

| Day | Reference | Topic | Translation | Note (optional) |
|---|---|---|---|---|
| Sunday | Psalm 122:1 | | | |
| Monday | | strength | | |
| Friday | Philippians 4:6-7 | | web | Praying for you this week |

- **Reference** — type any verse or short passage: `John 3:16`, `Psalm 23:1-3`.
- **Topic** — leave Reference empty and type a topic (`hope`, `forgiveness`…). The site picks a
  verse for it from the **Topics** tab and rotates through them week by week.
- If both are filled in, **Reference wins**.
- **Translation** — pick from the dropdown, or leave blank to use the default on the
  **Settings** tab. Available: `kjv`, `web`, `asv`, `bbe`, `oeb-us`, `darby` (all public domain).
- **Note** — optional one-line message shown under the verse.

The **Topics** tab is a plain list of `Topic | Reference` rows. Add rows to add verses to a topic,
or add a new topic name by typing it in column A. Matching ignores capital letters.

The **Settings** tab holds the default translation and the time zone (`America/Chicago`, so
everyone sees the same verse on the same day).

## If a verse doesn't show

The website quietly falls back to its built-in verses whenever the sheet can't give a good
answer, so visitors never see an error. To see *why*, open the Web app URL in a browser
(optionally add `?day=Friday&nocache=1`) and read the `error` message. Common ones:

| Message | Fix |
|---|---|
| `Verse not found: "…"` | Check the spelling of the reference. |
| `No verses listed for topic "…"` | Add that topic to the Topics tab. |
| `"…" is too long for the verse card` | Use a shorter passage (about 1,000 characters max). |
| `… has neither a Reference nor a Topic` | Fill one of them in for that day. |
| `Unknown translation … showing KJV` | Pick the translation from the dropdown. |

## Good to know

- **Translations:** only public-domain ones. NIV, ESV, NKJV and similar are licensed and need
  an API key and a credit line; adding one is possible later.
- **Changing the script later:** after editing `Code.gs` choose **Deploy → Manage deployments →
  ✏ → New version → Deploy**. The URL stays the same.
- **Speed:** the script caches verse text and answers, and browsers remember the answer for 30
  minutes, so an edit can take a few minutes to appear.
- **Privacy:** anyone with the Web app URL can read the verse JSON. It contains nothing but
  the verses you already show publicly.
