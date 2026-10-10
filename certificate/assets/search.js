/* Rocket Typing - country search. The country list (countries.js) is only downloaded when the person focuses the search box. */
(function () {
  'use strict';
  var D = document, q = D.getElementById('cq'), res = D.getElementById('cres'), grid = D.getElementById('cgrid');
  if (!q || !res) return;
  var data = null, loading = false, waiters = [];

  function load(cb) {
    if (data) return cb();
    waiters.push(cb);
    if (loading) return;
    loading = true;
    var s = D.createElement('script');
    s.src = '/certificate/assets/countries.js?v=4';
    s.onload = function () { data = window.RTC || []; waiters.splice(0).forEach(function (f) { f(); }); };
    s.onerror = function () { loading = false; waiters = []; };
    D.head.appendChild(s);
  }
  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }

  function run() {
    var v = norm(q.value), hits = [], i, c, n, a, rank;
    if (!v) { res.hidden = true; res.innerHTML = ''; if (grid) grid.hidden = false; return; }
    load(function () {
      v = norm(q.value);
      if (!v) return;
      for (i = 0; i < data.length; i++) {
        c = data[i]; n = norm(c[1]); a = norm(c[3] || ''); rank = -1;
        if (n === v || (a && a.split(' ').indexOf(v) > -1)) rank = 0; else if (n.indexOf(v) === 0) rank = 1; else if (n.split(' ').some(function (w) { return w.indexOf(v) === 0; })) rank = 2;
        else if (n.indexOf(v) > -1) rank = 3; else if (a && (' ' + a).indexOf(' ' + v) > -1) rank = 4;
        if (rank > -1) hits.push([rank, i, c]);
      }
      hits.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
      hits = hits.slice(0, 30);
      if (grid) grid.hidden = true;
      res.hidden = false;
      if (!hits.length) { res.innerHTML = '<p class="fine">No country found. Try another spelling.</p>'; return; }
      res.innerHTML = hits.map(function (h) {
        var c = h[2];
        return '<a class="ctile" href="/certificate/' + c[2] + '.html"><span class="fl" data-cc="' + c[0] + '"></span><span><b>' + c[1] + '</b></span></a>';
      }).join('');
      var f = res.querySelectorAll('.fl'), k;
      if (window.RTFlags) for (k = 0; k < f.length; k++) RTFlags.paint(f[k]);
    });
  }

  q.addEventListener('focus', function () { load(function () {}); }, { once: true });
  q.addEventListener('input', run);
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var a = res.querySelector('a'); if (a) { e.preventDefault(); location.href = a.href; } }
  });
  q.addEventListener('search', run);
})();
