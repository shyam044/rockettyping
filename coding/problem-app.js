/**
 * Rocket Typing – Coding Practice
 * coding/problem-app.js  —  the workspace runtime used by EVERY problem page.
 *
 * Each problem page (e.g. print-hello-world-in-python.html) only contains its
 * own SEO content + one small data block:
 *
 *     window.ROCKET_PROBLEM   = { file, h1, question: {...} };
 *     window.__rocketSolutions = { <id>: [ {name, code, explain}, ... ] };
 *
 * This file (editor, run/submit, typing analytics, voice, result screen) is
 * loaded once and cached by the browser — it is never copied into the pages.
 * Needs: coding-core.js (AppState, ProblemIndex, toast, escapeHtml).
 */
"use strict";

/* ══════════════════════════════
   TYPING TRACKER
   Tracks every keystroke in Monaco editor
══════════════════════════════ */
const TypingTracker = (() => {
  let data = {
    keystrokes: 0,
    backspaces: 0,
    startTime: null,
    lastKeyTime: null,
    idleMs: 0,
    pasteDetected: false,
    wpmSamples: [],   // { t (ms from start), wpm }
    ksSamples: [],    // { t, ks }
    intervals: [],    // ms between keystrokes
    charCount: 0,
  };

  function reset() {
    data = {
      keystrokes: 0, backspaces: 0,
      startTime: null, lastKeyTime: null, idleMs: 0,
      pasteDetected: false, wpmSamples: [], ksSamples: [],
      intervals: [], charCount: 0
    };
    _samplerInterval && clearInterval(_samplerInterval);
    _samplerInterval = null;
  }

  let _samplerInterval = null;

  function start() {
    reset();
    data.startTime = Date.now();
    // Sample WPM every 3 seconds
    _samplerInterval = setInterval(() => {
      const elapsed = (Date.now() - data.startTime) / 1000 / 60;
      if (elapsed > 0) {
        const wpm = Math.round(data.charCount / 5 / elapsed);
        const t   = Date.now() - data.startTime;
        data.wpmSamples.push({ t, wpm });
        data.ksSamples.push({ t, ks: data.keystrokes });
      }
    }, 3000);
  }

  function recordKey(key) {
    if (!data.startTime) start();
    const now = Date.now();
    if (data.lastKeyTime) {
      const gap = now - data.lastKeyTime;
      if (gap > 3000) data.idleMs += gap;
      else data.intervals.push(gap);
    }
    data.lastKeyTime = now;
    data.keystrokes++;
    if (key === 'Backspace' || key === 'Delete') data.backspaces++;
    else data.charCount++;
  }

  function recordPaste() { data.pasteDetected = true; }

  function finish() {
    _samplerInterval && clearInterval(_samplerInterval);
    _samplerInterval = null;
    if (!data.startTime) return stats();
    // Final sample
    const elapsed = (Date.now() - data.startTime) / 1000 / 60;
    if (elapsed > 0) {
      data.wpmSamples.push({ t: Date.now() - data.startTime, wpm: Math.round(data.charCount / 5 / elapsed) });
    }
    return stats();
  }

  function stats() {
    const elapsedMs = data.startTime ? (Date.now() - data.startTime) : 0;
    const activeMs  = Math.max(0, elapsedMs - data.idleMs);
    const activeMins = activeMs / 1000 / 60;
    const wpm = activeMins > 0 ? Math.round(data.charCount / 5 / activeMins) : 0;
    const total = data.keystrokes;
    const accuracy = total > 0 ? Math.round(((total - data.backspaces) / total) * 100) : 100;

    // Consistency: 100 - coefficient of variation of intervals
    let consistency = 100;
    if (data.intervals.length > 2) {
      const mean = data.intervals.reduce((a,b)=>a+b,0) / data.intervals.length;
      const variance = data.intervals.reduce((s,v) => s + (v-mean)**2, 0) / data.intervals.length;
      const cv = Math.sqrt(variance) / (mean || 1);
      consistency = Math.max(0, Math.round((1 - Math.min(cv, 1)) * 100));
    }

    return {
      wpm, accuracy, consistency,
      keystrokes: total,
      backspaces: data.backspaces,
      charCount: data.charCount,
      elapsedMs, activeMs, idleMs: data.idleMs,
      pasteDetected: data.pasteDetected,
      wpmSamples: data.wpmSamples,
      ksSamples: data.ksSamples,
    };
  }

  return { reset, start, recordKey, recordPaste, finish, stats };
})();

/* (AppState + ProblemIndex live in coding-core.js) */

