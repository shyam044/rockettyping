/**
 * Rocket Typing – Coding Practice
 * Shared Practice-Mode Engine: coding/practice-engine.js
 *
 * Loaded ONCE (deferred) by every problem page in /coding/. It hooks the
 * platform's global functions (openProblem, runCode, resetCode, closeResult,
 * showResult) from problem-app.js exactly once, no matter how many problems
 * you add.
 *
 * WHAT GOES WHERE:
 *   - coding/practice-engine.js   (this file) → functionality/design.
 *   - coding/problem-app.js       → editor, Run/Submit, analytics, result screen.
 *   - coding/<seo-name>.html      → ONE problem: its SEO content, its question
 *                                   data (window.ROCKET_PROBLEM) and its
 *                                   reference solutions (window.__rocketSolutions).
 *   - coding/data/*.json          → the problem index (100 problems per file).
 *
 * Required script order on a problem page (all with `defer`):
 *   ../compilers/*.js  →  coding-core.js  →  problem-app.js  →  practice-engine.js
 *
 * Prev / Next Problem now navigate to the neighbouring problem's own page,
 * found through ProblemIndex.getNeighbors() (coding-core.js).
 *
 * "With Code" mode replaces the Monaco editor's visible area with a
 * MonkeyType-style typing widget: the reference solution is rendered
 * character-by-character (dim/untyped, green/correct, red/incorrect,
 * highlighted cursor on the current character). The user types with a
 * real cursor into a focused, invisible input — exactly like MonkeyType.
 * Every keystroke is mirrored live into the real Monaco editor underneath,
 * so Run / Submit / judging keep working completely unchanged.
 *
 * "Without Code" mode hides the widget and restores the normal blank
 * Monaco editor — the platform's original behaviour.
 *
 * ── OPTIONAL: line-by-line "explain preview" before typing starts ─────────
 * Give any method in a page's window.__rocketSolutions entry an `explain` array (same
 * order as `code.split("\n")`, one string per line — leave an entry blank
 * to skip that line) and picking that method shows a walkthrough FIRST:
 * each code line renders with an arrow animating from its last character to
 * the middle of the panel, and once it arrives, that line's explanation
 * fades in. Every line's arrow/fade happens together, on one shared timer.
 * A "▶ Start" button then begins the actual timed typing test (at a
 * larger, 36px font) — the clock does not start until Start is clicked.
 * Methods with no `explain` array skip straight to typing, unchanged.
 *
 *   window.__rocketSolutions = {
 *     1: [{
 *       name: "print() — double quotes",
 *       code: `a = input()\nprint(a)`,
 *       explain: [
 *         "Reads a line of text from input and stores it in `a`.",
 *         "Prints the value of `a` back out.",
 *       ],
 *     }],
 *   };
 */
