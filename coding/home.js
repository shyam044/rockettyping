/**
 * Rocket Typing – Coding Practice
 * coding/home.js  —  logic for the coding HOME page (index.html):
 * Dashboard, Problems list (paginated, 100 per JSON file) and Profile.
 *
 * Data comes from coding/data/manifest.json + coding/data/problems-N.json
 * through ProblemIndex (coding-core.js). Only ONE problems-N.json is downloaded
 * at a time; the others load lazily when the visitor changes page or searches.
 *
 * Nothing here needs editing when you add problems — just add the problem's
 * entry to the newest problems-N.json and update manifest.json.
 */
"use strict";

let diffFilter   = "all";
let currentChunk = 1;
let listToken    = 0;      // guards against out-of-order async renders
let searchTimer  = null;

const VIEW_NAV = { dashboard: "nb-dash", problems: "nb-prob", profile: "nb-prof" };

/* ══════════════════════════════
   VIEWS  (#dashboard · #problems · #profile)
══════════════════════════════ */
function showView(name, updateHash = true) {
  if (!VIEW_NAV[name]) name = "problems";
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  Object.values(VIEW_NAV).forEach(id => document.getElementById(id).classList.remove("active"));
  document.getElementById(VIEW_NAV[name]).classList.add("active");

  if (updateHash) { try { history.replaceState(null, "", "#" + name); } catch (e) {} }

  if (name === "dashboard") refreshDashboard();
  if (name === "problems")  filterProblems();
  if (name === "profile")   renderProfile();
}

/* Fills in title / difficulty / link for every problem the visitor has touched
   (older saves only stored ids), loading just the JSON files that contain them. */
async function hydrateMeta() {
  let m;
  try { m = await ProblemIndex.getManifest(); } catch (e) { return null; }
  const ids = new Set([
    ...AppState.statusIds(), ...AppState.bookmarkIds(),
    ...AppState.getSubmissions().map(s => s.qid),
  ]);
  const need = new Set();
  ids.forEach(id => {
    if (!AppState.getMeta(id)) {
      const n = ProblemIndex.chunkNumberForId(m, id);
      if (n !== null) need.add(n);
    }
  });
  if (need.size) {
    const map = {};
    for (const n of need) {
      const list = await ProblemIndex.getChunk(n).catch(() => []);
      list.forEach(p => {
        if (ids.has(p.id) && !AppState.getMeta(p.id)) map[p.id] = { t: p.title, d: p.difficulty, f: p.file };
      });
    }
    AppState.setMetaBulk(map);
  }
  return m;
}

/* ══════════════════════════════
   DASHBOARD
══════════════════════════════ */
async function refreshDashboard() {
  const m = await hydrateMeta();
  const counts = (m && m.difficultyCounts) || { Easy: 0, Medium: 0, Hard: 0 };
  const total  = m ? m.totalProblems : 0;
  document.getElementById("ds-total").textContent = total || "—";

  let solved = 0, attempted = 0, bookmarked = 0;
  let esol = 0, msol = 0, hsol = 0;

  AppState.statusIds().forEach(id => {
    const st = AppState.getStatus(id);
    const meta = AppState.getMeta(id);
    if (st === "solved") {
      solved++;
      if (meta) {
        if (meta.d === "Easy")   esol++;
        if (meta.d === "Medium") msol++;
        if (meta.d === "Hard")   hsol++;
      }
    }
    if (st === "attempted") attempted++;
  });
  bookmarked = AppState.bookmarkIds().length;

  document.getElementById("ds-solved").textContent     = solved;
  document.getElementById("ds-attempted").textContent  = attempted;
  document.getElementById("ds-bookmarked").textContent = bookmarked;

  const pct = total > 0 ? Math.min(100, Math.round(solved / total * 100)) : 0;
  document.getElementById("db-pct").textContent = `${pct}% complete`;
  document.getElementById("db-overall-bar").style.width = pct + "%";

  const easy = counts.Easy || 0, med = counts.Medium || 0, hard = counts.Hard || 0;
  setTimeout(() => {
    document.getElementById("db-easy-bar").style.width = easy > 0 ? `${Math.min(100, esol / easy * 100)}%` : "0%";
    document.getElementById("db-med-bar").style.width  = med  > 0 ? `${Math.min(100, msol / med  * 100)}%` : "0%";
    document.getElementById("db-hard-bar").style.width = hard > 0 ? `${Math.min(100, hsol / hard * 100)}%` : "0%";
  }, 100);
  document.getElementById("db-easy-txt").textContent = `${esol} / ${easy}`;
  document.getElementById("db-med-txt").textContent  = `${msol} / ${med}`;
  document.getElementById("db-hard-txt").textContent = `${hsol} / ${hard}`;

  // Recently solved (one row per problem)
  const seen = new Set();
  const subs = AppState.getSubmissions().filter(s => {
    if (!s.accepted || seen.has(s.qid)) return false;
    seen.add(s.qid); return true;
  }).slice(0, 5);
  const container = document.getElementById("ds-recent-list");
  if (subs.length === 0) {
    container.innerHTML = `<div style="color:var(--text2);font-size:13px;padding:16px 0">No solved problems yet. Start with Problem #1!</div>`;
  } else {
    container.innerHTML = subs.map(s => {
      const meta  = AppState.getMeta(s.qid) || {};
      const title = meta.t || s.title || `Problem #${s.qid}`;
      const diff  = meta.d || "Easy";
      const file  = safeFile(meta.f || s.file);
      const label = file ? `<a href="${escapeHtml(file)}">${escapeHtml(title)}</a>` : escapeHtml(title);
      return `<div class="recent-item">
        <span class="recent-num">#${s.qid}</span>
        <span class="recent-title">${label}</span>
        <span class="recent-badge ${diff.toLowerCase()}">${diff}</span>
        <span class="recent-status solved">Solved</span>
      </div>`;
    }).join("");
  }
}