/* ══════════════════════════════
   LAZY LOADING  (page speed)
   The 15 compiler files, Chart.js and Monaco are NOT downloaded/executed while the
   page is loading. They start at browser-idle time (or the moment they are needed),
   so the problem text and start screen appear instantly, and they are cached for
   every later problem page.
══════════════════════════════ */
const COMPILER_FILES = ['core-engine', 'adapter-utils', 'python-compiler', 'javascript-compiler', 'typescript-compiler',
  'java-compiler', 'cpp-compiler', 'c-compiler', 'go-compiler', 'rust-compiler', 'kotlin-compiler',
  'swift-compiler', 'csharp-compiler', 'php-compiler', 'ruby-compiler', 'registry'];   // keep this order
const CHARTJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';

function whenIdle(fn, timeout) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, Math.min(timeout, 1500));
}
function loadScripts(urls) {           // parallel download, guaranteed in-order execution
  return Promise.all(urls.map(src => new Promise(resolve => {
    const el = document.createElement('script');
    el.src = src; el.async = false;
    el.onload = el.onerror = () => resolve();
    document.head.appendChild(el);
  })));
}
let compilersPromise = null;
function ensureCompilers() {
  if (!compilersPromise) compilersPromise = loadScripts(COMPILER_FILES.map(f => `${CODING_BASE}../compilers/${f}.js`));
  return compilersPromise;
}
let chartPromise = null;
function ensureChart() {
  if (window.Chart) return Promise.resolve();
  if (!chartPromise) chartPromise = loadScripts([CHARTJS_URL]);
  return chartPromise;
}

/* ══════════════════════════════
   TEST RUNNER
   Every language now runs through CompilerRegistry (compilers/*.js) —
   real self-written tokenizer -> parser -> evaluator per language,
   100% offline, no network calls, no third-party execution APIs.
══════════════════════════════ */
function runTestCasesSmart(lang, code, testCases, onProgress) {
  const results = [];
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    if (onProgress) onProgress(i, testCases.length);
    const start = performance.now();
    const res = CompilerRegistry.run(lang, code, tc.input);
    const ms = performance.now() - start;
    const actual = (res.output || '').trim();
    const expected = (tc.expectedOutput || '').trim();
    const passed = res.ok && (actual === expected);
    results.push({ passed, actual, expected, error: res.error || null, ms: ms.toFixed(1), errorType: res.errorType });
    // A compile/syntax error will fail identically for every remaining
    // test case, so stop early instead of repeating the same failure.
    if (res.errorType === 'CompileError' || res.errorType === 'SyntaxError' || res.errorType === 'ConfigError') {
      for (let j = i + 1; j < testCases.length; j++) {
        results.push({ passed: false, actual: '', expected: (testCases[j].expectedOutput||'').trim(), error: 'Skipped (previous test failed to compile).', ms: '0.0', errorType: res.errorType });
      }
      break;
    }
  }
  return results;
}


/* ══════════════════════════════
   VOICE-TO-CODE
══════════════════════════════ */
const VoiceEngine = (() => {
  let recog = null;
  let active = false;
  let paused = false;
  let onResult = null;

  const REPLACEMENTS = {
    'open bracket':'(', 'close bracket':')', 'open paren':'(',
    'close paren':')', 'open square bracket':'[', 'close square bracket':']',
    'open curly bracket':'{', 'close curly bracket':'}', 'open brace':'{',
    'close brace':'}', 'colon':':', 'semicolon':';', 'comma':',',
    'dot':'.', 'equals':'=', 'double equals':'==', 'not equals':'!=',
    'less than':'<', 'greater than':'>', 'plus':'+', 'minus':'-',
    'times':'*', 'divided by':'/', 'modulo':'%', 'power':'**',
    'new line':'\n', 'newline':'\n', 'tab':'\t', 'space':' ',
    'quote':'"', 'single quote':"'", 'underscore':'_', 'hash':'#',
    'true':'True', 'false':'False', 'none':'None', 'null':'None',
  };

  function processTranscript(txt) {
    let out = txt.toLowerCase();
    // Replace spoken punctuation
    for (const [spoken, sym] of Object.entries(REPLACEMENTS)) {
      out = out.replace(new RegExp(`\\b${spoken}\\b`, 'gi'), sym);
    }
    return out;
  }

  function start(callback) {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast('Speech recognition not supported in this browser.', 'error'); return;
    }
    onResult = callback;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';

    recog.onresult = (evt) => {
      if (paused) return;
      let interim = '';
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const t = evt.results[i][0].transcript;
        if (evt.results[i].isFinal) {
          document.getElementById('mic-transcript').textContent = t;
          onResult(processTranscript(t));
        } else { interim += t; }
      }
      if (interim) document.getElementById('mic-transcript').textContent = interim;
    };
    recog.onerror = (e) => toast(`Mic error: ${e.error}`, 'error');
    recog.onend   = () => { if (active && !paused) recog.start(); }; // keep alive
    recog.start();
    active = true;
  }

  function pause()  { paused = true; }
  function resume() { paused = false; }
  function stop()   { active = false; paused = false; recog && recog.stop(); }

  return { start, pause, resume, stop, isActive: () => active };
})();