(function () {

  // ── SHARED SOLUTIONS REGISTRY ─────────────────────────────────────────────
  // Each problem page owns only the reference solutions for ITS OWN question
  // id. It contributes them by setting window.__rocketSolutions = { <id>: [...] }
  // in an inline <script> before this file loads (or by calling
  // registerSolutions({...}) later). This engine merges everything into one
  // shared map keyed by question id.
  //
  // Shape:  { <questionId>: { python: [ {name, code, explain[]}, ... ], javascript: [...], java: [...], ... } }
  // (an old-style plain array is still accepted and treated as Python)
  const SOLUTIONS = {};

  window.registerSolutions = function (map) {
    Object.assign(SOLUTIONS, map);
  };

  const LANG_LABELS = { python: "Python", javascript: "JavaScript", java: "Java", cpp: "C++", c: "C", typescript: "TypeScript",
    go: "Go", rust: "Rust", kotlin: "Kotlin", swift: "Swift", php: "PHP", csharp: "C#", ruby: "Ruby" };

  function currentLang() {
    const el = document.getElementById("lang-select");
    return el ? el.value : "python";
  }
  // Reference solutions of a question in one language (defaults to the language picked in the toolbar).
  function methodsFor(qid, lang) {
    const entry = SOLUTIONS[qid];
    if (!entry) return [];
    const l = lang || currentLang();
    if (Array.isArray(entry)) return l === "python" ? entry : [];
    return entry[l] || [];
  }

  // The page's inline data script runs BEFORE this deferred file, so it stashes
  // its solutions on window.__rocketSolutions — we merge those in here.
  if (window.__rocketSolutions && Object.keys(window.__rocketSolutions).length) {
    Object.assign(SOLUTIONS, window.__rocketSolutions);
    window.__rocketSolutions = {};
  }

  let currentMode        = "idle"; // "idle" | "method-select" | "with" | "without"
  let suppressLangRestart = false;  // true while the engine itself calls changeLanguage()
  let lastSolLang         = "python"; // last language that has reference solutions for this problem
  let targetText         = "";     // reference text to type, for the open question
  let typedText          = "";     // what the user has actually typed so far
  let typedIndex         = 0;      // cursor position into targetText
  let autoSubmitted      = false;  // guards against submitting more than once per attempt
  let selectedMethodName  = "";     // name of the currently chosen "With Code" method
  let selectedMethodIndex = null;   // index of the currently chosen method (per question)

  // Holds the chosen method while the explain preview is showing, so the
  // Start button knows exactly what to hand off to startTypingTest().
  let pendingMethod    = null;
  let pendingMethodIdx = 0;
  let pendingModeOpts  = {};

  let _origStartTimer   = null; // the platform's real startTimer(), called only once a mode is picked
  let _origTrackerStart = null; // the platform's real TypingTracker.start(), same idea

  // MonkeyType-style: the visible clock (and the typing-tracker's stats)
  // only start counting on the user's FIRST real keystroke of an attempt —
  // not the moment With Code / Without Code / Start is clicked. `timerStarted`
  // guards against starting it more than once per attempt; it's reset back
  // to false any time a fresh attempt begins (new mode, reset, try again).
  let timerStarted = false;
  let monacoTimerHookAttached = false;
  let liveWpmInterval = null; // drives the circular live-WPM readout while typing

  // `currentQuestion`, `monacoEditor` and `TypingTracker` are declared with
  // `let`/`const` inside the app's own inline <script>. Top-level `let`/
  // `const` never become `window.*` properties, but they ARE shared across
  // every classic <script> tag on the page (problem-app.js included), so we read
  // them as plain identifiers via this helper instead of `window.x`.
  // Looks a name up on the explicit RocketApp API exposed by problem-app.js (no eval()).
  function safe(name) {
    const app = window.RocketApp;
    return app ? app[name] : undefined;
  }

  // Suppresses the platform's own automatic timer/tracker start (which
  // normally fires the instant a problem opens) so the clock only starts
  // once the user actually picks With Code / Without Code. We keep the real
  // implementations around and call them ourselves from setMode()/closeResult().
  function patchTimers() {
    if (_origStartTimer) return; // already patched

    _origStartTimer = window.startTimer;
    if (typeof _origStartTimer === "function") {
      window.startTimer = function () {
        // no-op — real start is triggered from setMode() / our closeResult hook
      };
    }

    const tracker = safe("TypingTracker");
    if (tracker && typeof tracker.start === "function") {
      _origTrackerStart = tracker.start;
      tracker.start = function () {
        // no-op — real start is triggered from setMode() / our closeResult hook.
        // recordKey() still lazily calls the original internal start() on the
        // first real keystroke as a safety net, so tracking never fully breaks.
      };
    }
  }

  // Clears the clock/tracker down to a frozen 00:00 whenever a fresh attempt
  // begins (a mode is picked, Reset, Try Again, a new problem). Nothing is
  // "started" here — TypingTracker.reset() nulls out its internal startTime,
  // and recordKey() already lazily re-starts it on the very next real
  // keystroke (see patchTimers() above), so all we need to do for the
  // visible clock is stop it and blank the display, then wait for typing.
  function resetClockForNewAttempt() {
    timerStarted = false;
    const tracker = safe("TypingTracker");
    if (tracker && typeof tracker.reset === "function") tracker.reset();
    const stopTimerFn = safe("stopTimer");
    if (typeof stopTimerFn === "function") stopTimerFn();
    const timerEl = document.getElementById("workspace-timer");
    if (timerEl) timerEl.textContent = "00:00";
    hideLiveWpm();
  }

  // Starts the visible clock the moment the user's first real keystroke of
  // an attempt lands — MonkeyType-style — and never fires twice per attempt.
  function startClockOnce() {
    if (timerStarted) return;
    timerStarted = true;
    if (_origStartTimer) _origStartTimer();
    showLiveWpm();
  }

  // ── Live WPM circular readout ────────────────────────────────────────────
  // Polls the platform's own TypingTracker.stats() every 300ms — reusing its
  // WPM math means the live number always agrees with the final result
  // screen. Works for both modes: "With Code" records keys via tryType()/
  // acceptChar(), "Without Code" records them via Monaco's onKeyDown (both
  // already call TypingTracker.recordKey elsewhere), so stats() reflects
  // whichever mode is actually running without any extra plumbing here.
  function showLiveWpm() {
    const el = document.getElementById("live-wpm-display");
    const numEl = document.getElementById("live-wpm-number");
    if (!el) return;
    el.style.display = "block";
    el.classList.add("show");
    if (numEl) { numEl.textContent = "0"; numEl.className = "live-wpm-number"; }

    if (liveWpmInterval) clearInterval(liveWpmInterval);
    liveWpmInterval = setInterval(() => {
      const tracker = safe("TypingTracker");
      if (!tracker || typeof tracker.stats !== "function") return;
      const stats = tracker.stats();
      // Skip the first fraction-of-a-second reading — divide-by-tiny-elapsed
      // math makes it spike wildly before settling (same guard MonkeyType uses).
      if (stats.activeMs < 600) return;
      const numEl2 = document.getElementById("live-wpm-number");
      if (!numEl2) return;
      numEl2.textContent = stats.wpm;
      numEl2.className = "live-wpm-number" +
        (stats.wpm >= 70 ? " fast" : stats.wpm >= 40 ? " great" : " slow");
    }, 300);
  }

  function hideLiveWpm() {
    if (liveWpmInterval) { clearInterval(liveWpmInterval); liveWpmInterval = null; }
    const el = document.getElementById("live-wpm-display");
    const numEl = document.getElementById("live-wpm-number");
    if (el) { el.style.display = "none"; el.classList.remove("show"); }
    if (numEl) { numEl.textContent = "0"; numEl.className = "live-wpm-number"; }
  }

  // "Without Code" mode types straight into Monaco, so the clock needs its
  // own keydown hook there (the "With Code" widget starts the clock from
  // handleTypingKeydown instead). Safe to call repeatedly — only attaches once.
  function attachMonacoTimerHook() {
    if (monacoTimerHookAttached) return;
    const editor = safe("monacoEditor");
    if (!editor || typeof editor.onKeyDown !== "function") return;
    monacoTimerHookAttached = true;
    editor.onKeyDown(() => {
      if (currentMode === "without") startClockOnce();
    });
  }

  // ── Output panel: collapsed by default, draggable splitter, expands on Run ──
  let lastOutputHeight = 240; // remembers the user's preferred open height

  // Monaco caches its own internal size and only re-measures automatically
  // on a handful of triggers. Whenever the output panel's height changes (or
  // Monaco goes from display:none back to visible), its cached size goes
  // stale — which can leave its internal layers sitting over the splitter/
  // output panel and swallowing clicks. Forcing .layout() fixes that.
  function relayoutEditor() {
    const editor = safe("monacoEditor");
    if (editor && typeof editor.layout === "function") {
      try { editor.layout(); } catch (e) { /* ignore */ }
    }
  }

  function buildOutputSplitter() {
    if (document.getElementById("output-splitter")) return;
    const main = document.querySelector(".workspace-main");
    const outputPanel = document.querySelector(".output-panel");
    const editorWrap = document.querySelector(".editor-wrap");
    const monacoContainer = document.getElementById("monaco-editor");
    if (!main || !outputPanel) return;

    // Belt-and-suspenders: neither of these had overflow:hidden in the
    // original CSS, so if Monaco's internal size cache is ever stale there
    // was nothing stopping its rendered content from visually painting over
    // the splitter/output area. Clipping them makes that impossible.
    if (editorWrap) editorWrap.style.overflow = "hidden";
    if (monacoContainer) monacoContainer.style.overflow = "hidden";

    const splitter = document.createElement("div");
    splitter.id = "output-splitter";
    splitter.className = "output-splitter";
    main.insertBefore(splitter, outputPanel);

    // Collapsed by default
    outputPanel.classList.add("output-panel-managed", "collapsed");
    outputPanel.style.height = "0px";
    outputPanel.addEventListener("transitionend", (e) => {
      if (e.propertyName === "height") relayoutEditor();
    });

    let dragging = false;
    let startY = 0;
    let startHeight = 0;

    function beginDrag(e) {
      dragging = true;
      startY = e.clientY;
      startHeight = outputPanel.getBoundingClientRect().height;
      outputPanel.classList.add("dragging");
      splitter.classList.add("dragging");
      document.body.style.userSelect = "none";
      relayoutEditor();
      e.preventDefault();
    }

    // Listen on the CAPTURE phase at the document level and hit-test by
    // coordinates, rather than relying solely on the browser delivering the
    // mousedown to the splitter element directly. This starts the drag even
    // if something else happens to be layered over the splitter's screen
    // position at that exact moment.
    document.addEventListener("mousedown", (e) => {
      const r = splitter.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        beginDrag(e);
      }
    }, true);

    // No relayout here — Monaco's .layout() is expensive enough that calling
    // it on every mousemove frame while Monaco is actively rendering causes
    // enough main-thread work to make the drag look frozen. The height
    // itself is a plain CSS/JS change and doesn't need Monaco's involvement
    // mid-drag; we only need Monaco to catch up once, at the end.
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      // Dragging the splitter UP (mouse Y decreases) increases the output
      // panel's height; dragging it DOWN reduces it.
      const delta = startY - e.clientY;
      let newHeight = startHeight + delta;
      const maxHeight = main.getBoundingClientRect().height - 160; // keep room for the editor
      newHeight = Math.max(0, Math.min(newHeight, Math.max(maxHeight, 0)));
      outputPanel.style.height = newHeight + "px";
      outputPanel.classList.toggle("collapsed", newHeight < 20);
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      outputPanel.classList.remove("dragging");
      splitter.classList.remove("dragging");
      document.body.style.userSelect = "";

      const h = outputPanel.getBoundingClientRect().height;
      if (h < 20) {
        collapseOutputPanel();
      } else {
        lastOutputHeight = h;
      }
      relayoutEditor();
    });

    relayoutEditor();
  }

  function expandOutputPanel() {
    const outputPanel = document.querySelector(".output-panel");
    if (!outputPanel) return;
    outputPanel.classList.remove("collapsed");
    outputPanel.classList.add("open");
    outputPanel.style.height = lastOutputHeight + "px";
    relayoutEditor();
    setTimeout(relayoutEditor, 240); // once the slide-up transition finishes
  }

  function collapseOutputPanel() {
    const outputPanel = document.querySelector(".output-panel");
    if (!outputPanel) return;
    outputPanel.classList.add("collapsed");
    outputPanel.classList.remove("open");
    outputPanel.style.height = "0px";
    relayoutEditor();
    setTimeout(relayoutEditor, 240);
  }

  // Diagnostic helper — run window.__debugSplitter() in the browser console
  // to see exactly what element sits at the splitter's screen position.
  window.__debugSplitter = function () {
    const splitter = document.getElementById("output-splitter");
    if (!splitter) { console.log("output-splitter not found in DOM"); return; }
    const r = splitter.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    console.log("splitter rect:", r);
    console.log("element actually at splitter's center point:", document.elementFromPoint(cx, cy));
  };

  // ── Styles (injected once) ──────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("mode-toggle-style")) return;
    const style = document.createElement("style");
    style.id = "mode-toggle-style";
    style.textContent = `
      .mode-toggle-bar {
        display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        padding: 10px 14px;
        background: var(--glass, rgba(10,10,35,0.75));
        border-bottom: 1px solid var(--border, rgba(255,215,0,0.18));
      }
      .mode-toggle-label {
        font-size: 12px; color: var(--text2, #8b949e);
        text-transform: uppercase; letter-spacing: .6px; margin-right: 4px;
      }
      .mode-btn {
        background: none; border: 1px solid var(--border, rgba(255,215,0,0.18));
        color: var(--text2, #8b949e); padding: 6px 14px; border-radius: 8px;
        font-family: var(--font-ui, sans-serif); font-size: 12px; cursor: pointer;
        transition: all .2s;
      }
      .mode-btn:hover { color: var(--gold, #ffd700); border-color: rgba(255,215,0,.35); }
      .mode-btn.active {
        color: #0a0a23;
        background: linear-gradient(135deg, var(--gold2, #e2b714), var(--orange, #ff9900));
        border-color: transparent; font-weight: 600;
      }
      .mode-btn:disabled {
        opacity: .35; cursor: not-allowed; color: var(--text2, #8b949e);
      }
      .mode-btn:disabled:hover { border-color: var(--border, rgba(255,215,0,0.18)); }
      .mode-progress {
        margin-left: auto; font-family: var(--font-mono, monospace);
        font-size: 12px; color: var(--text2, #8b949e);
      }

      .problem-nav-bar {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px;
        background: var(--glass, rgba(10,10,35,0.75));
        border-bottom: 1px solid var(--border, rgba(255,215,0,0.18));
      }
      .problem-nav-label {
        margin-left: auto; font-family: var(--font-mono, monospace);
        font-size: 12px; color: var(--text2, #8b949e);
      }

      /* ── Big start-screen shown before a mode is picked ── */
      #mode-select-screen {
        position: absolute; inset: 0; z-index: 6;
        display: none; flex-direction: column; gap: 18px;
        align-items: stretch; justify-content: center;
        padding: 32px; background: #0a0a23;
      }
      #mode-select-screen.show { display: flex; }
      .mode-box {
        flex: 1; min-height: 120px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
        background: var(--glass, rgba(10,10,35,0.75));
        border: 1px solid var(--border, rgba(255,215,0,0.18));
        border-radius: 16px; cursor: pointer;
        font-family: var(--font-ui, sans-serif); color: var(--text, #c9d1d9);
        transition: all .18s;
      }
      .mode-box:hover {
        border-color: var(--gold, #ffd700);
        background: rgba(255,215,0,0.06);
        transform: translateY(-2px);
      }
      .mode-box-icon { font-size: 34px; }
      .mode-box-title { font-size: 18px; font-weight: 700; color: var(--gold, #ffd700); }
      .mode-box-sub { font-size: 12px; color: var(--text2, #8b949e); text-align: center; max-width: 320px; }

      /* ── Method picker (choose an approach for With Code) ── */
      #method-select-screen {
        position: absolute; inset: 0; z-index: 7;
        display: none; flex-direction: column; gap: 14px;
        padding: 24px; background: #0a0a23;
      }
      #method-select-screen.show { display: flex; }
      .method-select-title {
        font-family: var(--font-ui, sans-serif); font-size: 15px; font-weight: 700;
        color: var(--gold, #ffd700); text-transform: uppercase; letter-spacing: .5px;
      }
      .method-select-list {
        flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 8px;
      }
      .method-option {
        text-align: left; display: flex; flex-direction: column; gap: 4px;
        background: var(--glass, rgba(10,10,35,0.75));
        border: 1px solid var(--border, rgba(255,215,0,0.18));
        border-radius: 10px; padding: 10px 14px; cursor: pointer; transition: all .15s;
      }
      .method-option:hover { border-color: var(--gold, #ffd700); background: rgba(255,215,0,0.06); }
      .method-option-name { font-family: var(--font-ui, sans-serif); font-size: 13px; font-weight: 600; color: var(--text, #c9d1d9); }
      .method-option-preview {
        font-family: var(--font-mono, monospace); font-size: 12px; color: var(--text2, #8b949e);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #method-select-back { align-self: flex-start; }

      .tp-method-bar {
        display: flex; align-items: center; gap: 10px; padding: 8px 24px;
        font-family: var(--font-ui, sans-serif); font-size: 12px; color: var(--text2, #8b949e);
        border-bottom: 1px solid var(--border, rgba(255,215,0,0.18));
        min-height: 20px;
      }
      .tp-method-bar b { color: var(--gold, #ffd700); }
      #tp-change-method {
        margin-left: auto; background: none; border: 1px solid var(--border, rgba(255,215,0,0.18));
        color: var(--text2, #8b949e); padding: 3px 10px; border-radius: 6px;
        font-family: var(--font-ui, sans-serif); font-size: 11px; cursor: pointer;
      }
      #tp-change-method:hover { color: var(--gold, #ffd700); border-color: rgba(255,215,0,.35); }

      /* ── MonkeyType-style typing widget ── */
      #type-practice-wrap {
        position: absolute; inset: 0; display: none; flex-direction: column;
        background: #0a0a23; z-index: 5;
      }
      #type-practice-wrap.show { display: flex; }
      #type-practice-text {
        flex: 1; overflow: auto; padding: 20px 24px; cursor: text;
        font-family: var(--font-mono, monospace); font-size: 15px; line-height: 1.9;
        white-space: pre-wrap; word-break: break-word;
        position: relative; /* anchor for the absolutely-positioned #caret */
      }
      #type-practice-text.tp-done { box-shadow: inset 0 0 0 2px var(--green, #00c896); }
      .tp-pending   { color: var(--text2, #5a6270); opacity: .55; }
      .tp-correct   { color: var(--text, #c9d1d9); }
      .tp-incorrect {
        color: var(--red, #ff4c4c);
        text-decoration: underline wavy var(--red, #ff4c4c);
        background: rgba(255,76,76,0.14); border-radius: 2px;
      }
      .tp-current { color: var(--text, #c9d1d9); }

      /* Real MonkeyType-style caret — a moving bar, not a background highlight */
      #caret {
        position: absolute;
        background: var(--cyan, #00e6cc);
        /* Smooth idle transition for caret blinking state and between tests */
        transition: transform 0.08s ease-out, height 0.06s ease-out;
        width: 4px;
        border-radius: 4px;
        will-change: transform, height;
        left: 0;
        top: 0;
        pointer-events: none; /* never intercept mouse events */
        opacity: 0;
      }
      #caret.tp-caret-show { opacity: 1; }
      #caret.tp-caret-blink { animation: tp-caret-blink 1s steps(1) infinite; }
      @keyframes tp-caret-blink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

      /* Wrong-key feedback: the current character shakes/flashes red, and the
         caret itself does NOT move until the correct key is pressed. */
      .tp-wrong-flash {
        color: var(--red, #ff4c4c) !important;
        background: rgba(255,76,76,0.30);
        border-radius: 2px;
        animation: tp-shake .18s linear;
      }
      @keyframes tp-shake {
        0%   { transform: translateX(0); }
        25%  { transform: translateX(-3px); }
        75%  { transform: translateX(3px); }
        100% { transform: translateX(0); }
      }

      #type-hidden-input {
        position: absolute; opacity: 0; height: 1px; width: 1px;
        padding: 0; border: none; overflow: hidden; pointer-events: none;
      }

      .res-mode-badge {
        display: inline-block; margin-left: 8px; padding: 2px 8px;
        font-size: 11px; border-radius: 6px; vertical-align: middle;
        background: rgba(255,215,0,0.12); color: var(--gold, #ffd700);
        border: 1px solid var(--border, rgba(255,215,0,0.18));
      }
      #res-mode-card #res-mode-val { color: var(--gold, #ffd700); }

      /* ── "Let's walk through it" explain preview (shown before typing starts) ── */
      #explain-preview-screen {
        position: absolute; inset: 0; z-index: 6;
        display: none; flex-direction: column;
        background: #0a0a23;
      }
      #explain-preview-screen.show { display: flex; }
      .ep-header {
        padding: 14px 24px 10px;
        font-family: var(--font-ui, sans-serif); font-size: 13px; font-weight: 600;
        color: var(--gold, #ffd700); text-transform: uppercase; letter-spacing: .5px;
        border-bottom: 1px solid var(--border, rgba(255,215,0,0.18));
      }
      .ep-body {
        position: relative; flex: 1; overflow: hidden;
      }
      .ep-code {
        position: absolute; inset: 0; overflow: auto; padding: 18px 24px;
        font-family: var(--font-mono, monospace); font-size: 15px; line-height: 2.1;
      }
      .ep-row {
        position: relative; display: flex; align-items: center;
        white-space: pre; min-height: 1.6em;
      }
      .ep-code-line { color: var(--text, #c9d1d9); white-space: pre; }
      .ep-arrow {
        position: absolute; top: 50%; left: 0;
        transform: translate(0, -50%);
        color: var(--cyan, #00e6cc); font-weight: 700;
        pointer-events: none;
        /* left is animated frame-by-frame from JS (see showExplainPreview),
           not via a CSS transition — its target differs per row (it always
           lands just before that row's own explanation), so a single fixed
           CSS end-state wouldn't fit every row. */
      }
      .ep-explain {
        position: absolute; left: 50%; top: 50%; right: 0;
        transform: translateY(-50%);
        white-space: normal; word-break: break-word;
        font-family: var(--font-ui, sans-serif); font-size: 13px; color: var(--text2, #8b949e);
        opacity: 0;
        transition: opacity 0.2s ease-out;
      }
      .ep-row.ep-animate .ep-explain { opacity: 1; }

      /* Circular Start button, floating in the middle of the panel — between
         the code (left) and the explanations (right) — visible the whole
         time the preview is up, not just once the arrows finish moving.
         Draggable: if it's sitting over text you want to read, pick it up
         and move it out of the way — see the pointer-drag handlers below. */
      #ep-start-btn {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 84px; height: 84px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, var(--gold2, #e2b714), var(--orange, #ff9900));
        color: #0a0a23; border: 3px solid #0a0a23; font-weight: 700;
        font-size: 28px; cursor: grab; z-index: 3;
        font-family: var(--font-ui, sans-serif); transition: box-shadow .18s, opacity .18s;
        box-shadow: 0 0 0 0 rgba(255,153,0,0.5), 0 4px 18px rgba(0,0,0,0.4);
        animation: ep-pulse 2.2s ease-out infinite;
        padding-left: 4px; /* optical centering — the ▶ glyph leans left */
        touch-action: none;   /* so dragging on touch screens doesn't scroll */
        user-select: none;
      }
      #ep-start-btn:hover {
        box-shadow: 0 0 24px rgba(255,153,0,0.6), 0 4px 18px rgba(0,0,0,0.4);
        animation-play-state: paused;
      }
      #ep-start-btn.dragging {
        cursor: grabbing; animation: none; opacity: 0.85;
      }
      @keyframes ep-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(255,153,0,0.45), 0 4px 18px rgba(0,0,0,0.4); }
        70%  { box-shadow: 0 0 0 18px rgba(255,153,0,0), 0 4px 18px rgba(0,0,0,0.4); }
        100% { box-shadow: 0 0 0 0 rgba(255,153,0,0), 0 4px 18px rgba(0,0,0,0.4); }
      }
      .ep-hint {
        position: absolute; top: calc(50% + 56px); left: 50%;
        transform: translateX(-50%);
        font-family: var(--font-ui, sans-serif); font-size: 11px; color: var(--text2, #8b949e);
        white-space: nowrap; letter-spacing: .2px;
      }

      /* ── Large-font typing test, entered via the explain preview's Start button ── */
      #type-practice-text.tp-large-font {
        font-size: 36px; line-height: 1.5;
      }

      /* ── Output panel splitter + collapse/expand ── */
      .output-panel-managed {
        overflow: hidden;
        transition: height 0.22s ease;
        position: relative; z-index: 30;
      }
      .output-panel-managed.dragging { transition: none; }
      .output-splitter {
        height: 6px; flex-shrink: 0; cursor: ns-resize;
        position: relative; z-index: 30; background: transparent;
      }
      .output-splitter::before {
        content: ""; position: absolute; left: 0; right: 0; top: 2px; height: 2px;
        background: var(--border, rgba(255,215,0,0.18)); transition: background .15s;
      }
      .output-splitter:hover::before,
      .output-splitter.dragging::before {
        background: var(--gold, #ffd700);
      }

      /* ── Live WPM circular readout — shown once typing starts, MonkeyType-style ── */
      #live-wpm-display {
        display: none;
        position: absolute;
        top: 14px; right: 14px;
        z-index: 8;
        pointer-events: none;
      }
      #live-wpm-display.show {
        animation: tp-livewpm-popin 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }
      .live-wpm-circle {
        width: 64px; height: 64px; border-radius: 50%;
        position: relative; display: flex; align-items: center; justify-content: center;
        background: radial-gradient(circle at 38% 32%,
          rgba(255,215,0,0.22) 0%, rgba(255,215,0,0.06) 55%, rgba(10,10,35,0.85) 100%);
        box-shadow:
          0 0 0 2px rgba(255,215,0,0.5),
          0 0 14px rgba(255,215,0,0.3),
          inset 0 0 14px rgba(255,215,0,0.08);
        animation: tp-livewpm-breathe 2.4s ease-in-out infinite;
      }
      .live-wpm-ring {
        position: absolute; inset: -3px; border-radius: 50%;
        border: 2px solid transparent;
        border-top-color: var(--gold, #ffd700);
        border-right-color: rgba(255,215,0,0.4);
        animation: tp-livewpm-spin 2s linear infinite;
      }
      .live-wpm-inner {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        line-height: 1; position: relative; z-index: 1;
      }
      .live-wpm-number {
        font-family: var(--font-mono, monospace); font-size: 18px; font-weight: 900;
        color: var(--gold, #ffd700); letter-spacing: -0.5px;
        text-shadow: 0 0 10px rgba(255,215,0,0.7);
        transition: color 0.3s ease;
      }
      .live-wpm-label {
        font-family: var(--font-ui, sans-serif); font-size: 7px; font-weight: 700;
        color: rgba(255,215,0,0.7); letter-spacing: 1.6px; text-transform: uppercase;
      }
      .live-wpm-number.fast  { color: var(--green, #00c896); text-shadow: 0 0 12px rgba(0,200,150,0.7); }
      .live-wpm-number.great { color: var(--gold, #ffd700); text-shadow: 0 0 12px rgba(255,215,0,0.7); }
      .live-wpm-number.slow  { color: var(--red, #ff4c4c); text-shadow: 0 0 10px rgba(255,76,76,0.6); }
      @keyframes tp-livewpm-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      @keyframes tp-livewpm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes tp-livewpm-popin { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
    `;
    document.head.appendChild(style);
  }

  // ── Toggle bar + typing widget (injected once, into the RIGHT panel) ────
  function buildUI() {
    if (document.getElementById("mode-toggle-bar")) return;
    const main = document.querySelector(".workspace-main");
    const editorWrap = document.querySelector(".editor-wrap");
    if (!main || !editorWrap) return;

    const bar = document.createElement("div");
    bar.className = "mode-toggle-bar";
    bar.id = "mode-toggle-bar";
    bar.innerHTML = `
      <span class="mode-toggle-label">Practice Mode</span>
      <button type="button" class="mode-btn" id="mode-btn-with">📄 With Code</button>
      <button type="button" class="mode-btn" id="mode-btn-without">⌨️ Without Code</button>
      <span class="mode-progress" id="mode-progress"></span>
    `;
    main.insertBefore(bar, main.firstChild);

    // Big start-screen shown before the user has picked a mode for this problem
    const select = document.createElement("div");
    select.id = "mode-select-screen";
    select.className = "show";
    select.innerHTML = `
      <button type="button" class="mode-box" id="mode-box-with">
        <span class="mode-box-icon">📄</span>
        <span class="mode-box-title">With Code</span>
        <span class="mode-box-sub">Pick an approach and type it out, MonkeyType-style</span>
      </button>
      <button type="button" class="mode-box" id="mode-box-without">
        <span class="mode-box-icon">⌨️</span>
        <span class="mode-box-title">Without Code</span>
        <span class="mode-box-sub">Write the solution yourself, no reference shown</span>
      </button>
    `;
    editorWrap.appendChild(select);

    // Live WPM circular readout — hidden until the first real keystroke of
    // an attempt (see startClockOnce()/showLiveWpm()); floats above both the
    // "With Code" typing widget and the plain Monaco editor equally, since
    // it's a direct sibling appended to editorWrap.
    const liveWpm = document.createElement("div");
    liveWpm.id = "live-wpm-display";
    liveWpm.innerHTML = `
      <div class="live-wpm-circle">
        <div class="live-wpm-ring"></div>
        <div class="live-wpm-inner">
          <span class="live-wpm-number" id="live-wpm-number">0</span>
          <span class="live-wpm-label">WPM</span>
        </div>
      </div>
    `;
    editorWrap.appendChild(liveWpm);

    // Method picker — shown when a question has more than one reference approach
    const methodSelect = document.createElement("div");
    methodSelect.id = "method-select-screen";
    methodSelect.innerHTML = `
      <div class="method-select-title">Choose a method to type</div>
      <div class="method-select-list" id="method-select-list"></div>
      <button type="button" class="mode-btn" id="method-select-back">◀ Back</button>
    `;
    editorWrap.appendChild(methodSelect);
    document.getElementById("method-select-back").addEventListener("click", () => {
      if (selectedMethodIndex !== null) {
        setMode("with", { notify: false, methodIndex: selectedMethodIndex });
      } else {
        goIdle();
      }
    });

    // "Let's walk through it" preview — shown after picking a method, before
    // typing starts, ONLY when that method provides line-by-line `explain`
    // text (see showExplainPreview()). Otherwise this step is skipped
    // entirely and typing starts right away, exactly like before.
    const explainPreview = document.createElement("div");
    explainPreview.id = "explain-preview-screen";
    explainPreview.innerHTML = `
      <div class="ep-header">Here's the code — let's walk through it</div>
      <div class="ep-body">
        <div class="ep-code" id="ep-code"></div>
        <button type="button" id="ep-start-btn" title="Start typing (or press Enter)">start</button>
        <div class="ep-hint" id="ep-hint">Press Start or hit Enter</div>
      </div>
    `;
    editorWrap.appendChild(explainPreview);
    const beginTypingTest = () => {
      hideExplainPreview();
      startTypingTest(pendingMethod, pendingMethodIdx, pendingModeOpts, { largeFont: true });
    };

    // The Start button is draggable — pick it up and move it anywhere in the
    // panel if it's sitting over an explanation you want to read. A plain
    // click/tap (no real movement) still starts typing; only an actual drag
    // is treated as "moving the button" rather than "pressing it".
    const startBtn = document.getElementById("ep-start-btn");
    let dragInfo = null;

    startBtn.addEventListener("pointerdown", (e) => {
      const btnRect = startBtn.getBoundingClientRect();
      dragInfo = {
        moved: false,
        offsetX: e.clientX - btnRect.left,
        offsetY: e.clientY - btnRect.top,
      };
      startBtn.setPointerCapture(e.pointerId);
      startBtn.classList.add("dragging");
    });

    startBtn.addEventListener("pointermove", (e) => {
      if (!dragInfo) return;
      dragInfo.moved = true;

      const body = startBtn.parentElement; // .ep-body
      const bodyRect = body.getBoundingClientRect();
      const w = startBtn.offsetWidth;
      const h = startBtn.offsetHeight;

      let left = e.clientX - bodyRect.left - dragInfo.offsetX;
      let top  = e.clientY - bodyRect.top  - dragInfo.offsetY;
      left = Math.max(0, Math.min(left, bodyRect.width  - w));
      top  = Math.max(0, Math.min(top,  bodyRect.height - h));

      startBtn.style.transform = "none";
      startBtn.style.left = left + "px";
      startBtn.style.top  = top  + "px";

      // The hint text tags along right underneath the button, wherever it
      // ends up — clamped so it can't get pushed outside the panel either.
      const hint = document.getElementById("ep-hint");
      if (hint) {
        const hintW = hint.offsetWidth;
        const gap = 12;
        let hintLeft = left + w / 2 - hintW / 2;
        let hintTop = top + h + gap;
        hintLeft = Math.max(0, Math.min(hintLeft, bodyRect.width - hintW));
        hintTop = Math.min(hintTop, bodyRect.height - hint.offsetHeight);
        hint.style.transform = "none";
        hint.style.left = hintLeft + "px";
        hint.style.top = hintTop + "px";
      }
    });

    startBtn.addEventListener("pointerup", (e) => {
      if (!dragInfo) return;
      const wasDrag = dragInfo.moved;
      dragInfo = null;
      startBtn.classList.remove("dragging");
      startBtn.releasePointerCapture(e.pointerId);
      if (!wasDrag) beginTypingTest();
    });

    // Enter also starts typing, so the user isn't forced to reach for the
    // mouse — only listens while the preview is actually showing.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const preview = document.getElementById("explain-preview-screen");
      if (preview && preview.classList.contains("show")) {
        e.preventDefault();
        beginTypingTest();
      }
    });

    const wrap = document.createElement("div");
    wrap.id = "type-practice-wrap";
    wrap.innerHTML = `
      <div class="tp-method-bar" id="tp-method-bar"></div>
      <div id="type-practice-text" tabindex="0"><span id="tp-chars"></span><div id="caret"></div></div>
      <textarea id="type-hidden-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
    `;
    editorWrap.appendChild(wrap);

    const hidden = document.getElementById("type-hidden-input");
    const textEl = document.getElementById("type-practice-text");
    textEl.addEventListener("click", () => hidden.focus());
    wrap.addEventListener("click", () => hidden.focus());
    hidden.addEventListener("keydown", handleTypingKeydown);
    hidden.addEventListener("blur", () => {
      // keep focus in the typing widget while it's active
      if (currentMode === "with") setTimeout(() => hidden.focus(), 0);
    });

    document.getElementById("mode-btn-with")
      .addEventListener("click", () => setMode("with", { notify: true, methodIndex: 0 }));
    document.getElementById("mode-btn-without")
      .addEventListener("click", () => setMode("without", { notify: true }));
    document.getElementById("mode-box-with")
      .addEventListener("click", () => setMode("with", { notify: true, methodIndex: 0 }));
    document.getElementById("mode-box-without")
      .addEventListener("click", () => setMode("without", { notify: true }));
  }

  // Shows the list of available methods/approaches for the current question.
  // If there's only one, skips straight to typing it.
  function showMethodSelect() {
    const q = safe("currentQuestion");
    if (!q) return;
    const methods = methodsFor(q.id);

    if (methods.length <= 1) {
      setMode("with", { notify: true, methodIndex: 0 });
      return;
    }

    currentMode = "method-select";
    document.getElementById("mode-btn-with").classList.add("active");
    document.getElementById("mode-btn-without").classList.remove("active");

    const monacoContainer = document.getElementById("monaco-editor");
    const wrap = document.getElementById("type-practice-wrap");
    const select = document.getElementById("mode-select-screen");
    const methodSelect = document.getElementById("method-select-screen");

    if (monacoContainer) monacoContainer.style.display = "none";
    if (wrap) wrap.classList.remove("show");
    if (select) select.classList.remove("show");

    const list = document.getElementById("method-select-list");
    list.innerHTML = "";
    methods.forEach((m, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "method-option";
      btn.innerHTML = `<span class="method-option-name">${escapeCharHtmlStr(m.name)}</span>
        <span class="method-option-preview">${escapeCharHtmlStr(m.code.split("\n")[0])}${m.code.includes("\n") ? " …" : ""}</span>`;
      btn.addEventListener("click", () => setMode("with", { notify: true, methodIndex: i }));
      list.appendChild(btn);
    });

    if (methodSelect) methodSelect.classList.add("show");
  }

  function escapeCharHtmlStr(str) {
    return str.replace(/[<>&]/g, (c) => escapeCharHtml(c));
  }

  // Small bar shown above the reference text naming the chosen method, with
  // a way to pick a different one if the question offers more than one.
  function updateMethodInfoBar(hasMultiple) {
    const bar = document.getElementById("tp-method-bar");
    if (!bar) return;
    if (!selectedMethodName) { bar.innerHTML = ""; return; }
    bar.innerHTML = `<span>Method: <b>${escapeCharHtmlStr(selectedMethodName)}</b></span>` +
      (hasMultiple ? `<button type="button" id="tp-change-method">🔀 Try Other Methods</button>` : "");
    const changeBtn = document.getElementById("tp-change-method");
    if (changeBtn) changeBtn.addEventListener("click", showMethodSelect);
  }

  // ── Prev / Next Problem navigation (left sidebar) ───────────────────────
  function buildProblemNav() {
    if (document.getElementById("problem-nav-bar")) return;
    const sidebar = document.querySelector(".workspace-sidebar");
    if (!sidebar) return;

    const nav = document.createElement("div");
    nav.id = "problem-nav-bar";
    nav.className = "problem-nav-bar";
    nav.innerHTML = `
      <button type="button" class="mode-btn" id="prob-nav-prev">◀ Prev Problem</button>
      <span class="problem-nav-label" id="prob-nav-label"></span>
      <button type="button" class="mode-btn" id="prob-nav-next">Next Problem ▶</button>
    `;
    sidebar.insertBefore(nav, sidebar.firstChild);

    document.getElementById("prob-nav-prev").addEventListener("click", () => navigateProblem(-1));
    document.getElementById("prob-nav-next").addEventListener("click", () => navigateProblem(1));
  }

  async function navigateProblem(delta) {
    const index = safe("ProblemIndex");
    const q = safe("currentQuestion");
    if (!index || !q) return;
    try {
      const nb = await index.getNeighbors(q.id);
      const target = delta < 0 ? nb.prev : nb.next;
      if (target) window.location.href = target.file;
    } catch (e) { /* index unavailable — stay on this problem */ }
  }

  async function updateProblemNav() {
    const index = safe("ProblemIndex");
    const q = safe("currentQuestion");
    const prevBtn = document.getElementById("prob-nav-prev");
    const nextBtn = document.getElementById("prob-nav-next");
    const label = document.getElementById("prob-nav-label");
    if (!index || !q || !prevBtn || !nextBtn || !label) return;

    prevBtn.disabled = true;
    nextBtn.disabled = true;
    label.textContent = `Problem #${q.id}`;
    try {
      const nb = await index.getNeighbors(q.id);
      prevBtn.disabled = !nb.prev;
      nextBtn.disabled = !nb.next;
      label.textContent = `Problem ${nb.position} / ${nb.total}`;
    } catch (e) { /* keep the simple label */ }
  }

  // ── Typing logic ─────────────────────────────────────────────────────────
  // Because typed text is only ever accepted when it matches the reference
  // exactly, `typedText` always equals targetText.slice(0, typedIndex) — so
  // once typedIndex reaches the end, the code in the editor is guaranteed
  // correct and ready to Run / Submit.
  let blinkTimer = null;

  function handleTypingKeydown(e) {
    if (currentMode !== "with" || !targetText) return;

    // MonkeyType-style: the clock starts on the very first real keystroke
    // of the attempt, not when the widget first appears.
    startClockOnce();

    if (e.key === "Backspace") {
      e.preventDefault();
      if (typedIndex > 0) {
        typedIndex--;
        typedText = typedText.slice(0, -1);
        const tracker = safe("TypingTracker");
        if (tracker && typeof tracker.recordKey === "function") tracker.recordKey("Backspace");
        afterTypeChange();
      }
      return;
    }
    if (e.key === "Tab") {
      // Indentation is filled in automatically the instant a new row is
      // reached (see skipAutoFormatting()), so there's never a leading
      // space left for Tab to insert — just swallow the keypress so focus
      // doesn't jump away from the typing widget.
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (tryType("\n")) afterTypeChange();
      return;
    }
    if (e.key === " " && targetText[typedIndex] === "\n") {
      // At the end of a row, Space works exactly like Enter.
      e.preventDefault();
      if (tryType("\n")) afterTypeChange();
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      if (tryType(e.key)) afterTypeChange();
    }
  }

  // Only accepts (and advances the cursor on) a character that exactly
  // matches the next expected character. A wrong key press never moves the
  // cursor — it just flashes the current character red until the user
  // types it correctly, MonkeyType "stop on mistake" style.
  function tryType(ch) {
    if (typedIndex >= targetText.length) return false;
    const expected = targetText[typedIndex];
    if (ch !== expected) {
      flashWrong();
      // Record the mistake so Accuracy/Consistency reflect it — the
      // platform's tracker scores accuracy from the ratio of "Backspace"
      // -coded keystrokes to total keystrokes, so a rejected wrong key is
      // recorded the same way a correction would be.
      const tracker = safe("TypingTracker");
      if (tracker && typeof tracker.recordKey === "function") tracker.recordKey("Backspace");
      return false;
    }
    acceptChar(ch);
    skipAutoFormatting();
    return true;
  }

  // Auto-advances past characters the user never has to type by hand:
  // consecutive newlines (so pressing Enter/Space once clears a whole run
  // of blank lines), and — right at the start of any row — that row's
  // leading indentation spaces. Python's 4-space indents are filled in
  // automatically, exactly like the newline auto-skip already did, so
  // typing practice only ever asks for the real code characters.
  function skipAutoFormatting() {
    let advanced = true;
    while (advanced) {
      advanced = false;
      while (typedIndex < targetText.length && targetText[typedIndex] === "\n") {
        acceptChar("\n");
        advanced = true;
      }
      const atLineStart = typedIndex === 0 || targetText[typedIndex - 1] === "\n";
      if (atLineStart && typedIndex < targetText.length && targetText[typedIndex] === " ") {
        while (typedIndex < targetText.length && targetText[typedIndex] === " ") {
          acceptChar(" ");
        }
        advanced = true;
      }
    }
  }

  function acceptChar(ch) {
    typedText += ch;
    typedIndex++;
    const tracker = safe("TypingTracker");
    if (tracker && typeof tracker.recordKey === "function") tracker.recordKey(ch);
  }

  function flashWrong() {
    const chars = document.getElementById("tp-chars");
    if (!chars) return;
    const span = chars.children[typedIndex];
    if (!span) return;
    span.classList.remove("tp-wrong-flash");
    void span.offsetWidth; // restart the shake animation if triggered repeatedly
    span.classList.add("tp-wrong-flash");
    clearTimeout(flashWrong._t);
    flashWrong._t = setTimeout(() => span.classList.remove("tp-wrong-flash"), 200);

    // Caret still "reacts" (a quick pulse) even though it doesn't move.
    const caret = document.getElementById("caret");
    if (caret) {
      caret.classList.remove("tp-caret-blink");
      resetBlinkTimer();
    }
  }

  function afterTypeChange() {
    renderTypingProgress();
    syncToEditor();
    resetBlinkTimer();

    if (currentMode === "with" && targetText && typedIndex >= targetText.length && !autoSubmitted) {
      autoSubmitted = true;
      const toast = safe("toast");
      if (typeof toast === "function") {
        toast("Finished! Submitting your code…", "success");
      }
      // Small delay so the last character's render/caret animation is
      // visible before the result overlay appears.
      setTimeout(() => {
        const submit = safe("submitCode");
        if (typeof submit === "function") submit();
      }, 350);
    }
  }

  function resetBlinkTimer() {
    const caret = document.getElementById("caret");
    if (!caret) return;
    caret.classList.remove("tp-caret-blink");
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => caret.classList.add("tp-caret-blink"), 500);
  }

  function renderTypingProgress() {
    const textEl = document.getElementById("type-practice-text");
    const chars = document.getElementById("tp-chars");
    if (!textEl || !chars) return;

    if (!targetText) {
      chars.textContent = "No reference code available for this problem yet.";
      const caret = document.getElementById("caret");
      if (caret) caret.classList.remove("tp-caret-show");
      return;
    }

    let html = "";
    for (let i = 0; i < targetText.length; i++) {
      const ch = targetText[i];
      let cls = "tp-pending";
      if (i < typedIndex) cls = "tp-correct";
      else if (i === typedIndex) cls = "tp-current";
      html += `<span class="${cls}">${escapeCharHtml(ch)}</span>`;
    }
    chars.innerHTML = html;
    textEl.classList.toggle("tp-done", typedIndex >= targetText.length);

    const progress = document.getElementById("mode-progress");
    if (progress) {
      progress.textContent = currentMode === "with"
        ? `${typedIndex} / ${targetText.length} characters`
        : "";
    }

    updateRowScroll();
    moveCaret();
  }

  // Keeps exactly 1 row of context above the current row at all times: as
  // you move to a new row, the row TWO back disappears completely, and the
  // row ONE back stays visible right above the row you're typing now. This
  // starts once row 2 begins (rows 0 and 1 never scroll). The transition
  // into the LAST row is the one exception — instead of trimming down to
  // 1 row of context like every other transition, the view just holds at
  // its current position, so the last two "history" rows both stay put.
  function updateRowScroll() {
    const textEl = document.getElementById("type-practice-text");
    if (!textEl || !targetText) return;

    const rowIndex = (typedText.match(/\n/g) || []).length; // 0-based current row
    const totalRows = (targetText.match(/\n/g) || []).length + 1;
    const cappedRowIndex = Math.min(rowIndex, totalRows - 2); // freeze on the final row
    const lineHeight = parseFloat(getComputedStyle(textEl).lineHeight) || 28;
    const targetScrollTop = cappedRowIndex >= 2 ? (cappedRowIndex - 1) * lineHeight : 0;

    if (Math.abs(textEl.scrollTop - targetScrollTop) > 1) {
      textEl.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    }
  }

  // Positions the real #caret bar over the current character, MonkeyType-style.
  function moveCaret() {
    const textEl = document.getElementById("type-practice-text");
    const caret = document.getElementById("caret");
    const chars = document.getElementById("tp-chars");
    if (!textEl || !caret || !chars) return;

    const current = chars.children[typedIndex];
    if (!current) {
      // Finished (or nothing to type yet) — park the caret after the last
      // character and hide it.
      caret.classList.remove("tp-caret-show");
      return;
    }

    const containerRect = textEl.getBoundingClientRect();
    const rect = current.getBoundingClientRect();
    const x = rect.left - containerRect.left + textEl.scrollLeft;
    const y = rect.top - containerRect.top + textEl.scrollTop;

    caret.style.transform = `translate(${x}px, ${y}px)`;
    caret.style.height = rect.height + "px";
    caret.classList.add("tp-caret-show");
  }

  function escapeCharHtml(ch) {
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === "&") return "&amp;";
    return ch;
  }

  function syncToEditor() {
    const editor = safe("monacoEditor");
    if (editor) editor.setValue(typedText);
  }

  // ── "Let's walk through it" explain preview ─────────────────────────────
  // Shown only when the chosen method has an `explain` array (one entry per
  // line of `code`, same order — blank/omitted entries just render that
  // line's code with no arrow/explanation). Builds one row per code line,
  // then triggers ALL rows' arrow-move + explanation-fade in a single pass
  // (a single class added on the next frame) rather than staggering them
  // with per-row timers — every arrow travels for the same CSS transition
  // duration, so no matter where each one starts, they all arrive at the
  // middle — and fade their explanation in — at the same moment.
  function showExplainPreview(chosen, idx, opts) {
    pendingMethod    = chosen;
    pendingMethodIdx = idx;
    pendingModeOpts  = opts || {};

    currentMode = "with-preview";

    const monacoContainer = document.getElementById("monaco-editor");
    const wrap = document.getElementById("type-practice-wrap");
    const preview = document.getElementById("explain-preview-screen");
    if (monacoContainer) monacoContainer.style.display = "none";
    if (wrap) wrap.classList.remove("show");

    // Reset the Start button (and its hint text) back to centered — if it
    // was dragged aside during a previous method/question's preview, this
    // one starts fresh.
    const startBtn = document.getElementById("ep-start-btn");
    if (startBtn) {
      startBtn.style.left = "50%";
      startBtn.style.top = "50%";
      startBtn.style.transform = "translate(-50%, -50%)";
    }
    const hint = document.getElementById("ep-hint");
    if (hint) {
      hint.style.left = "";
      hint.style.top = "";
      hint.style.transform = "";
    }

    const lines = chosen.code.split("\n");
    const explain = chosen.explain || [];

    const codeBox = document.getElementById("ep-code");
    codeBox.innerHTML = "";
    lines.forEach((line, i) => {
      const row = document.createElement("div");
      row.className = "ep-row";

      const codeSpan = document.createElement("span");
      codeSpan.className = "ep-code-line";
      codeSpan.textContent = line.length ? line : "\u00A0"; // keep blank lines visible
      row.appendChild(codeSpan);

      const text = explain[i];
      if (text && text.trim()) {
        const arrow = document.createElement("span");
        arrow.className = "ep-arrow";
        arrow.textContent = "→";
        row.appendChild(arrow);

        const explainSpan = document.createElement("span");
        explainSpan.className = "ep-explain";
        explainSpan.textContent = text;
        row.appendChild(explainSpan);
      }

      codeBox.appendChild(row);
    });

    if (preview) preview.classList.add("show");

    // Animate every row's arrow together, in one shared rAF loop — not one
    // CSS transition per row. Each arrow starts right after its OWN line's
    // last character and travels to just before its OWN explanation text
    // (measured from the real DOM, not a fixed percentage), but every arrow
    // shares the same duration and the same clock, so they all arrive — and
    // fade their explanation in — at the same instant, no matter how far
    // each one had to travel.
    requestAnimationFrame(() => {
      const rows = Array.from(codeBox.querySelectorAll(".ep-row"));
      const movers = [];
      rows.forEach((row) => {
        const codeSpan = row.querySelector(".ep-code-line");
        const arrow = row.querySelector(".ep-arrow");
        const explainSpan = row.querySelector(".ep-explain");
        if (!codeSpan || !arrow || !explainSpan) return;
        const start = codeSpan.offsetWidth + 10;
        const end = Math.max(start, explainSpan.offsetLeft - 22);
        arrow.style.left = start + "px";
        movers.push({ arrow, start, end, row });
      });

      if (!movers.length) return;

      const DURATION = 800; // ms — shared by every row
      const t0 = performance.now();

      function step(now) {
        const t = Math.min((now - t0) / DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        movers.forEach((m) => {
          m.arrow.style.left = (m.start + (m.end - m.start) * eased) + "px";
        });
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          // All arrows have just arrived — fade every explanation in together.
          movers.forEach((m) => m.row.classList.add("ep-animate"));
        }
      }
      requestAnimationFrame(step);
    });

    if (opts && opts.notify) {
      const toast = safe("toast");
      if (typeof toast === "function") {
        toast("With Code: read the walkthrough, then hit Start when you're ready.", "info");
      }
    }
  }

  function hideExplainPreview() {
    const preview = document.getElementById("explain-preview-screen");
    if (preview) preview.classList.remove("show");
    const codeBox = document.getElementById("ep-code");
    if (codeBox) codeBox.innerHTML = ""; // reset so next preview starts clean
  }

  // Actually builds/shows the MonkeyType-style typing widget and starts the
  // clock. Called either straight from setMode() (method has no `explain`
  // data — old behaviour, unchanged) or from the explain preview's Start
  // button (extra.largeFont makes the reference text render at 36px).
  function startTypingTest(chosen, idx, opts, extra) {
    extra = extra || {};
    currentMode = "with";

    const monacoContainer = document.getElementById("monaco-editor");
    const wrap = document.getElementById("type-practice-wrap");
    const langSelect = document.getElementById("lang-select");
    const methods = methodsFor((safe("currentQuestion") || {}).id);

    targetText = chosen ? chosen.code : "";
    selectedMethodName = chosen ? chosen.name : "";
    selectedMethodIndex = idx;
    typedText = "";
    typedIndex = 0;
    autoSubmitted = false;

    // The visible clock and typing-tracker only start counting once the
    // user's first real keystroke lands — MonkeyType-style — not the
    // instant the typing widget appears.
    resetClockForNewAttempt();
    // Auto-fill any indentation the very first row starts with (matches the
    // auto-skip that happens after every newline once typing is underway).
    skipAutoFormatting();

    // Reference solutions exist in every language of the toolbar: the language
    // picked there decides which solutions are typed. Keep the editor's syntax
    // mode in sync (without re-triggering the language-change hook below).
    if (langSelect) {
      langSelect.disabled = false;
      const changeLanguage = safe("changeLanguage");
      if (typeof changeLanguage === "function") {
        suppressLangRestart = true;
        try { changeLanguage(); } finally { suppressLangRestart = false; }
      }
    }

    if (monacoContainer) monacoContainer.style.display = "none";
    if (wrap) wrap.classList.add("show");

    const textEl = document.getElementById("type-practice-text");
    if (textEl) textEl.classList.toggle("tp-large-font", !!extra.largeFont);

    updateMethodInfoBar(methods.length > 1);
    renderTypingProgress();
    syncToEditor();
    resetBlinkTimer();

    const hidden = document.getElementById("type-hidden-input");
    if (hidden) hidden.focus();

    if (opts && opts.notify) {
      const toast = safe("toast");
      if (typeof toast === "function") {
        toast("With Code: type the highlighted reference — just like MonkeyType.", "info");
      }
    }
  }

  // ── Mode switching ───────────────────────────────────────────────────────
  function setMode(mode, opts) {
    opts = opts || {};

    // The editor / compilers normally start at idle time; the user has now shown
    // intent, so make sure they are on their way (both calls are idempotent).
    const initMonacoNow = safe("initMonaco");
    if (typeof initMonacoNow === "function") { try { initMonacoNow(); } catch (e) {} }
    const loadCompilers = safe("ensureCompilers");
    if (typeof loadCompilers === "function") loadCompilers();

    document.getElementById("mode-btn-with").classList.toggle("active", mode === "with");
    document.getElementById("mode-btn-without").classList.toggle("active", mode === "without");

    const monacoContainer = document.getElementById("monaco-editor");
    const wrap = document.getElementById("type-practice-wrap");
    const select = document.getElementById("mode-select-screen");
    const methodSelect = document.getElementById("method-select-screen");
    const langSelect = document.getElementById("lang-select");
    const q = safe("currentQuestion");

    if (select) select.classList.remove("show");
    if (methodSelect) methodSelect.classList.remove("show");

    if (mode === "with" && q) {
      const methods = methodsFor(q.id);
      const idx = (typeof opts.methodIndex === "number") ? opts.methodIndex : 0;
      const chosen = methods[idx] || methods[0] || null;

      const hasExplain = chosen && Array.isArray(chosen.explain) &&
        chosen.explain.some((e) => e && e.trim());

      if (hasExplain) {
        // Preview first — the clock does NOT start yet. It only starts once
        // the user clicks Start on the preview (see the ep-start-btn handler
        // in buildUI(), which calls startTypingTest()).
        showExplainPreview(chosen, idx, opts);
      } else {
        // No explain data for this method — behave exactly like before and
        // jump straight into typing.
        startTypingTest(chosen, idx, opts, { largeFont: false });
      }
    } else {
      currentMode = mode;

      // The visible clock and typing-tracker only start counting once the
      // user's first real keystroke lands in the editor — MonkeyType-style —
      // not the instant Without Code is picked.
      resetClockForNewAttempt();
      attachMonacoTimerHook();

      hideExplainPreview();

      if (langSelect) langSelect.disabled = false;
      if (monacoContainer) monacoContainer.style.display = "";
      if (wrap) wrap.classList.remove("show");
      document.getElementById("mode-progress").textContent = "";
      clearTimeout(blinkTimer);
      const caret = document.getElementById("caret");
      if (caret) { caret.classList.remove("tp-caret-show", "tp-caret-blink"); }

      const resetCode = safe("resetCode");
      if (opts.reset !== false && typeof resetCode === "function") resetCode();

      // Monaco was hidden (display:none) while With Code was active, so its
      // internal size cache is stale — force it to re-measure now that it's
      // visible again. Without this its stale layers can sit over the
      // splitter/output panel and swallow clicks.
      relayoutEditor();

      if (opts.notify) {
        const toast = safe("toast");
        if (typeof toast === "function") {
          toast("Without Code: solve this problem in your own way.", "info");
        }
      }
    }
  }

  // Shows the big "With Code" / "Without Code" start screen and hides both
  // the Monaco editor and the typing widget until the user picks one.
  function goIdle() {
    currentMode = "idle";
    autoSubmitted = false;
    selectedMethodName = "";
    selectedMethodIndex = null;
    collapseOutputPanel();

    document.getElementById("mode-btn-with").classList.remove("active");
    document.getElementById("mode-btn-without").classList.remove("active");

    const monacoContainer = document.getElementById("monaco-editor");
    const wrap = document.getElementById("type-practice-wrap");
    const select = document.getElementById("mode-select-screen");
    const methodSelect = document.getElementById("method-select-screen");
    const langSelect = document.getElementById("lang-select");
    const progress = document.getElementById("mode-progress");

    if (monacoContainer) monacoContainer.style.display = "none";
    if (wrap) wrap.classList.remove("show");
    if (methodSelect) methodSelect.classList.remove("show");
    if (select) select.classList.add("show");
    if (langSelect) langSelect.disabled = false;
    if (progress) progress.textContent = "";
    hideExplainPreview();

    clearTimeout(blinkTimer);
    const caret = document.getElementById("caret");
    if (caret) caret.classList.remove("tp-caret-show", "tp-caret-blink");

    // Freeze the visible clock at 00:00 while the start screen is up —
    // the real timer only starts once the user's first keystroke lands
    // after a mode is picked (see startClockOnce()).
    resetClockForNewAttempt();
  }

  patchTimers();
  injectStyles();
  buildOutputSplitter();

  // ── Hook 1: openProblem — build/refresh the UI whenever a problem opens ──
  const _origOpenProblem = window.openProblem;
  if (typeof _origOpenProblem === "function") {
    window.openProblem = function (id) {
      _origOpenProblem(id);
      injectStyles();
      buildUI();
      buildProblemNav();
      updateProblemNav();
      attachMonacoTimerHook();
      // Every freshly-opened problem starts on the big start screen — the
      // user picks With Code or Without Code before anything is shown.
      goIdle();
    };
  }

  // ── Monaco ready: problem pages open instantly (before the editor has
  // downloaded), so if the user already picked a mode, finish wiring it up now.
  document.addEventListener("rocket:monaco-ready", () => {
    attachMonacoTimerHook();
    if (currentMode === "with") syncToEditor();
    relayoutEditor();
  });

  // ── Hook: changeLanguage — With Code follows the language picked in the toolbar.
  // Picking another language while a With Code run is open restarts it with the
  // first reference solution of that language (Try Other Methods lists the rest).
  function restartWithForLanguage() {
    const q = safe("currentQuestion");
    if (!q) return;
    const lang = currentLang();
    if (!methodsFor(q.id, lang).length) {
      const toast = safe("toast");
      if (typeof toast === "function") toast(`No ${LANG_LABELS[lang] || lang} reference solution for this problem yet.`, "info");
      const sel = document.getElementById("lang-select");
      if (sel) sel.value = lastSolLang;
      const changeLanguage = safe("changeLanguage");
      if (typeof changeLanguage === "function") {
        suppressLangRestart = true;
        try { changeLanguage(); } finally { suppressLangRestart = false; }
      }
      return;
    }
    lastSolLang = lang;
    setMode("with", { methodIndex: 0 });
  }
  (function hookChangeLanguage() {
    const orig = window.changeLanguage;
    if (typeof orig !== "function") return;
    window.changeLanguage = function () {
      const result = orig.apply(this, arguments);
      if (suppressLangRestart) return result;
      if (currentMode === "with" || currentMode === "with-preview" || currentMode === "method-select") {
        restartWithForLanguage();
      } else {
        lastSolLang = currentLang();
      }
      return result;
    };
  })();

  // ── Hook 2: runCode — expand the output panel with a smooth slide-up ────
  const _origRunCode = window.runCode;
  if (typeof _origRunCode === "function") {
    window.runCode = function (...args) {
      expandOutputPanel();
      return _origRunCode.apply(this, args);
    };
  }

  // ── Hook 3: resetCode — also clear typing progress and restart the timer ─
  const _origResetCode = window.resetCode;
  if (typeof _origResetCode === "function") {
    window.resetCode = function () {
      _origResetCode();
      if (currentMode === "with") {
        typedText = "";
        typedIndex = 0;
        autoSubmitted = false;
        skipAutoFormatting();
        renderTypingProgress();
      }
      // Reset always drops the clock/tracker back to 00:00, ready to start
      // counting again the moment the user's next real keystroke lands —
      // but only while an attempt is actually in play, not while the start
      // screen, method picker, or explain preview are up.
      if (currentMode !== "idle" && currentMode !== "method-select" && currentMode !== "with-preview") {
        resetClockForNewAttempt();
      }
    };
  }

  // ── Hook 4: closeResult (Try Again) ──────────────────────────────────────
  // With Code   -> start typing over from the first row.
  // Without Code -> leave whatever the user already typed untouched.
  // Either way, the timer/tracker get a genuine fresh start for the retry.
  const _origCloseResult = window.closeResult;
  if (typeof _origCloseResult === "function") {
    window.closeResult = function () {
      _origCloseResult();

      if (currentMode === "with") {
        typedText = "";
        typedIndex = 0;
        autoSubmitted = false;
        skipAutoFormatting();
        renderTypingProgress();
        syncToEditor();
        const hidden = document.getElementById("type-hidden-input");
        if (hidden) hidden.focus();
      }

      resetClockForNewAttempt();
    };
  }

  // ── Hook 5: showResult — add the mode used to the result overlay ────────
  const _origShowResult = window.showResult;
  if (typeof _origShowResult === "function") {
    window.showResult = function (accepted, passed, total, runtime, lang, code, typing) {
      _origShowResult(accepted, passed, total, runtime, lang, code, typing);

      // The attempt is over — stop polling and hide the live WPM circle.
      hideLiveWpm();

      const modeLabel = currentMode === "with" ? "With Code" : "Without Code";

      // Placed directly below the Keystroke Timeline chart in the right
      // column, so it sits in the same visible frame as the graphs.
      const rightCol = document.querySelector(".result-col-right");
      if (rightCol) {
        let card = document.getElementById("res-mode-card");
        if (!card) {
          card = document.createElement("div");
          card.className = "chart-wrap";
          card.id = "res-mode-card";
          card.innerHTML = `<h5>Practice Mode</h5><div class="analytics-val" id="res-mode-val">—</div>`;
          rightCol.appendChild(card);
        }
        const val = document.getElementById("res-mode-val");
        if (val) val.textContent = modeLabel;
      }

      const title = document.getElementById("res-banner-title");
      if (title) {
        let badge = title.querySelector(".res-mode-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "res-mode-badge";
          title.appendChild(badge);
        }
        badge.textContent = modeLabel;
      }

      // "Try Other Methods" — only meaningful when the attempt was solved
      // With Code and the question actually offers more than one approach.
      const actions = document.querySelector(".result-actions");
      if (actions) {
        let btn = document.getElementById("res-try-other-methods");
        const q = safe("currentQuestion");
        const methods = q ? methodsFor(q.id) : [];
        const shouldShow = currentMode === "with" && methods.length > 1;

        if (shouldShow) {
          if (!btn) {
            btn = document.createElement("button");
            btn.id = "res-try-other-methods";
            btn.className = "btn-retry";
            btn.type = "button";
            btn.textContent = "🔀 Try Other Methods";
            btn.addEventListener("click", () => {
              const overlay = document.getElementById("result-overlay");
              if (overlay) overlay.classList.remove("open");
              showMethodSelect();
            });
            actions.insertBefore(btn, actions.firstChild);
          }
        } else if (btn) {
          btn.remove();
        }
      }
    };
  }

})();