/* ══════════════════════════════
   PROBLEMS LIST  (one JSON chunk at a time)
══════════════════════════════ */
function setDiffFilter(f) {
  diffFilter = f;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  const map = { all: "f-all", Easy: "f-easy", Medium: "f-medium", Hard: "f-hard" };
  document.querySelector(`.${map[f]}`).classList.add("active");
  filterProblems();
}

function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(filterProblems, 220);
}

function goToChunk(n) {
  currentChunk = n;
  filterProblems();
  const hero = document.querySelector(".problems-hero");
  if (hero) hero.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function filterProblems() {
  const token  = ++listToken;
  const search = document.getElementById("search-input").value.trim().toLowerCase();
  const sort   = document.getElementById("sort-select").value;
  const tbody  = document.getElementById("problems-tbody");

  let list, manifest;
  try {
    manifest = await ProblemIndex.getManifest();
    // Searching needs every problem, so ONLY then are the other JSON files fetched.
    list = search ? await ProblemIndex.loadAll() : await ProblemIndex.getChunk(currentChunk);
  } catch (e) {
    if (token !== listToken) return;
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text2)">
      Couldn't load the problem list. <a href="#problems" class="seo-link" onclick="filterProblems();return false;">Try again</a></td></tr>`;
    return;
  }
  if (token !== listToken) return;

  let qs = list.slice();
  if (diffFilter !== "all") qs = qs.filter(q => q.difficulty === diffFilter);
  if (search) qs = qs.filter(q =>
    q.title.toLowerCase().includes(search) ||
    String(q.id).includes(search) ||
    (q.topic || "").toLowerCase().includes(search)
  );

  if (sort === "diff") {
    const ord = { Easy: 1, Medium: 2, Hard: 3 };
    qs.sort((a, b) => (ord[a.difficulty] || 9) - (ord[b.difficulty] || 9) || a.id - b.id);
  } else if (sort === "solved") {
    const rank = s => s === "solved" ? 0 : s === "attempted" ? 1 : 2;
    qs.sort((a, b) => rank(AppState.getStatus(a.id)) - rank(AppState.getStatus(b.id)) || a.id - b.id);
  } else {
    qs.sort((a, b) => a.id - b.id);
  }

  renderProblemRows(qs);

  const info = document.getElementById("problems-info");
  if (search) {
    info.textContent = `${qs.length} result${qs.length === 1 ? "" : "s"} across all ${manifest.totalProblems} problems`;
  } else {
    const c = manifest.chunks.find(c => c.chunk === currentChunk);
    info.textContent = c ? `Problems #${c.firstId} – #${c.lastId}  ·  ${manifest.totalProblems} problems in total` : "";
  }
  renderPager(manifest, !!search);
}

function renderProblemRows(qs) {
  const tbody = document.getElementById("problems-tbody");
  if (qs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text2)">No problems found.</td></tr>`;
    return;
  }
  tbody.innerHTML = qs.map(q => {
    const st  = AppState.getStatus(q.id);
    const bm  = AppState.getBookmark(q.id);
    const dot = st === "solved" ? "✅" : st === "attempted" ? "🔄" : "⬜";
    const stLabel = st === "solved" ? `<span style="color:var(--green);font-size:11px;font-weight:600">Solved</span>`
                  : st === "attempted" ? `<span style="color:var(--gold2);font-size:11px">Attempted</span>`
                  : `<span style="color:var(--text2);font-size:11px">—</span>`;
    const sub = q.languages ? `${q.languages} languages · ${q.methods} solutions` : "";
    return `<tr data-href="${escapeHtml(q.file)}">
      <td class="prob-num">#${q.id}</td>
      <td class="prob-status-icon">${dot}</td>
      <td><a class="prob-title" href="${escapeHtml(q.file)}">${escapeHtml(q.title)}${bm ? " 🔖" : ""}</a><div class="prob-methods">${sub}</div></td>
      <td><span class="badge ${q.difficulty.toLowerCase()}">${q.difficulty}</span></td>
      <td style="font-size:12px;color:var(--text2)">${escapeHtml(q.topic || "—")}</td>
      <td>${stLabel}</td>
    </tr>`;
  }).join("");
}

