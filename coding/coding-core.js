/**
 * Rocket Typing – Coding Practice
 * coding/coding-core.js  —  shared by the coding home page AND every problem page.
 *
 *   • AppState      progress / bookmarks / notes / saved code (localStorage)
 *   • ProblemIndex  loads data/manifest.json + data/problems-N.json (100 problems per file)
 *   • toast / escapeHtml / goHome helpers
 *
 * WHY THE JSON IS SPLIT INTO FILES OF 100:
 *   The home page only ever downloads manifest.json (tiny) + ONE problems-N.json
 *   (~25 KB) at a time. Adding problem #5,000 never makes the home page heavier,
 *   so the site stays fast no matter how many problems or visitors you have.
 *   Problem pages fetch just their own chunk (for Prev / Next navigation).
 */
"use strict";

/* ── Base URL of the /coding/ folder (works with or without trailing slash) ── */
const CODING_BASE = (() => {
  try {
    const el = document.currentScript;
    if (el && el.src) return new URL(".", el.src).href;
  } catch (e) { /* fall through */ }
  return new URL("./", window.location.href).href;
})();

/* ══════════════════════════════
   SMALL HELPERS
══════════════════════════════ */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Problem page file names come from JSON / localStorage, so they are validated
   before they are ever used in a link or a redirect (blocks javascript:, //host, ../ …). */
const SAFE_FILE_RE = /^[a-z0-9][a-z0-9-]{0,120}\.html$/;
function isSafeFile(f) { return typeof f === "string" && SAFE_FILE_RE.test(f); }
function safeFile(f)   { return isSafeFile(f) ? f : ""; }

function toast(msg, type = "info") {
  const tc = document.getElementById("toast-container");
  if (!tc) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function goHome() { window.location.href = "/"; }

/* The workspace / problems views size themselves from the real nav height
   instead of a hard-coded 58px, so they still fit correctly if the nav's
   height ever changes (e.g. wrapping on a narrow screen). */
(function watchNavHeight() {
  function apply() {
    const nav = document.querySelector(".nav");
    if (nav) document.documentElement.style.setProperty("--nav-h", nav.offsetHeight + "px");
  }
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    const nav = document.querySelector(".nav");
    if (nav && "ResizeObserver" in window) new ResizeObserver(apply).observe(nav);
    window.addEventListener("resize", apply);
  });
})();

/* ══════════════════════════════
   APP STATE  (persisted in localStorage — same key as before, so existing
   visitors keep all their progress)
══════════════════════════════ */
const AppState = (() => {
  const KEY = "rkt_coding_v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
  }
  function save(st) {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {}
  }

  let state = load();

  // meta = { t: title, d: difficulty, f: file }  — remembered locally so the
  // dashboard / profile can show titles + links WITHOUT downloading every JSON.
  const DIFFS = ["Easy", "Medium", "Hard"];
  function cleanMeta(m) {
    if (!m || typeof m !== "object") return null;
    return { t: String(m.t || "").slice(0, 120), d: DIFFS.includes(m.d) ? m.d : "Easy", f: safeFile(m.f) };
  }
  function getMeta(id)      { return cleanMeta((state.meta || {})[id]); }
  function setMeta(id, m)   { state.meta = state.meta || {}; state.meta[id] = m; save(state); }
  function setMetaBulk(map) { state.meta = state.meta || {}; Object.assign(state.meta, map); save(state); }

  function getStatus(id)    { return (state.statuses || {})[id] || "none"; }   // 'solved'|'attempted'|'none'
  function setStatus(id, s, meta) {
    state.statuses = state.statuses || {};
    state.statuses[id] = s;
    if (meta) { state.meta = state.meta || {}; state.meta[id] = meta; }
    save(state);
  }
  function statusIds()   { return Object.keys(state.statuses || {}).map(Number); }
  function bookmarkIds() { return Object.keys(state.bookmarks || {}).filter(k => state.bookmarks[k]).map(Number); }

  function getBookmark(id)  { return !!(state.bookmarks || {})[id]; }
  function toggleBookmark(id) {
    state.bookmarks = state.bookmarks || {};
    state.bookmarks[id] = !state.bookmarks[id];
    save(state); return state.bookmarks[id];
  }

  function getNote(id)       { return (state.notes || {})[id] || ""; }
  function setNote(id, text) { state.notes = state.notes || {}; state.notes[id] = text; save(state); }

  function getSavedCode(id, lang) { return ((state.codes || {})[id] || {})[lang] || ""; }
  function setSavedCode(id, lang, code) {
    state.codes = state.codes || {};
    state.codes[id] = state.codes[id] || {};
    state.codes[id][lang] = code;
    save(state);
  }

  function addSubmission(sub) {
    state.submissions = state.submissions || [];
    state.submissions.unshift(sub);
    if (state.submissions.length > 100) state.submissions.pop();
    save(state);
  }
  function getSubmissions() { return state.submissions || []; }

  function getStreak() { return state.streak || { current: 0, longest: 0, lastDate: null }; }
  function bumpStreak() {
    const today = new Date().toDateString();
    let s = getStreak();
    if (s.lastDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      if (s.lastDate === yesterday) s.current++;
      else s.current = 1;
      if (s.current > s.longest) s.longest = s.current;
      s.lastDate = today;
      state.streak = s; save(state);
    }
  }

  function getAvgStats() { return state.avgStats || { wpm: 0, accuracy: 0, consistency: 0, count: 0 }; }
  function updateAvgStats(wpm, acc, con) {
    let a = getAvgStats();
    a.count++;
    a.wpm         = Math.round((a.wpm         * (a.count - 1) + wpm) / a.count);
    a.accuracy    = Math.round((a.accuracy    * (a.count - 1) + acc) / a.count);
    a.consistency = Math.round((a.consistency * (a.count - 1) + con) / a.count);
    state.avgStats = a; save(state);
  }

  return { getMeta, setMeta, setMetaBulk, getStatus, setStatus, statusIds, bookmarkIds,
           getBookmark, toggleBookmark, getNote, setNote,
           getSavedCode, setSavedCode, addSubmission, getSubmissions,
           getStreak, bumpStreak, getAvgStats, updateAvgStats };
})();