/* ══════════════════════════════
   MONACO + EDITOR
══════════════════════════════ */
let monacoEditor = null;
let monacoLoaded = false;

// Every language starts with just a blank comment prompt — no boilerplate,
// no imports, nothing prefilled. The user types their solution from scratch.
const STARTER_CODE = {
  python:     `# start typing here\n`,
  javascript: `// start typing here\n`,
  java:       `// start typing here\n`,
  cpp:        `// start typing here\n`,
  c:          `// start typing here\n`,
  typescript: `// start typing here\n`,
  go:         `// start typing here\n`,
  rust:       `// start typing here\n`,
  kotlin:     `// start typing here\n`,
  swift:      `// start typing here\n`,
  php:        `<?php\n// start typing here\n`,
  csharp:     `// start typing here\n`,
  ruby:       `# start typing here\n`,
};

let monacoInitStarted = false;
function initMonaco() {
  if (monacoInitStarted) return;          // safe to call from anywhere, any number of times
  monacoInitStarted = true;
  require(['vs/editor/editor.main'], () => {
    // Custom Rocket Typing theme
    monaco.editor.defineTheme('rocketDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword',  foreground: 'ffd700', fontStyle: 'bold' },
        { token: 'string',   foreground: '00e6cc' },
        { token: 'number',   foreground: 'ff9900' },
        { token: 'comment',  foreground: '556070', fontStyle: 'italic' },
        { token: 'function', foreground: 'a8d8ff' },
        { token: 'variable', foreground: 'ffffff' },
      ],
      colors: {
        'editor.background':              '#0a0a23',
        'editor.foreground':              '#c9d1d9',
        'editorLineNumber.foreground':    '#3a3a6a',
        'editorLineNumber.activeForeground': '#ffd700',
        'editor.lineHighlightBackground':'#0f0f30',
        'editorCursor.foreground':        '#ffd700',
        'editor.selectionBackground':     '#ffd70030',
        'editorBracketMatch.background':  '#ffd70025',
        'editorBracketMatch.border':      '#ffd700',
        'scrollbarSlider.background':     '#ffd70020',
        'scrollbarSlider.hoverBackground':'#ffd70040',
      }
    });

    monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
      value: STARTER_CODE.python,
      language: 'python',
      theme: 'rocketDark',
      fontSize: 14,
      fontFamily: "'Roboto Mono', monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      renderLineHighlight: 'line',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      automaticLayout: true,
      bracketPairColorization: { enabled: true },
      suggest: { showKeywords: true, showSnippets: true },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      tabSize: 4,
      insertSpaces: true,
      cursorBlinking: 'phase',
      cursorStyle: 'line',
      smoothScrolling: true,
    });

    monacoLoaded = true;

    // Typing tracker integration
    monacoEditor.onKeyDown(e => {
      TypingTracker.recordKey(e.code);
    });

    // Paste detection
    monacoEditor.onDidPaste(() => {
      TypingTracker.recordPaste();
    });

    // Auto-save every 5 seconds
    setInterval(() => {
      if (currentQuestion && monacoEditor) {
        const code = monacoEditor.getValue();
        const lang  = document.getElementById('lang-select').value;
        AppState.setSavedCode(currentQuestion.id, lang, code);
        // Show autosave dot
        const dot = document.getElementById('autosave-dot');
        dot.classList.add('visible');
        setTimeout(() => dot.classList.remove('visible'), 1500);
      }
    }, 5000);

    // Tell the practice engine the editor exists (it may be picked before Monaco finished loading)
    document.dispatchEvent(new CustomEvent('rocket:monaco-ready'));
  });
}

/* ══════════════════════════════
   WORKSPACE TIMER
══════════════════════════════ */
let timerInterval = null;
let timerSeconds  = 0;
let questionStartTime = null;

function startTimer() {
  timerSeconds = 0;
  questionStartTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2,'0');
    const s = String(timerSeconds % 60).padStart(2,'0');
    document.getElementById('workspace-timer').textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() { clearInterval(timerInterval); }

/* ══════════════════════════════
   CHARTS
══════════════════════════════ */
let wpmChart = null;
let ksChart  = null;