function renderPager(manifest, hide) {
  const el = document.getElementById("problems-pager");
  const n  = manifest.chunks.length;
  if (hide || n <= 1) { el.innerHTML = ""; return; }

  const pages = new Set([1, n, currentChunk - 1, currentChunk, currentChunk + 1]);
  const sorted = [...pages].filter(p => p >= 1 && p <= n).sort((a, b) => a - b);
  let html = `<button ${currentChunk === 1 ? "disabled" : ""} data-page="${currentChunk - 1}">◀ Prev</button>`;
  let last = 0;
  sorted.forEach(p => {
    if (p - last > 1) html += `<span class="pager-gap">…</span>`;
    html += `<button class="${p === currentChunk ? "active" : ""}" data-page="${p}">${p}</button>`;
    last = p;
  });
  html += `<button ${currentChunk === n ? "disabled" : ""} data-page="${currentChunk + 1}">Next ▶</button>`;
  el.innerHTML = html;
}

/* ══════════════════════════════
   PROFILE
══════════════════════════════ */
async function renderProfile() {
  await hydrateMeta();
  const subs = AppState.getSubmissions();
  const avg  = AppState.getAvgStats();
  const str  = AppState.getStreak();
  const solved = AppState.statusIds().filter(id => AppState.getStatus(id) === "solved").length;
  const acc  = subs.length > 0 ? Math.round(subs.filter(s => s.accepted).length / subs.length * 100) : 0;

  const langCount = {};
  subs.forEach(s => { langCount[s.lang] = (langCount[s.lang] || 0) + 1; });
  const topLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("pf-stats-grid").innerHTML = `
    <div class="stat-card"><div class="stat-icon">✅</div><div class="stat-value">${solved}</div><div class="stat-label">Problems Solved</div></div>
    <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${subs.length}</div><div class="stat-label">Total Submissions</div></div>
    <div class="stat-card green"><div class="stat-icon">🎯</div><div class="stat-value">${acc}%</div><div class="stat-label">Acceptance Rate</div></div>
    <div class="stat-card cyan"><div class="stat-icon">⌨️</div><div class="stat-value">${avg.wpm || "—"}</div><div class="stat-label">Avg WPM</div></div>
    <div class="stat-card"><div class="stat-icon">✍️</div><div class="stat-value">${avg.accuracy ? avg.accuracy + "%" : "—"}</div><div class="stat-label">Avg Accuracy</div></div>
    <div class="stat-card orange"><div class="stat-icon">🔥</div><div class="stat-value">${str.current}</div><div class="stat-label">Current Streak</div></div>
    <div class="stat-card"><div class="stat-icon">🏆</div><div class="stat-value">${str.longest}</div><div class="stat-label">Longest Streak</div></div>
    <div class="stat-card"><div class="stat-icon">💻</div><div class="stat-value" style="font-size:18px">${topLang ? escapeHtml(topLang[0]) : "—"}</div><div class="stat-label">Fav Language</div></div>
    <div class="stat-card purple-val"><div class="stat-icon">📊</div><div class="stat-value" style="font-size:18px">${avg.consistency ? avg.consistency + "%" : "—"}</div><div class="stat-label">Avg Consistency</div></div>
  `;

  const recent = subs.slice(0, 8);
  document.getElementById("pf-recent").innerHTML = recent.length === 0
    ? `<div style="color:var(--text2);font-size:13px;padding:16px 0">No submissions yet.</div>`
    : recent.map(s => {
        const meta  = AppState.getMeta(s.qid) || {};
        const title = meta.t || s.title || "—";
        const file  = safeFile(meta.f || s.file);
        const label = file ? `<a href="${escapeHtml(file)}">${escapeHtml(title)}</a>` : escapeHtml(title);
        return `<div class="recent-item">
          <span class="recent-num">#${s.qid}</span>
          <span class="recent-title">${label}</span>
          <span class="recent-badge ${s.accepted ? "easy" : "hard"}">${s.accepted ? "Accepted" : "Wrong"}</span>
          <span style="font-size:11px;color:var(--text2)">${escapeHtml(s.lang)} · ${s.wpm || "?"} WPM</span>
        </div>`;
      }).join("");
}

/* ══════════════════════════════
   INIT
══════════════════════════════ */
function initHome() {
  // nav buttons behave as real links (#dashboard …) but switch views in place
  Object.entries(VIEW_NAV).forEach(([view, id]) => {
    document.getElementById(id).addEventListener("click", e => { e.preventDefault(); showView(view); });
  });
  window.addEventListener("hashchange", () => showView(location.hash.replace("#", ""), false));

  // click anywhere on a problem row (the title is also a real <a> for crawlers)
  document.getElementById("problems-tbody").addEventListener("click", e => {
    if (e.target.closest("a")) return;
    const tr = e.target.closest("tr[data-href]");
    if (tr) window.location.href = tr.dataset.href;
  });
  document.getElementById("problems-pager").addEventListener("click", e => {
    const b = e.target.closest("button[data-page]");
    if (b && !b.disabled) goToChunk(parseInt(b.dataset.page, 10));
  });

  // Default landing view is the problem list (best for first-time visitors and search engines).
  showView(location.hash.replace("#", "") || "problems", false);
}
document.addEventListener("DOMContentLoaded", initHome);