/* ══════════════════════════════
   PROBLEM INDEX  (data/manifest.json + data/problems-N.json)
══════════════════════════════ */
const ProblemIndex = (() => {
  let manifestPromise = null;
  const chunkPromises = new Map();   // chunk number -> Promise<array of problems>

  async function fetchJson(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  // manifest.json is re-validated on every visit (tiny file) so a newly added
  // problem or chunk shows up immediately; the chunk files are cached by URL
  // (?v=<manifest.version>) and only re-download when you bump "version".
  function getManifest() {
    if (!manifestPromise) {
      manifestPromise = fetchJson(CODING_BASE + "data/manifest.json", { cache: "no-cache" })
        .catch(err => { manifestPromise = null; throw err; });
    }
    return manifestPromise;
  }

  async function getChunk(n) {
    const m = await getManifest();
    const info = m.chunks.find(c => c.chunk === n);
    if (!info) return [];
    if (!chunkPromises.has(n)) {
      const url = `${CODING_BASE}data/${info.file}?v=${encodeURIComponent(m.version || "1")}`;
      chunkPromises.set(n, fetchJson(url)
        .then(d => (d.problems || []).filter(p => p && Number.isInteger(p.id) && isSafeFile(p.file) && ["Easy", "Medium", "Hard"].includes(p.difficulty))
          .sort((a, b) => a.id - b.id))
        .catch(err => { chunkPromises.delete(n); throw err; }));
    }
    return chunkPromises.get(n);
  }

  // Only used when the visitor types in the search box.
  async function loadAll() {
    const m = await getManifest();
    const lists = await Promise.all(m.chunks.map(c => getChunk(c.chunk)));
    return [].concat(...lists);
  }

  function chunkNumberForId(m, id) {
    const c = m.chunks.find(c => id >= c.firstId && id <= c.lastId);
    return c ? c.chunk : null;
  }

  async function findById(id) {
    const m = await getManifest();
    const n = chunkNumberForId(m, id);
    if (n === null) return null;
    const list = await getChunk(n);
    return list.find(p => p.id === id) || null;
  }

  // Previous / next problem around `id` (crosses chunk boundaries automatically).
  async function getNeighbors(id) {
    const m = await getManifest();
    const ci = m.chunks.findIndex(c => id >= c.firstId && id <= c.lastId);
    if (ci === -1) throw new Error("Problem id not listed in manifest");
    const list = await getChunk(m.chunks[ci].chunk);
    const pos = list.findIndex(p => p.id === id);
    let prev = pos > 0 ? list[pos - 1] : null;
    let next = pos < list.length - 1 ? list[pos + 1] : null;
    if (!prev && ci > 0) {
      const l = await getChunk(m.chunks[ci - 1].chunk);
      prev = l[l.length - 1] || null;
    }
    if (!next && ci < m.chunks.length - 1) {
      const l = await getChunk(m.chunks[ci + 1].chunk);
      next = l[0] || null;
    }
    const before = m.chunks.slice(0, ci).reduce((s, c) => s + c.count, 0);
    return { prev, next, position: before + pos + 1, total: m.totalProblems, list };
  }

  return { getManifest, getChunk, loadAll, findById, getNeighbors, chunkNumberForId };
})();
