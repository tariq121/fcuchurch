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
  var verses = [
    ["The Lord is my shepherd; I shall not want.", "Psalm 23:1"],
    ["Trust in the Lord with all your heart, and lean not on your own understanding.", "Proverbs 3:5"],
    ["I can do all things through Christ who strengthens me.", "Philippians 4:13"],
    ["For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", "Jeremiah 29:11"],
    ["Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you.", "Ephesians 4:32"],
    ["Therefore, if anyone is in Christ, the new creation has come: the old has gone, the new is here!", "2 Corinthians 5:17"],
    ["Come to me, all you who are weary and burdened, and I will give you rest.", "Matthew 11:28"],
    ["The Lord is close to the brokenhearted and saves those who are crushed in spirit.", "Psalm 34:18"],
    ["If we confess our sins, he is faithful and just and will forgive us our sins and purify us from all unrighteousness.", "1 John 1:9"],
    ["And we know that in all things God works for the good of those who love him.", "Romans 8:28"],
    ["Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", "Joshua 1:9"],
    ["See, I am doing a new thing! Now it springs up; do you not perceive it? I am making a way in the wilderness and streams in the wasteland.", "Isaiah 43:19"],
    ["Give, and it will be given to you. A good measure, pressed down, shaken together and running over.", "Luke 6:38"],
    ["Now faith is confidence in what we hope for and assurance about what we do not see.", "Hebrews 11:1"],
    ["The steadfast love of the Lord never ceases; his mercies never come to an end; they are new every morning.", "Lamentations 3:22-23"],
    ["But those who hope in the Lord will renew their strength. They will soar on wings like eagles.", "Isaiah 40:31"],
    ["As far as the east is from the west, so far has he removed our transgressions from us.", "Psalm 103:12"],
    ["Cast all your anxiety on him because he cares for you.", "1 Peter 5:7"],
    ["Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.", "Galatians 6:9"],
    ["For where two or three gather in my name, there am I with them.", "Matthew 18:20"],
    ["Bear with each other and forgive one another if any of you has a grievance against someone. Forgive as the Lord forgave you.", "Colossians 3:13"]
  ];

  var verseEl = document.querySelector("[data-daily-verse]");
  if (verseEl) {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - start) / 86400000);
    var verse = verses[dayOfYear % verses.length];
    verseEl.querySelector("[data-verse-text]").textContent = "“" + verse[0] + "”";
    verseEl.querySelector("[data-verse-ref]").textContent = verse[1];
    var dateEl = verseEl.querySelector("[data-verse-date]");
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
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