function renderCharts(typingStats) {
  if (typeof Chart === 'undefined') return;   // Chart.js failed to load — the numbers above still show
  const wpmCtx = document.getElementById('wpm-chart').getContext('2d');
  const ksCtx  = document.getElementById('ks-chart').getContext('2d');

  if (wpmChart) wpmChart.destroy();
  if (ksChart)  ksChart.destroy();

  const labels = typingStats.wpmSamples.map((_, i) => `${(i+1)*3}s`);
  const wpmData = typingStats.wpmSamples.map(s => s.wpm);
  const ksData  = typingStats.ksSamples.map(s => s.ks);

  // Pad if not enough samples
  const fallbackLabels = ['Start', 'Mid', 'End'];
  const usedLabels = labels.length > 0 ? labels : fallbackLabels;
  const usedWpm    = wpmData.length > 0 ? wpmData : [typingStats.wpm, typingStats.wpm, typingStats.wpm];
  const usedKs     = ksData.length  > 0 ? ksData  : [0, Math.floor(typingStats.keystrokes/2), typingStats.keystrokes];

  wpmChart = new Chart(wpmCtx, {
    type: 'line',
    data: {
      labels: usedLabels,
      datasets: [{ label:'WPM', data: usedWpm,
        borderColor: '#00e6cc', backgroundColor: 'rgba(0,230,204,0.1)',
        tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: '#00e6cc' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color:'#8b949e', font:{size:10} }, grid: { color:'rgba(255,255,255,0.04)' } },
        y: { ticks: { color:'#8b949e', font:{size:10} }, grid: { color:'rgba(255,255,255,0.06)' }, beginAtZero: true }
      }
    }
  });

  ksChart = new Chart(ksCtx, {
    type: 'bar',
    data: {
      labels: usedLabels,
      datasets: [{ label:'Keystrokes', data: usedKs,
        backgroundColor: 'rgba(255,153,0,0.4)', borderColor: '#ff9900', borderWidth: 1, borderRadius: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color:'#8b949e', font:{size:10} }, grid: { color:'rgba(255,255,255,0.04)' } },
        y: { ticks: { color:'#8b949e', font:{size:10} }, grid: { color:'rgba(255,255,255,0.06)' }, beginAtZero: true }
      }
    }
  });
}

