# Forgiven Church Unusual of Round Rock

Website for Forgiven Church Unusual of Round Rock — led by Pastors Harold and Dalonika McDonald.
Services every Sunday at 6 p.m. · 3 Indian Meadows Drive, Round Rock, TX 78665.

## Structure

Plain HTML/CSS/JS — no build step or dependencies.

```
index.html     Home (hero, vision, daily verse, prayer, pastors, love gifts, gallery)
about.html     About / mission
events.html    Weekly services and prayer
404.html       Not-found page
assets/css/styles.css
assets/js/main.js   image fallbacks, daily verse, newsletter form
assets/brand/       photos + logo (see README inside for filenames)
assets/events/      Events page photos
```

## Preview locally

Links use clean URLs (`/events`, `/about`), so preview through a local server rather than
double-clicking the files:

```
powershell -ExecutionPolicy Bypass -File preview.ps1
```

Then open http://localhost:8080/ (Ctrl+C to stop).

## Deploy (GitHub Pages)

Repo **Settings → Pages → Deploy from a branch → `main` / root**. `.nojekyll` is included.
The `CNAME` file points the site at **fcu.church**. GitHub Pages serves `events.html` at `/events`
and `about.html` at `/about`, so no `.html` appears in the address bar.

## Newsletter signups

The footer form posts each email to a Google Apps Script web app that adds it to the church's
Google Sheet (the same one used on forgivenchurchunusual.com). The URL is `NEWSLETTER_ENDPOINT`
at the top of the newsletter section in `assets/js/main.js`; change it there if the script is ever
redeployed with a new address.

## Editing

The header and footer are repeated in each page — if you change a nav link, address, or
Givelify link, update it in all six `.html` files (search-and-replace works well).
