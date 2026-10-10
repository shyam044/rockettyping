/* Rocket Typing - certificate typing test engine.
   Metrics (standard, documented on every page):
   Gross WPM = (characters typed / 5) / minutes
   Net WPM   = Gross WPM - (incorrect words / minutes), never below 0
   Accuracy  = (keystrokes - incorrect keystrokes) / keystrokes  (corrected mistakes still count)
   Flow: page loads idle -> Start -> words are generated on click -> timer starts with the first keystroke.
   Country pages ship their own word list in <script id="cw" type="application/json"> and mix it with common words.
   Duration chips: <button> chips (country pages) switch the duration in place; <a> chips are normal links to the duration pages. */
(function () {
  'use strict';
  var D = document, B = D.body, $ = function (i) { return D.getElementById(i); };
  var SECS = +B.dataset.secs || 60, LABEL = B.dataset.label || '1 Minute', BASE = B.dataset.slug || 'typing-test';
  var CC = B.dataset.cc || '', COUNTRY = B.dataset.country || '';
  var WORDS = ('the of and to in is you that it was for on are as with his they at be this from have or by one had not but what all were when we there can an your which their said if do will each about how up out them then she many some so these would other into has more her two like him see time could no make than first been its who now people my made over did down only way find use may water long little very after words called just where most know get through back much before go good new write our me man too any day same right look think also around another came come work three word must because does part even place well such here take why help put different away again off went old number great tell men say small every found still between name should home big give air line set own under read last never us left end along while might next sound below saw something thought both few those always looked show large often together asked house world going want school important until form food keep children feet land side without boy once animal life enough took sometimes four head above kind began almost live page got earth need far hand high year mother light country father let night picture being study second soon story since white ever paper hard near sentence better best across during today however sure knew try told young sun thing whole hear example heard several change answer room sea against top turned learn point city play toward five using himself usually money seen car morning added').split(' ');
  var CW = [];
  try { var ce = $('cw'); if (ce) CW = JSON.parse(ce.textContent) || []; } catch (e) { CW = []; }

  var track = $('track'), inp = $('typing'), passage = $('passage'), dur = $('dur'), R = $('results');
  var timeEl = $('time'), hud = timeEl.parentNode.parentNode, bar = $('bar').firstElementChild;
  var inplace = !!(dur && dur.querySelector('button.chip'));
  var words, spans, idx, cur, last, state, t0, timer, keys, wrong, okW, badW, chars;

  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function esc(c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c; }

  var on = dur && dur.querySelector('.on');
  if (on && on.dataset.secs) { SECS = +on.dataset.secs; LABEL = on.dataset.label; }

  var ov = D.createElement('div'); ov.id = 'ov';
  ov.innerHTML = '<button type="button" class="btn" id="st">START TEST</button>';
  passage.appendChild(ov);

  var mb = D.createElement('span'); mb.className = 'mb';
  mb.innerHTML = '<button type="button" class="lnk" id="rs" hidden>Restart</button>';
  hud.appendChild(mb);

  function pick() {
    var raw;
    do { raw = (CW.length && Math.random() < 0.5) ? CW[Math.random() * CW.length | 0] : WORDS[Math.random() * WORDS.length | 0]; } while (raw === last);
    last = raw; return raw;
  }

  function more() {
    var f = D.createDocumentFragment(), made = false;
    while (words.length < idx + 150) {
      var n = 6 + (Math.random() * 7 | 0);
      for (var i = 0; i < n; i++) {
        var w = pick();
        if (i === 0) w = w[0].toUpperCase() + w.slice(1);
        if (i === n - 1) w += '.';
        words.push(w);
        var s = D.createElement('span'); s.className = 'w'; s.textContent = w;
        f.appendChild(s); spans.push(s); made = true;
      }
    }
    if (made) track.appendChild(f);
  }

  function render(scroll) {
    var t = words[idx], s = spans[idx], h = '', n = Math.max(t.length, cur.length);
    for (var i = 0; i < n; i++) {
      var c = i < cur.length ? (cur[i] === t[i] ? 'ok' : 'bad') : '';
      h += '<i class="' + c + '">' + esc(i < t.length ? t[i] : cur[i]) + '</i>';
    }
    s.innerHTML = h; s.className = 'w cur';
    if (scroll || cur.length > t.length) track.style.transform = 'translateY(-' + Math.max(0, s.offsetTop - s.offsetHeight) + 'px)';
    $('wc').textContent = okW + badW;
    $('ac').textContent = keys ? ((keys - wrong) / keys * 100).toFixed(1) + '%' : '100%';
  }

  function commit(typed) {
    var t = words[idx], ok = typed === t;
    chars += typed.length + 1;
    if (ok) okW++; else badW++;
    spans[idx].textContent = t; spans[idx].className = 'w ' + (ok ? 'ok' : 'bad');
    idx++; cur = ''; more();
  }

  function lock(b) { if (dur) dur.classList.toggle('lock', b); }

  function reset() {
    clearInterval(timer);
    words = []; spans = []; idx = 0; cur = ''; last = ''; state = 'idle'; t0 = 0; timer = 0;
    keys = 0; wrong = 0; okW = 0; badW = 0; chars = 0;
    track.innerHTML = ''; track.style.transform = '';
    inp.value = ''; inp.disabled = true;
    ov.hidden = false; $('rs').hidden = true;
    timeEl.textContent = fmt(SECS); bar.style.width = '0';
    $('wc').textContent = '0'; $('ac').textContent = '100%';
    lock(false);
  }

  function begin() {
    reset(); ov.hidden = true;
    inp.disabled = false; more(); render(true); state = 'ready';
    inp.focus();
    $('rs').hidden = false;
    lock(true);
  }

  function go() { state = 'run'; t0 = performance.now(); timer = setInterval(tick, 100); }

  function tick() {
    var el = (performance.now() - t0) / 1000;
    timeEl.textContent = fmt(SECS - el);
    bar.style.width = Math.min(100, el / SECS * 100) + '%';
    if (el >= SECS) finish();
  }

  inp.addEventListener('input', function () {
    if (state !== 'ready' && state !== 'run') return;
    if (state === 'run' && performance.now() - t0 >= SECS * 1000) { finish(); return; }
    var v = inp.value, t = words[idx], i, typed;
    if (v.indexOf(' ') > -1) {                       /* space = commit the word (also handles mobile keyboards that insert text in bulk) */
      typed = v.replace(/ /g, ''); inp.value = '';
      if (!typed) { cur = ''; render(); return; }
      if (state === 'ready') go();
      for (i = cur.length; i < typed.length; i++) { keys++; if (typed[i] !== t[i]) wrong++; }
      keys++; if (typed.length < t.length) wrong++;
      commit(typed); render(true); return;
    }
    if (v.length > cur.length) {
      if (state === 'ready') go();
      for (i = cur.length; i < v.length; i++) { keys++; if (v[i] !== t[i]) wrong++; }
    }
    cur = v; render();
  });

  ['paste', 'drop', 'cut'].forEach(function (ev) { inp.addEventListener(ev, function (e) { e.preventDefault(); }); });
  inp.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) > -1) e.preventDefault();
  });
  /* Space never scrolls the page while a test is active (and still works normally in the name box and on buttons) */
  D.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && (state === 'ready' || state === 'run') && D.activeElement !== inp) { e.preventDefault(); inp.focus(); }
  });
  passage.addEventListener('click', function () { if (!inp.disabled) inp.focus(); });

  $('st').onclick = function () { R.hidden = true; begin(); };
  $('rs').onclick = function () { R.hidden = true; reset(); };

  /* in-place duration chips (country pages only) */
  if (inplace) dur.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.chip') : null;
    if (!b) return;
    SECS = +b.dataset.secs; LABEL = b.dataset.label;
    for (var i = 0; i < dur.children.length; i++) { var on2 = dur.children[i] === b; dur.children[i].classList.toggle('on', on2); dur.children[i].setAttribute('aria-pressed', on2); }
    if (state === 'idle') timeEl.textContent = fmt(SECS);
  });

  function finish() {
    if (state === 'done') return;
    state = 'done'; clearInterval(timer); inp.disabled = true; lock(false);
    $('rs').hidden = true;
    var t = words[idx];
    if (cur) { chars += cur.length; if (cur === t) okW++; else if (t.indexOf(cur) !== 0) badW++; }
    timeEl.textContent = '0:00'; bar.style.width = '100%';
    var mins = SECS / 60, gross = chars / 5 / mins, net = Math.max(0, gross - badW / mins);
    show({
      slug: BASE + (inplace ? '-' + LABEL.toLowerCase().replace(/\s+/g, '-') : ''), label: LABEL, secs: SECS, net: Math.round(net), gross: Math.round(gross),
      acc: keys ? Math.round((keys - wrong) / keys * 1000) / 10 : 0,
      chars: chars, keys: keys, wrong: wrong, okW: okW, badW: badW, ts: Date.now(),
      cc: CC, country: COUNTRY
    });
  }

  function again() { R.hidden = true; $('test').scrollIntoView({ behavior: 'smooth', block: 'start' }); begin(); }

  function show(d) {
    var lvl = RTCert.level(d.net);
    function row(a, b) { return '<tr><td>' + a + '</td><td>' + b + '</td></tr>'; }
    R.hidden = false;
    R.innerHTML = '<h2>Your result</h2><div class="stats">' +
      '<div class="stat"><b>' + d.net + '</b><span>Net speed (WPM)</span></div>' +
      '<div class="stat"><b>' + d.acc.toFixed(1) + '%</b><span>Accuracy</span></div>' +
      '<div class="stat"><b>' + d.gross + '</b><span>Gross speed (WPM)</span></div></div>' +
      '<table class="dt">' + row('Test duration', d.label) + row('Characters typed (incl. spaces)', d.chars) +
      row('Keystrokes', d.keys) + row('Incorrect keystrokes', d.wrong) + row('Correct words', d.okW) +
      row('Incorrect words', d.badW) + row('Proficiency level', lvl) + '</table>' +
      (d.net > 0 && d.okW > 0
        ? '<h2>Get your typing certificate</h2><form class="cf" id="cf"><label>Full name (as it should appear)' +
          '<input id="nm" maxlength="40" required autocomplete="name" placeholder="e.g. Priya Sharma"></label>' +
          '<button class="btn alt" type="button" id="rt">Retake test</button>' +
          '<button class="btn" type="submit">Generate certificate</button></form>' +
          '<div id="cp"></div><div class="row" id="dl" hidden><button class="btn" id="dp">Download PNG</button>' +
          '<button class="btn alt" id="df">Download PDF</button></div>'
        : '<p class="fine">A certificate is issued when the result is above 0 WPM with at least one correct word. Try again.</p>' +
          '<div class="row"><button class="btn" type="button" id="rt">Retake test</button></div>');

    $('rt').onclick = again;
    var cf = $('cf'), c;
    if (cf) {
      if (RTCert.warm) RTCert.warm();   /* start loading certificate fonts while the person types their name */
      cf.onsubmit = function (e) {
        e.preventDefault();
        var n = $('nm').value.replace(/\s+/g, ' ').trim();
        if (n.length < 2) return;
        RTCert.make(d, n).then(function (cv) {
          c = cv;
          $('cp').innerHTML = '';
          $('cp').appendChild(cv);
          $('dl').hidden = false;
          $('cp').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      };
      $('dp').onclick = function () { RTCert.png(c, d); };
      $('df').onclick = function () { RTCert.pdf(c, d); };
    }
    R.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  reset();
})();