/* ══════════════════════════════
   UI HELPERS
══════════════════════════════ */
function setSidebarTab(name, btn) {
  ['desc','notes','hint'].forEach(n => {
    const el = document.getElementById(`sidebar-${n}`);
    if (el) el.style.display = n === name ? 'block' : 'none';
  });
  document.querySelectorAll('.sidebar-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function setOutputTab(name, btn) {
  ['output','testcases','console'].forEach(n => {
    document.getElementById(`output-${n}`).style.display = n === name ? '' : 'none';
  });
  document.querySelectorAll('.output-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ══════════════════════════════
   WORKSPACE
══════════════════════════════ */
let currentQuestion = null;

// Tiny markdown subset used by the problem data: `code`, **bold**, ``` fenced blocks, line breaks.
function mdInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function mdBlock(text) {
  const parts = String(text || '').split(/```\n?/);
  const fenced = parts.length > 1;
  return parts.map((p, i) => {
    if (i % 2 === 1) return `<div class="io-box">${escapeHtml(p.replace(/\n$/, ''))}</div>`;
    const t = fenced ? p.replace(/^\n|\n$/g, '') : p;
    return t ? mdInline(t).replace(/\n/g, '<br>') : '';
  }).join('');
}

// Same markup the build step pre-renders into each problem page's HTML (so search
// engines see the full statement). Only used as a fallback when a page has no
// pre-rendered description.
function descriptionHtml(q, h1) {
  return `
    <div class="prob-meta">
      <h1>#${q.id} ${escapeHtml(h1 || q.title)}</h1>
      <span class="badge ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
      <span class="meta-pill">⏱ ${escapeHtml(q.timeLimit)}</span>
      <span class="meta-pill">💾 ${escapeHtml(q.memoryLimit)}</span>
      <span class="meta-pill">🏷 ${escapeHtml(q.topic)}</span>
      <button onclick="toggleBookmark(${q.id})" id="bm-btn-${q.id}" style="background:none;border:1px solid var(--border);color:var(--text2);padding:4px 10px;border-radius:5px;cursor:pointer;font-size:11px">🔖 Bookmark</button>
    </div>
    <div class="prob-section"><h2>Problem Statement</h2><div class="prob-text">${mdBlock(q.description)}</div></div>
    <div class="prob-section"><h2>Input Format</h2><div class="prob-text">${mdBlock(q.inputFormat)}</div></div>
    <div class="prob-section"><h2>Output Format</h2><div class="prob-text">${mdBlock(q.outputFormat)}</div></div>
    <div class="prob-section"><h2>Constraints</h2><div class="prob-text">${mdBlock(q.constraints)}</div></div>
    <div class="prob-section"><h2>Sample Input</h2><div class="io-box">${escapeHtml(q.sampleInput || '(No input required)')}</div></div>
    <div class="prob-section"><h2>Sample Output</h2><div class="io-box">${escapeHtml(q.sampleOutput)}</div></div>
    <div class="prob-section"><h2>Explanation</h2><div class="prob-text">${mdBlock(q.explanation)}</div></div>
  `;
}

function problemMeta(q) {
  const d = window.ROCKET_PROBLEM || {};
  return { t: q.title, d: q.difficulty, f: d.file || '' };
}

// Called once on page load (with the page's own problem). The practice engine
// hooks this function to build the With Code / Without Code start screen.
function openProblem(id) {
  const data = window.ROCKET_PROBLEM;
  const q = data && data.question;
  if (!q || (id !== undefined && id !== null && id !== q.id)) return;
  currentQuestion = q;

  const desc = document.getElementById('sidebar-desc');
  if (desc && desc.dataset.prerendered !== '1') desc.innerHTML = descriptionHtml(q, data.h1);
  const bm = document.getElementById(`bm-btn-${q.id}`);
  if (bm) bm.textContent = AppState.getBookmark(q.id) ? '🔖 Bookmarked' : '🔖 Bookmark';

  // Hint
  document.getElementById('hint-content').textContent = q.hint || 'No hint available for this problem.';

  // Notes
  document.getElementById('notes-area').value = AppState.getNote(q.id);

  // Restore saved code or use starter
  const lang = document.getElementById('lang-select').value;
  const saved = AppState.getSavedCode(q.id, lang);
  if (monacoEditor) {
    monacoEditor.setValue(saved || STARTER_CODE[lang] || '');
    monaco.editor.setModelLanguage(monacoEditor.getModel(), lang === 'cpp' ? 'cpp' : lang === 'csharp' ? 'csharp' : lang);
  }

  // Clear output
  document.getElementById('output-output').innerHTML = `<div class="output-line dim">Click "Run" to execute against sample test cases.</div>`;
  document.getElementById('output-testcases').innerHTML = `<div class="output-line dim">No test results yet.</div>`;
  document.getElementById('output-console').innerHTML = `<div class="output-line dim">Console output will appear here.</div>`;

  // Reset sidebar tab
  setSidebarTab('desc', document.querySelector('.sidebar-tab'));

  // Start timer & tracker
  startTimer();
  TypingTracker.reset();
  TypingTracker.start();

  AppState.setStatus(q.id, AppState.getStatus(q.id) === 'none' ? 'attempted' : AppState.getStatus(q.id), problemMeta(q));
}


function changeLanguage() {
  if (!currentQuestion || !monacoEditor) return;
  const lang = document.getElementById('lang-select').value;
  const saved = AppState.getSavedCode(currentQuestion.id, lang);
  monacoEditor.setValue(saved || STARTER_CODE[lang] || '');
  const langMap = { csharp:'csharp', cpp:'cpp', typescript:'typescript' };
  monaco.editor.setModelLanguage(monacoEditor.getModel(), langMap[lang] || lang);
}

function resetCode() {
  if (!monacoEditor) return;
  const lang = document.getElementById('lang-select').value;
  monacoEditor.setValue(STARTER_CODE[lang] || '');
  toast('Code reset to starter template.', 'info');
}

function copyCode() {
  if (!monacoEditor) return;
  navigator.clipboard.writeText(monacoEditor.getValue()).then(() => toast('Code copied!', 'success'));
}

function downloadCode() {
  if (!monacoEditor) return;
  const lang = document.getElementById('lang-select').value;
  const ext  = { python:'py', javascript:'js', java:'java', cpp:'cpp', c:'c', typescript:'ts', go:'go', rust:'rs', kotlin:'kt', swift:'swift', php:'php', csharp:'cs', ruby:'rb' };
  const blob = new Blob([monacoEditor.getValue()], { type:'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `solution_${currentQuestion?.id || 'q'}.${ext[lang] || 'txt'}`;
  a.click();
}

function uploadCode() { document.getElementById('file-upload').click(); }

function handleUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    if (monacoEditor) monacoEditor.setValue(e.target.result);
    toast('File uploaded.', 'success');
  };
  reader.readAsText(file);
  evt.target.value = '';
}

function saveNote() {
  if (currentQuestion) AppState.setNote(currentQuestion.id, document.getElementById('notes-area').value);
}

function toggleBookmark(id) {
  const on = AppState.toggleBookmark(id);
  const btn = document.getElementById(`bm-btn-${id}`);
  if (btn) btn.textContent = on ? '🔖 Bookmarked' : '🔖 Bookmark';
  toast(on ? 'Bookmarked!' : 'Bookmark removed.', 'info');
}

/* ── BUTTON BUSY STATE HELPERS ── */
function setBtnBusy(id, busyLabel) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('busy');
  btn.innerHTML = `<span class="btn-spinner"></span> ${busyLabel}`;
}
function clearBtnBusy(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove('busy');
  if (btn.dataset.origLabel) btn.innerHTML = btn.dataset.origLabel;
}

/* ── RUN CODE ──
   Compiles/interprets the REAL language via CompilerRegistry (100%
   against the sample test cases, with live progress feedback. ── */
async function runCode() {
  if (!currentQuestion || !monacoEditor) return;
  const code = monacoEditor.getValue().trim();
  const lang = document.getElementById('lang-select').value;
  const testCases = currentQuestion.testCases || [];

  if (!code) { toast('Write some code first.', 'error'); return; }
  await ensureCompilers();
  if (testCases.length === 0) {
    document.getElementById('output-output').innerHTML = `<div class="output-line warn">No sample test cases defined.</div>`;
    setOutputTab('output', document.querySelector('.output-tab'));
    return;
  }

  AppState.setSavedCode(currentQuestion.id, lang, code);
  setBtnBusy('run-btn', 'Running…');
  document.getElementById('output-output').innerHTML =
    `<div class="output-line running">⏳ Compiling &amp; running your ${langLabel(lang)} code…</div>`;
  setOutputTab('output', document.querySelector('.output-tab'));

  try {
    const startMs = performance.now();
    const results = await runTestCasesSmart(lang, code, testCases, (i, total) => {
      if (total > 1) {
        document.getElementById('output-output').innerHTML =
          `<div class="output-line running">⏳ Running test case ${i+1} / ${total}…</div>`;
      }
    });
    const totalMs = (performance.now() - startMs).toFixed(1);

    // Output tab
    const firstResult = results[0];
    let outputHtml = '';
    if (!firstResult) {
      outputHtml = `<div class="output-line warn">No sample test cases defined.</div>`;
    } else if (firstResult.error) {
      outputHtml = `<div class="output-line error">❌ ${firstResult.errorType || 'Error'}: ${escapeHtml(firstResult.error)}</div>`;
      if (firstResult.output) outputHtml += `<div class="output-line dim">stdout so far:\n${escapeHtml(firstResult.output)}</div>`;
    } else {
      outputHtml = `<div class="output-line ${firstResult.passed ? 'success' : 'error'}">${escapeHtml(firstResult.actual) || '(empty output)'}</div>`;
      outputHtml += `<div class="output-line dim">⏱ ${totalMs}ms · ${langLabel(lang)}</div>`;
    }
    document.getElementById('output-output').innerHTML = outputHtml;

    // Test cases tab
    const tcHtml = results.map((r, i) => `
      <div class="tc-row">
        <span class="tc-idx">${i+1}</span>
        <span class="tc-status ${r.passed ? 'pass' : 'fail'}">${r.passed ? '✅' : '❌'}</span>
        <span class="tc-detail">Expected: <span>${escapeHtml(r.expected)}</span> | Got: <span>${escapeHtml(r.error ? r.error : r.actual)}</span></span>
        <span class="tc-detail" style="text-align:right">${r.ms}ms</span>
      </div>`).join('');
    document.getElementById('output-testcases').innerHTML = tcHtml || '<div class="output-line dim">No test cases.</div>';

    toast(`Run complete. ${results.filter(r=>r.passed).length}/${results.length} passed.`, results.every(r=>r.passed) ? 'success' : 'info');
  } catch (err) {
    document.getElementById('output-output').innerHTML = `<div class="output-line error">❌ Unexpected error: ${escapeHtml(err.message)}</div>`;
  } finally {
    clearBtnBusy('run-btn');
  }
}

/* ── SUBMIT CODE ──
   Runs sample + hidden test cases through the real compiler/interpreter. ── */
async function submitCode() {
  if (!currentQuestion || !monacoEditor) return;
  const code = monacoEditor.getValue().trim();
  const lang = document.getElementById('lang-select').value;

  if (!code) { toast('Write some code first.', 'error'); return; }
  await ensureCompilers();

  const typingStats = TypingTracker.finish();
  stopTimer();

  const allTCs = [...(currentQuestion.testCases||[]), ...(currentQuestion.hiddenTestCases || [])];
  if (allTCs.length === 0) { toast('No test cases defined for this problem.', 'error'); return; }

  setBtnBusy('submit-btn', 'Judging…');
  document.getElementById('output-output').innerHTML =
    `<div class="output-line running">⏳ Compiling &amp; judging your ${langLabel(lang)} submission…</div>`;
  setOutputTab('output', document.querySelector('.output-tab'));

  try {
    const results = await runTestCasesSmart(lang, code, allTCs, (i, total) => {
      document.getElementById('output-output').innerHTML =
        `<div class="output-line running">⏳ Judging test case ${i+1} / ${total}…</div>`;
      const progress = document.getElementById('output-testcases');
      if (progress) progress.innerHTML = `<div class="exec-progress">Judging ${i+1} / ${total}…</div>`;
    });

    const passed    = results.filter(r => r.passed).length;
    const total     = results.length;
    const accepted  = passed === total;
    const runtime   = results.reduce((s,r) => s + parseFloat(r.ms), 0).toFixed(1);

    // Reflect final per-testcase results too, in case the user checks that tab
    const tcHtml = results.map((r, i) => `
      <div class="tc-row">
        <span class="tc-idx">${i+1}</span>
        <span class="tc-status ${r.passed ? 'pass' : 'fail'}">${r.passed ? '✅' : '❌'}</span>
        <span class="tc-detail">Expected: <span>${escapeHtml(r.expected)}</span> | Got: <span>${escapeHtml(r.error ? r.error : r.actual)}</span></span>
        <span class="tc-detail" style="text-align:right">${r.ms}ms</span>
      </div>`).join('');
    document.getElementById('output-testcases').innerHTML = tcHtml || '<div class="output-line dim">No test cases.</div>';

    // Update progress
    if (accepted) {
      AppState.setStatus(currentQuestion.id, 'solved', problemMeta(currentQuestion));
      AppState.bumpStreak();
    } else if (AppState.getStatus(currentQuestion.id) !== 'solved') {
      AppState.setStatus(currentQuestion.id, 'attempted');
    }

    AppState.updateAvgStats(typingStats.wpm, typingStats.accuracy, typingStats.consistency);
    AppState.addSubmission({
      qid: currentQuestion.id,
      title: currentQuestion.title,
      file: (window.ROCKET_PROBLEM || {}).file || '',
      accepted,
      lang,
      passed, total,
      runtime,
      wpm: typingStats.wpm,
      accuracy: typingStats.accuracy,
      date: new Date().toISOString(),
    });

    showResult(accepted, passed, total, runtime, lang, code, typingStats);
  } catch (err) {
    document.getElementById('output-output').innerHTML = `<div class="output-line error">❌ Unexpected error: ${escapeHtml(err.message)}</div>`;
    toast('Submission failed unexpectedly. See Output tab.', 'error');
  } finally {
    clearBtnBusy('submit-btn');
  }
}

/* ── small helpers used above ── */
function langLabel(lang) {
  const opt = document.querySelector(`#lang-select option[value="${lang}"]`);
  return opt ? opt.textContent : lang;
}

/* ══════════════════════════════
   RESULT OVERLAY
══════════════════════════════ */
function showResult(accepted, passed, total, runtime, lang, code, typing) {
  // Banner
  const banner = document.getElementById('res-banner');
  banner.className = `result-status-banner ${accepted ? 'accepted' : 'wrong'}`;
  document.getElementById('res-banner-title').textContent = accepted ? '✅ Accepted' : '❌ Wrong Answer';
  document.getElementById('res-banner-sub').textContent   = `${passed} / ${total} test cases passed · ${runtime}ms`;

  // Stats grid
  const codeLen = code.length;
  document.getElementById('res-grid').innerHTML = `
    <div class="result-stat"><div class="result-stat-val">${passed}/${total}</div><div class="result-stat-lbl">Test Cases</div></div>
    <div class="result-stat cyan-val"><div class="result-stat-val">${runtime}ms</div><div class="result-stat-lbl">Runtime</div></div>
    <div class="result-stat orange-val"><div class="result-stat-val">${lang}</div><div class="result-stat-lbl">Language</div></div>
    <div class="result-stat green-val"><div class="result-stat-val">${codeLen}</div><div class="result-stat-lbl">Characters</div></div>
    <div class="result-stat purple-val"><div class="result-stat-val">${Math.round(typing.activeMs/1000)}s</div><div class="result-stat-lbl">Time Spent</div></div>
    <div class="result-stat"><div class="result-stat-val">${typing.pasteDetected ? '⚠️ Yes' : '✅ No'}</div><div class="result-stat-lbl">Paste Used</div></div>
  `;

  // Paste warning
  document.getElementById('paste-warn').classList.toggle('show', typing.pasteDetected);

  // Typing analytics
  document.getElementById('ra-wpm').textContent  = `${typing.wpm}`;
  document.getElementById('ra-acc').textContent  = `${typing.accuracy}%`;
  document.getElementById('ra-con').textContent  = `${typing.consistency}%`;
  document.getElementById('ra-time').textContent = `${Math.round(typing.activeMs/1000)}s`;
  document.getElementById('ra-ks').textContent   = typing.keystrokes;
  document.getElementById('ra-bs').textContent   = typing.backspaces;

  document.getElementById('result-overlay').classList.add('open');

  // Charts (defer for animation)
  setTimeout(() => ensureChart().then(() => renderCharts(typing)), 100);
}

function closeResult() {
  document.getElementById('result-overlay').classList.remove('open');
  // Restart timer & tracker for retry
  startTimer();
  TypingTracker.reset();
  TypingTracker.start();
}


// "Next Problem →" now goes to the next problem's own page (found via the JSON index).
async function nextProblem() {
  document.getElementById('result-overlay').classList.remove('open');
  if (!currentQuestion) return;
  try {
    const nb = await ProblemIndex.getNeighbors(currentQuestion.id);
    if (nb.next && isSafeFile(nb.next.file)) { window.location.href = nb.next.file; return; }
    toast("🎉 You've reached the last problem!", 'success');
    setTimeout(() => { window.location.href = './#problems'; }, 1200);
  } catch (e) {
    window.location.href = './#problems';
  }
}

/* ══════════════════════════════
   VOICE TO CODE
══════════════════════════════ */
let micOpen = false;

function toggleMic() {
  const btn   = document.getElementById('mic-btn');
  const panel = document.getElementById('mic-panel');

  if (!micOpen) {
    micOpen = true;
    panel.classList.add('open');
    btn.classList.add('listening');
    VoiceEngine.start(text => {
      if (monacoEditor) {
        const pos    = monacoEditor.getPosition();
        const lineNum = pos.lineNumber;
        const col     = pos.column;
        monacoEditor.executeEdits('voice', [{
          range: new monaco.Range(lineNum, col, lineNum, col),
          text: text,
          forceMoveMarkers: true,
        }]);
        toast('Voice inserted.', 'info');
      }
    });
  } else {
    stopMic();
  }
}

function pauseMic()  { VoiceEngine.pause();  toast('Mic paused.', 'info'); }
function resumeMic() { VoiceEngine.resume(); toast('Mic resumed.', 'info'); }
function stopMic() {
  micOpen = false;
  VoiceEngine.stop();
  document.getElementById('mic-btn').classList.remove('listening');
  document.getElementById('mic-panel').classList.remove('open');
  toast('Mic stopped.', 'info');
}

/* ══════════════════════════════
   RELATED PROBLEMS  (internal links under the article — filled from the JSON index)
══════════════════════════════ */
async function renderRelated() {
  const box = document.getElementById('related-problems');
  if (!box || !currentQuestion) return;
  try {
    const nb = await ProblemIndex.getNeighbors(currentQuestion.id);
    const same = nb.list.filter(p => p.id !== currentQuestion.id && p.topic === currentQuestion.topic);
    const picks = [];
    const add = p => { if (p && p.id !== currentQuestion.id && !picks.some(x => x.id === p.id)) picks.push(p); };
    add(nb.prev); add(nb.next);
    same.forEach(add);
    nb.list.forEach(add);
    const items = picks.slice(0, 6).map(p =>
      `<li><a href="${escapeHtml(safeFile(p.file))}">${escapeHtml(p.title)}</a> <span class="badge ${p.difficulty.toLowerCase()}">${escapeHtml(p.difficulty)}</span></li>`
    ).join('');
    if (items) box.innerHTML = `<ul class="related-list">${items}</ul>`;
  } catch (e) { /* the static "all problems" link stays */ }
}

/* ══════════════════════════════
   INIT — runs after every deferred script (compilers, this file, practice-engine)
   has executed, so the engine's hooks on openProblem/runCode/... are in place.
══════════════════════════════ */
function startProblemPage() {
  const data = window.ROCKET_PROBLEM;
  if (!data || !data.question) {
    console.warn('[Rocket Coding] window.ROCKET_PROBLEM is missing on this page.');
    return;
  }
  openProblem(data.question.id);
  renderRelated();
  // Heavy pieces start when the browser is idle (or earlier, when the user picks a mode).
  whenIdle(() => { try { initMonaco(); } catch (e) { console.warn('[Rocket Coding] Monaco failed to load:', e); } }, 1800);
  whenIdle(ensureCompilers, 4000);
}
document.addEventListener('DOMContentLoaded', startProblemPage);

/* ══════════════════════════════
   RocketApp — the only things practice-engine.js is allowed to reach into.
   (Replaces the old eval()-by-name lookup, so no eval() is needed anywhere in the page code.)
══════════════════════════════ */
window.RocketApp = Object.freeze({
  get currentQuestion() { return currentQuestion; },
  get monacoEditor()    { return monacoEditor; },
  get TypingTracker()   { return TypingTracker; },
  get ProblemIndex()    { return ProblemIndex; },
  get toast()           { return toast; },
  get initMonaco()      { return initMonaco; },
  get ensureCompilers() { return ensureCompilers; },
  get changeLanguage()  { return window.changeLanguage; },
  get resetCode()       { return window.resetCode; },
  get stopTimer()       { return window.stopTimer; },
  get submitCode()      { return window.submitCode; },
});
