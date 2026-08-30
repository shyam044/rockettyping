/* ============================================================
   TRENDING TYPING ENGINE — Rocket Typing
   Word-grouped rendering, same structure as the main site:
     #tr-words-track (flex-wrap, gap between WORDS/rows only)
       .word (flex item, margin-right = the visual space)
         .ch  (plain inline letter spans — NOT flex items,
               so there is never a gap between letters in a word)
   A literal space character is never rendered as its own element,
   so the caret never has to measure a collapsible whitespace box
   (that was the cause of the flicker/"jump" at word boundaries).
   The caret always targets a real, always-rendered letter span.

   Each article page sets:
     window.TR_ARTICLE = { slug, title, date, texts:{easy,medium,hard} }
   where texts[difficulty] is an ARRAY OF PARAGRAPH STRINGS.
   ============================================================ */
(function () {
  "use strict";

  var ART = window.TR_ARTICLE;
  if (!ART) return;

  var state = {
    difficulty: "easy",
    paragraphs: [],
    flatWords: [],      // [{text, paraBreak}]
    wordOffsets: [],     // char offset (in state.text) of each word's first letter
    wordLetterEls: [],   // wordLetterEls[i] = [span, span, ...] for flatWords[i]
    wordEls: [],          // wordEls[i] = the .word div
    text: "",             // flattened target text (words joined by single spaces) — used for correctness/stats only, never rendered as-is
    typed: "",
    startTime: null,
    endTime: null,
    samples: [],           // {t, wpm} — cumulative-average net WPM, once per second, feeds the results chart
    rawWpmSamples: [],     // instantaneous raw WPM per ~1s interval (delta-based) — feeds the consistency score only
    lastSampleKeystrokes: 0,
    sampleTimer: null,
    correctChars: 0,        // chars matching the target in the CURRENT box contents — used for net WPM
    incorrectChars: 0,      // chars mismatching in the CURRENT box contents
    correctKeystrokes: 0,   // every forward keystroke that was correct AT THE TIME it was typed — cumulative, never decreases, immune to backspace/retype double-counting — used for accuracy
    incorrectKeystrokes: 0, // same, for incorrect keystrokes
    totalKeystrokes: 0,      // correctKeystrokes + incorrectKeystrokes — used for raw WPM
    finished: false
  };

  var idleTimer = null;

  /* ---------------- DOM refs ---------------- */
  var el = {};
  function cacheEls() {
    el.startBtn = document.getElementById("tr-start-btn");
    el.words = document.getElementById("tr-words");
    el.track = document.getElementById("tr-words-track");
    el.caret = document.getElementById("tr-caret");
    el.input = document.getElementById("tr-hidden-input");
    el.liveWpm = document.getElementById("tr-live-wpm-num");
    el.liveWords = document.getElementById("tr-live-words-num");
    el.diffBtns = Array.prototype.slice.call(document.querySelectorAll(".tr-diff-btn"));
    el.hint = document.getElementById("tr-focus-hint");
    el.result = document.getElementById("tr-result");
    el.statWpm = document.getElementById("tr-stat-wpm");
    el.statRaw = document.getElementById("tr-stat-raw");
    el.statAcc = document.getElementById("tr-stat-acc");
    el.statCons = document.getElementById("tr-stat-cons");
    el.statErr = document.getElementById("tr-stat-err");
    el.chart = document.getElementById("tr-chart");
    el.retakeBtn = document.getElementById("tr-retake-btn");
    el.shareBtn = document.getElementById("tr-share-btn");
    el.streak = document.getElementById("tr-streak");
    el.photoToggle = document.getElementById("tr-photo-toggle-input");
    el.readArticleBtn = document.getElementById("tr-read-article-btn");
  }

  var photosEnabled = false; // OFF by default, as requested

  /* ---------------- tween helper (stop-and-retarget, same as app-core.js) ---------------- */
  function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  function makeTween() { return { current: 0, from: 0, to: 0, start: 0, duration: 0, raf: null }; }
  function tween(state_, to, duration, apply) {
    var from = state_.current;
    if (Math.abs(to - from) < 0.5) {
      state_.current = to; state_.from = to; state_.to = to;
      apply(to);
      if (state_.raf) { cancelAnimationFrame(state_.raf); state_.raf = null; }
      return;
    }
    state_.from = from; state_.to = to; state_.start = performance.now(); state_.duration = duration;
    if (state_.raf) return;
    function step(t) {
      var elapsed = t - state_.start;
      var p = Math.min(1, state_.duration > 0 ? elapsed / state_.duration : 1);
      var eased = easeInOutSine(p);
      state_.current = state_.from + (state_.to - state_.from) * eased;
      apply(state_.current);
      if (p < 1 && Math.abs(state_.to - state_.current) >= 0.5) {
        state_.raf = requestAnimationFrame(step);
      } else {
        state_.current = state_.to;
        apply(state_.current);
        state_.raf = null;
      }
    }
    state_.raf = requestAnimationFrame(step);
  }
  var vScrollTween = makeTween();

  /* ---------------- row height / viewport ---------------- */
  function rowHeight() {
    var cs = getComputedStyle(el.track);
    var lh = parseFloat(cs.lineHeight);
    var gap = parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0;
    return (!isNaN(lh) && lh > 0) ? (lh + gap) : 40;
  }
function sizeWordsBox() {
  if (!el.words) return;

  // Let CSS control the visible height.
  // The complete article remains inside #tr-words and can be scrolled.
  el.words.style.height = "";
}


  /* ---------------- word model ---------------- */
  function buildWordModel() {
    var flatWords = [];
    state.paragraphs.forEach(function (p, pIdx) {
      var ws = p.split(/\s+/).filter(Boolean);
      ws.forEach(function (w, wi) {
        flatWords.push({ text: w, paraBreak: wi === 0 && pIdx > 0 });
      });
    });
    return flatWords;
  }
  function computeWordOffsets(flatWords) {
    var offsets = [];
    var pos = 0;
    flatWords.forEach(function (w) {
      offsets.push(pos);
      pos += w.text.length + 1; // +1 for the (never-rendered) separator space
    });
    return offsets;
  }

  /* ---------------- inline photos (typing-view photo toggle) ---------------- */
  function buildInlinePhotoNode(im) {
    var wrap = document.createElement("div");
    wrap.className = "tr-inline-photo";
    var figure = document.createElement("figure");
    var img = document.createElement("img");
    img.className = "tr-lightbox-img";
    img.src = im.src;
    img.alt = im.alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    if (im.width) img.width = im.width;
    if (im.height) img.height = im.height;
    figure.appendChild(img);
    if (im.caption) {
      var cap = document.createElement("figcaption");
      cap.textContent = im.caption;
      figure.appendChild(cap);
    }
    wrap.appendChild(figure);
    return wrap;
  }

  /* ---------------- render ---------------- */
  function renderWords() {
    state.flatWords = buildWordModel();
    state.wordOffsets = computeWordOffsets(state.flatWords);
    state.text = state.flatWords.map(function (w) { return w.text; }).join(" ");

    el.track.innerHTML = "";
    state.wordLetterEls = [];
    state.wordEls = [];
    var frag = document.createDocumentFragment();

    var images = (ART.images && ART.images[state.difficulty]) || [];
    function insertImagesAfter(paraIdx) {
      images.filter(function (im) { return im.after === paraIdx; })
        .forEach(function (im) { frag.appendChild(buildInlinePhotoNode(im)); });
    }

    insertImagesAfter(-1); // hero image — same position as the article view, before paragraph 0

    var currentParaIdx = 0;
    state.flatWords.forEach(function (w) {
      if (w.paraBreak) {
        insertImagesAfter(currentParaIdx); // this paragraph just finished
        currentParaIdx++;
        var spacer = document.createElement("div");
        spacer.className = "tr-para-break";
        frag.appendChild(spacer);
      }
      var wordDiv = document.createElement("div");
      wordDiv.className = "word";
      var letters = [];
      for (var i = 0; i < w.text.length; i++) {
        var span = document.createElement("span");
        span.className = "ch";
        span.textContent = w.text[i];
        wordDiv.appendChild(span);
        letters.push(span);
      }
      frag.appendChild(wordDiv);
      state.wordLetterEls.push(letters);
      state.wordEls.push(wordDiv);
    });
    insertImagesAfter(currentParaIdx); // images anchored to the very last paragraph

    el.track.appendChild(frag);
    if (el.words) el.words.classList.toggle("tr-photos-on", photosEnabled);

    // uniform, JS-measured row height applied to every paragraph spacer —
    // keeps the scroll-row math exact for the WHOLE document, not just
    // near the first paragraph, since every "row slot" is identical.
    // (Inline photo blocks deliberately use a different class so this
    // loop never touches them — they keep their natural image height.)
    var rowH = rowHeight();
    var spacers = el.track.querySelectorAll(".tr-para-break");
    for (var s = 0; s < spacers.length; s++) spacers[s].style.height = rowH + "px";

    el.words.scrollTop = 0;
    vScrollTween.current = 0;
    updateColorsAndCaret();
  }

  function updateColorsAndCaret() {
    var typedLen = state.typed.length;

    var caretWordIdx = -1, caretLetterIdx = -1, caretAfter = false;

    for (var i = 0; i < state.flatWords.length; i++) {
      var wordStart = state.wordOffsets[i];
      var wordLen = state.flatWords[i].text.length;
      var wordEnd = wordStart + wordLen;
      var letters = state.wordLetterEls[i];

      for (var li = 0; li < wordLen; li++) {
        var g = wordStart + li;
        var span = letters[li];
        var want = g < typedLen ? (state.typed[g] === state.text[g] ? "ch correct" : "ch incorrect") : "ch";
        if (span.className !== want) span.className = want;
      }

      var isActive = typedLen >= wordStart && typedLen <= wordEnd;
      var wordEl = state.wordEls[i];
      if (isActive !== wordEl.classList.contains("active")) wordEl.classList.toggle("active", isActive);

      if (typedLen < wordEnd) {
        if (caretWordIdx === -1) { caretWordIdx = i; caretLetterIdx = typedLen - wordStart; caretAfter = false; }
      } else if (typedLen === wordEnd) {
        caretWordIdx = i; caretLetterIdx = wordLen - 1; caretAfter = true; // may be overridden by next word below
      }
    }

    if (caretWordIdx === -1 && state.flatWords.length) {
      // typing fully finished — caret parked after the very last letter
      var lastI = state.flatWords.length - 1;
      caretWordIdx = lastI;
      caretLetterIdx = state.flatWords[lastI].text.length - 1;
      caretAfter = true;
    }

    // live "words left" countdown — words before the caret's current word
    // are done, so remaining = total words minus that index (0 once the
    // whole text has been typed).
    if (el.liveWords) {
      var totalWords = state.flatWords.length;
      var remaining = (typedLen >= state.text.length)
        ? 0
        : Math.max(0, totalWords - (caretWordIdx === -1 ? totalWords : caretWordIdx));
      el.liveWords.textContent = String(remaining);
    }

    positionCaret(caretWordIdx, caretLetterIdx, caretAfter);
  }

  /* ---------------- caret: rAF-batched, exactly like app-core.js ---------------- */
  var pendingCaret = null;
  var caretRAFRunning = false;
  function positionCaret(wordIdx, letterIdx, after) {
    pendingCaret = { wordIdx: wordIdx, letterIdx: letterIdx, after: after };
    if (!caretRAFRunning) {
      caretRAFRunning = true;
      requestAnimationFrame(caretLoop);
    }
  }
  function caretLoop() {
    if (pendingCaret) {
      var c = pendingCaret;
      pendingCaret = null;
      applyCaret(c.wordIdx, c.letterIdx, c.after);
    }
    caretRAFRunning = !!pendingCaret;
    if (caretRAFRunning) requestAnimationFrame(caretLoop);
  }

  function applyCaret(wordIdx, letterIdx, after) {
    if (!el.caret || wordIdx === -1) return;
    var letters = state.wordLetterEls[wordIdx];
    if (!letters || !letters.length) return;
    var target = letters[letterIdx];
    if (!target) return;

    var x = target.offsetLeft + (after ? target.offsetWidth : 0);
    var y = target.offsetTop;
    var h = target.offsetHeight;

    var rowH = rowHeight();
    var currentScrollTop = el.words.scrollTop;
    var visibleRowIdx = Math.round((y - currentScrollTop) / rowH);
    if (visibleRowIdx >= 1) { // 2-row window: scroll up the moment the caret enters the 2nd visible row
      var scrollTarget = Math.max(0, y - rowH);
      if (!vScrollTween.raf || Math.abs(scrollTarget - vScrollTween.to) >= 0.5) {
        vScrollTween.current = currentScrollTop;
        tween(vScrollTween, scrollTarget, 125, function (v) { el.words.scrollTop = v; });
      }
    }

    el.caret.style.height = h + "px";
    el.caret.style.transform = "translate3d(" + x + "px, " + y + "px, 0)";
  }

  /* ---------------- stats ----------------
     WPM (net):    correctChars in the box right now / 5 / minutes elapsed.
                    "chars/5" is the standard word-length convention used by
                    every major typing test (MonkeyType, 10FastFingers, etc).
     Raw WPM:      totalKeystrokes (every forward keystroke, right or wrong)
                    / 5 / minutes — measures gross typing speed regardless
                    of accuracy.
     Accuracy:     correctKeystrokes / totalKeystrokes, where both counters
                    are CUMULATIVE and only ever increase (tracked the
                    instant each character is typed, in onInput below) —
                    never recomputed from the final box contents. That
                    distinction matters: if you mistype a correct character
                    and retype it, a final-state comparison would silently
                    forgive that keystroke, inflating accuracy. Tracking it
                    the moment it happens is how MonkeyType/10FastFingers
                    do it, and it's the only version that can't be gamed by
                    backspacing.
     Consistency:  100 × (1 − coefficient of variation) of raw WPM sampled
                    once per second, clamped to 0–100. This is the same
                    "how steady was your pace" metric MonkeyType shows —
                    it uses RAW per-second speed (not the smoothed
                    cumulative average) because a metric that's already
                    averaged over the whole test barely fluctuates and
                    would always score close to 100 regardless of how
                    bursty the actual typing was.
     ---------------- */
  function elapsedMinutes() {
    var end = state.endTime || Date.now();
    return Math.max((end - state.startTime) / 60000, 1 / 60000);
  }
  function currentWpm() { return Math.round((state.correctChars / 5) / elapsedMinutes()); }
  function currentRawWpm() { return Math.round((state.totalKeystrokes / 5) / elapsedMinutes()); }
  function currentAccuracy() {
    var total = state.correctKeystrokes + state.incorrectKeystrokes;
    if (total === 0) return 100;
    return Math.max(0, Math.round((state.correctKeystrokes / total) * 100));
  }
  function currentConsistency() {
    var samples = state.rawWpmSamples;
    if (!samples || samples.length < 2) return 100; // not enough data to measure burstiness yet
    var n = samples.length;
    var mean = 0;
    for (var i = 0; i < n; i++) mean += samples[i];
    mean /= n;
    if (mean <= 0) return 100;
    var variance = 0;
    for (var j = 0; j < n; j++) variance += Math.pow(samples[j] - mean, 2);
    variance /= n;
    var stdDev = Math.sqrt(variance);
    var cv = stdDev / mean; // coefficient of variation — 0 = perfectly steady pace
    return Math.round(Math.max(0, Math.min(100, (1 - cv) * 100)));
  }

  function startSampling() {
    state.samples = [{ t: 0, wpm: 0 }];
    state.rawWpmSamples = [];
    state.lastSampleKeystrokes = 0;
    state.sampleTimer = setInterval(function () {
      if (!state.startTime || state.finished) return;
      var t = Math.round((Date.now() - state.startTime) / 1000);
      state.samples.push({ t: t, wpm: currentWpm() });
      if (el.liveWpm) el.liveWpm.textContent = String(currentWpm());

      // Raw WPM for THIS ~1-second interval only (delta keystrokes since
      // the last tick) — used solely for the consistency score. Kept
      // separate from the smoothed cumulative-average samples above so
      // consistency reflects real burstiness instead of the graph line.
      var deltaKeys = state.totalKeystrokes - state.lastSampleKeystrokes;
      state.lastSampleKeystrokes = state.totalKeystrokes;
      state.rawWpmSamples.push((deltaKeys / 5) * 60);
    }, 1000);
  }
  function stopSampling() {
    if (state.sampleTimer) clearInterval(state.sampleTimer);
    state.sampleTimer = null;
  }

  /* ---------------- input handling ---------------- */
  function onInput(e) {
    if (state.finished) return;
    var val = e.target.value;
    if (val.length > state.text.length) val = val.slice(0, state.text.length);

    if (!state.startTime && val.length > 0) {
      state.startTime = Date.now();
      startSampling();
    }

    if (val.length > 0) {
      document.body.classList.add("tr-typing-active");
      document.body.classList.add("tr-hide-chrome"); // focus mode — cleared by pointer movement or a pause
      if (el.caret) el.caret.classList.remove("blink");
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () { if (el.caret) el.caret.classList.add("blink"); }, 600);
    }

    // Cumulative, per-keystroke correctness — counted the instant each
    // NEW forward character lands (handles multi-char paste too, one
    // keystroke per pasted character), never recomputed from the final
    // string. This is what accuracy and raw WPM are built on.
    if (val.length > state.typed.length) {
      for (var j = state.typed.length; j < val.length; j++) {
        state.totalKeystrokes++;
        if (val[j] === state.text[j]) state.correctKeystrokes++;
        else state.incorrectKeystrokes++;
      }
    }

    var correct = 0, incorrect = 0;
    for (var i = 0; i < val.length; i++) {
      if (val[i] === state.text[i]) correct++; else incorrect++;
    }
    state.typed = val;
    state.correctChars = correct;
    state.incorrectChars = incorrect;

    updateColorsAndCaret();

    if (val.length >= state.text.length) finishTest();
  }

  function finishTest() {
    state.finished = true;
    state.endTime = Date.now();
    stopSampling();
    clearTimeout(idleTimer);
    if (el.caret) el.caret.classList.add("blink");
    document.body.classList.remove("tr-typing-active");
    document.body.classList.remove("tr-hide-chrome");
    state.samples.push({ t: Math.round((state.endTime - state.startTime) / 1000), wpm: currentWpm() });
    renderResults();
    document.body.classList.add("tr-done");
    saveScore();
    bumpStreak();
  }

  /* ---------------- results ---------------- */
  function renderResults() {
    var wpm = currentWpm(), raw = currentRawWpm(), acc = currentAccuracy(), cons = currentConsistency();
    if (el.statWpm) el.statWpm.textContent = String(wpm);
    if (el.statRaw) el.statRaw.textContent = String(raw);
    if (el.statAcc) el.statAcc.textContent = acc + "%";
    if (el.statCons) el.statCons.textContent = cons + "%";
    // Total mistakes made during the test (including ones later fixed by
    // backspacing) — cumulative, matching the same counters accuracy uses,
    // rather than only what's left uncorrected in the final box contents.
    if (el.statErr) el.statErr.textContent = String(state.incorrectKeystrokes);
    drawChart();
  }

  function drawChart() {
    if (!el.chart) return;
    var ctx = el.chart.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var w = el.chart.clientWidth, h = el.chart.clientHeight;
    el.chart.width = w * dpr; el.chart.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var pts = state.samples;
    if (pts.length < 2) return;
    var maxWpm = Math.max.apply(null, pts.map(function (p) { return p.wpm; }).concat([10]));
    var maxT = pts[pts.length - 1].t || 1;

    ctx.beginPath();
    pts.forEach(function (p, i) {
      var x = (p.t / maxT) * (w - 10) + 5;
      var y = h - 10 - (p.wpm / maxWpm) * (h - 20);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(w - 5, h - 10);
    ctx.lineTo(5, h - 10);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,215,0,0.08)";
    ctx.fill();
  }

  /* ---------------- streak + saved scores ---------------- */
  function saveScore() {
    try {
      var key = "rt_trend_score_" + ART.slug + "_" + state.difficulty;
      var wpm = currentWpm();
      var prevBest = parseInt(localStorage.getItem(key) || "0", 10);
      if (wpm > prevBest) localStorage.setItem(key, String(wpm));
    } catch (e) {}
  }

  function bumpStreak() {
    if (!el.streak) return;
    try {
      var today = new Date().toISOString().slice(0, 10);
      var last = localStorage.getItem("rt_trend_last_day");
      var streak = parseInt(localStorage.getItem("rt_trend_streak") || "0", 10);
      if (last !== today) {
        var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        streak = (last === yesterday) ? streak + 1 : 1;
        localStorage.setItem("rt_trend_streak", String(streak));
        localStorage.setItem("rt_trend_last_day", today);
      }
      el.streak.innerHTML = "";
      var b = document.createElement("b");
      b.textContent = "\uD83D\uDD25 " + streak + " day" + (streak === 1 ? "" : "s");
      el.streak.appendChild(document.createTextNode("Trending streak: "));
      el.streak.appendChild(b);
      el.streak.appendChild(document.createTextNode(" — come back tomorrow for a new article!"));
    } catch (e) {}
  }

  /* ---------------- flow control ---------------- */
  function loadDifficulty(diff) {
    state.difficulty = diff;
    state.paragraphs = (ART.texts[diff] || ART.texts.easy || []).map(function (p) {
      return p.replace(/\s+/g, " ").trim();
    }).filter(Boolean);
    state.typed = "";
    state.startTime = null;
    state.endTime = null;
    state.correctChars = 0;
    state.incorrectChars = 0;
    state.correctKeystrokes = 0;
    state.incorrectKeystrokes = 0;
    state.totalKeystrokes = 0;
    state.finished = false;
    state.samples = [];
    state.rawWpmSamples = [];
    state.lastSampleKeystrokes = 0;
    stopSampling();
    clearTimeout(idleTimer);
    document.body.classList.remove("tr-typing-active");
    document.body.classList.remove("tr-hide-chrome");
    if (el.input) el.input.value = "";
    if (el.liveWpm) el.liveWpm.textContent = "0";
    document.body.classList.remove("tr-done");
    el.diffBtns.forEach(function (b) { b.classList.toggle("active", b.dataset.diff === diff); });
    sizeWordsBox();
    renderWords();
    if (el.caret) el.caret.classList.add("blink");
    focusInput();
  }

  function focusInput() {
    if (el.input) {
      el.input.value = "";
      el.input.focus({ preventScroll: true });
    }
  }

  var resizeRAF = null;
  function onResize() {
    if (resizeRAF) return;
    resizeRAF = requestAnimationFrame(function () {
      resizeRAF = null;
      sizeWordsBox();
      // full re-render so paragraph-spacer heights + wrap positions stay
      // exact at the new width — current typed progress is preserved.
      renderWords();
    });
  }

  var originalDocTitle = null;

  function wireEvents() {
    if (el.startBtn) {
      el.startBtn.addEventListener("click", function () {
        originalDocTitle = document.title;
        document.body.classList.add("tr-typing");
        loadDifficulty("easy");
        try { document.title = "Typing: " + ART.title + " | Rocket Typing"; } catch (e) {}
      });
    }
    if (el.readArticleBtn) {
      el.readArticleBtn.addEventListener("click", function () {
        stopSampling();
        clearTimeout(idleTimer);
        document.body.classList.remove("tr-typing-active");
        document.body.classList.remove("tr-hide-chrome");
        document.body.classList.remove("tr-typing"); // back to the normal article-reading position
        if (originalDocTitle) { try { document.title = originalDocTitle; } catch (e) {} }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
    el.diffBtns.forEach(function (b) {
      b.addEventListener("click", function () { loadDifficulty(b.dataset.diff); });
    });
    if (el.input) {
      el.input.addEventListener("input", onInput);
      // Tab+Enter = restart the current test from scratch (same
      // difficulty, blank slate) — hold Tab, then press Enter while
      // it's held (classic MonkeyType-style keyboard-only retake).
      // Tab's default action (moving focus away) is blocked the whole
      // time it's held, so it never escapes the typing box.
      var tabHeld = false;
      el.input.addEventListener("keydown", function (e) {
        if (e.key === "Tab") {
          e.preventDefault();
          tabHeld = true;
        } else if (e.key === "Enter" && tabHeld) {
          e.preventDefault();
          loadDifficulty(state.difficulty);
        }
      });
      el.input.addEventListener("keyup", function (e) {
        if (e.key === "Tab") tabHeld = false;
      });
      el.input.addEventListener("blur", function () {
        tabHeld = false;
        document.body.classList.remove("tr-hide-chrome"); // reveal the UI again while paused
        if (el.hint && !state.finished) el.hint.textContent = "Paused — tap the text to keep typing";
      });
      el.input.addEventListener("focus", function () {
        if (el.hint) el.hint.textContent = "";
      });
    }
    if (el.words) {
      el.words.addEventListener("click", function (e) {
        if (e.target.closest && e.target.closest(".tr-inline-photo")) return; // let the lightbox handle photo clicks
        focusInput();
      });
      el.words.addEventListener("touchstart", function (e) {
        if (e.target.closest && e.target.closest(".tr-inline-photo")) return;
        focusInput();
      }, { passive: true });
    }
    if (el.photoToggle) {
      el.photoToggle.addEventListener("change", function () {
        photosEnabled = el.photoToggle.checked;
        if (el.words) el.words.classList.toggle("tr-photos-on", photosEnabled);
        // layout changed (images now take/give up space) — reposition the
        // caret against the new positions without touching typed progress.
        updateColorsAndCaret();
      });
    }
    if (el.retakeBtn) {
      el.retakeBtn.addEventListener("click", function () { loadDifficulty(state.difficulty); });
    }
    if (el.shareBtn) {
      el.shareBtn.addEventListener("click", function () {
        var wpm = currentWpm(), acc = currentAccuracy();
        var text = "I typed today's trending article \u201c" + ART.title + "\u201d at " + wpm + " WPM (" + acc + "% accuracy) on Rocket Typing! Try it:";
        var url = window.location.href;
        var shareUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url);
        window.open(shareUrl, "_blank", "noopener,noreferrer");
      });
    }
    // Focus mode: while actively typing, most chrome (top bar, breadcrumb,
    // difficulty/photo/read-article controls, footer) is hidden via the
    // body.tr-hide-chrome CSS rules, leaving only the words-left count and
    // live WPM on screen. Moving the mouse (or a finger, via pointermove)
    // reveals everything again immediately; it hides again the moment
    // typing resumes (see onInput). Only touches the class when it's
    // actually present, so idle mousemove while not typing costs nothing.
    document.addEventListener("pointermove", function () {
      if (document.body.classList.contains("tr-hide-chrome")) {
        document.body.classList.remove("tr-hide-chrome");
      }
    }, { passive: true });
    window.addEventListener("resize", onResize);
  }

  function init() {
    cacheEls();
    wireEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
