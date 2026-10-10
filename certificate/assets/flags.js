/* Rocket Typing - country flags drawn as tiny inline SVGs (no image requests, no CDN).
   RTFlags.url(cc) -> data URL, RTFlags.image(cc) -> Promise<Image> (used by the certificate canvas). */
(function () {
  'use strict';
  var F = {}, VB = { ch: '10 0 40 40' };

  function r(x, y, w, h, c) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>'; }
  function star(cx, cy, R, n, fill, extra, rot) {
    var p = [], i, a, rr;
    for (i = 0; i < n * 2; i++) {
      a = Math.PI / n * i - Math.PI / 2 + (rot || 0); rr = i % 2 ? R * (n === 5 ? 0.382 : n === 6 ? 0.577 : 0.45) : R;
      p.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2));
    }
    return '<polygon fill="' + fill + '" ' + (extra || '') + ' points="' + p.join(' ') + '"/>';
  }
  function hs(a) { var h = 40 / a.length, s = ''; a.forEach(function (c, i) { s += r(0, i * h, 60, h + 0.2, c); }); return s; }
  function vs(a) { var w = 60 / a.length, s = ''; a.forEach(function (c, i) { s += r(i * w, 0, w + 0.2, 40, c); }); return s; }
  function uj(x, y, w, h, id) {
    return '<svg x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" viewBox="0 0 60 30" preserveAspectRatio="none">' +
      '<clipPath id="' + id + '"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>' +
      '<path d="M0,0v30h60v-30z" fill="#012169"/>' +
      '<path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>' +
      '<path d="M0,0L60,30M60,0L0,30" clip-path="url(#' + id + ')" stroke="#C8102E" stroke-width="4"/>' +
      '<path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/>' +
      '<path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>';
  }

  F.us = function () {
    var s = r(0, 0, 60, 40, '#b22234'), h = 40 / 13, i, row, c, n;
    for (i = 1; i < 13; i += 2) s += r(0, i * h, 60, h, '#fff');
    s += r(0, 0, 24, h * 7, '#3c3b6e');
    for (row = 0; row < 9; row++) {
      n = row % 2 ? 5 : 6;
      for (c = 0; c < n; c++) s += star((row % 2 ? 4 : 2) + c * 4, (row + 1) * h * 7 / 10, 1.05, 5, '#fff');
    }
    return s;
  };
  F.au = function () {
    return r(0, 0, 60, 40, '#00247d') + uj(0, 0, 30, 20, 'ua') + star(15, 30, 5, 7, '#fff') +
      star(45, 6, 3.2, 7, '#fff') + star(45, 34, 3.2, 7, '#fff') + star(37, 19, 3.2, 7, '#fff') +
      star(53, 15, 3.2, 7, '#fff') + star(49, 25, 1.8, 5, '#fff');
  };
  F.nz = function () {
    var s = r(0, 0, 60, 40, '#00247d') + uj(0, 0, 30, 20, 'un');
    [[45, 8.5], [45, 32], [38, 19], [52, 15.5]].forEach(function (p) { s += star(p[0], p[1], 3, 5, '#cc142b', 'stroke="#fff" stroke-width=".7"'); });
    return s;
  };
  F.gb = function () { return uj(0, 0, 60, 40, 'ug'); };
  F.ca = function () {
    var p = [[0, -11], [1.6, -7.2], [3.4, -8.2], [3, -3.4], [6.4, -5.4], [5.6, -1.8], [9.2, 0], [7.2, 2.2], [7.8, 4.2], [3.6, 3.4], [3.4, 5.6], [0.9, 4.6], [0.9, 10.5],
      [-0.9, 10.5], [-0.9, 4.6], [-3.4, 5.6], [-3.6, 3.4], [-7.8, 4.2], [-7.2, 2.2], [-9.2, 0], [-5.6, -1.8], [-6.4, -5.4], [-3, -3.4], [-3.4, -8.2], [-1.6, -7.2]]
      .map(function (q) { return (30 + q[0]).toFixed(1) + ',' + (20 + q[1] * 0.95).toFixed(1); }).join(' ');
    return r(0, 0, 60, 40, '#fff') + r(0, 0, 15, 40, '#d52b1e') + r(45, 0, 15, 40, '#d52b1e') + '<polygon fill="#d52b1e" points="' + p + '"/>';
  };
  F.de = function () { return hs(['#000', '#dd0000', '#ffce00']); };
  F.fr = function () { return vs(['#0055a4', '#fff', '#ef4135']); };
  F.be = function () { return vs(['#000', '#fae042', '#ed2939']); };
  F.lu = function () { return hs(['#ed2939', '#fff', '#00a1de']); };
  F.nl = function () { return hs(['#ae1c28', '#fff', '#21468b']); };
  F.at = function () { return hs(['#ed2939', '#fff', '#ed2939']); };
  F.ie = function () { return vs(['#169b62', '#fff', '#ff883e']); };
  F.dk = function () { return r(0, 0, 60, 40, '#c8102e') + r(19.5, 0, 6.5, 40, '#fff') + r(0, 17.1, 60, 5.8, '#fff'); };
  F.se = function () { return r(0, 0, 60, 40, '#006aa7') + r(18.75, 0, 7.5, 40, '#fecc00') + r(0, 16, 60, 8, '#fecc00'); };
  F.no = function () {
    return r(0, 0, 60, 40, '#ba0c2f') + r(16.4, 0, 10.9, 40, '#fff') + r(0, 15, 60, 10, '#fff') +
      r(19.1, 0, 5.5, 40, '#00205b') + r(0, 17.5, 60, 5, '#00205b');
  };
  F.fi = function () { return r(0, 0, 60, 40, '#fff') + r(16.7, 0, 10, 40, '#003580') + r(0, 14.5, 60, 11, '#003580'); };
  F.ch = function () { return r(10, 0, 40, 40, '#da291c') + r(26.25, 7.5, 7.5, 25, '#fff') + r(17.5, 16.25, 25, 7.5, '#fff'); };
  F.jp = function () { return r(0, 0, 60, 40, '#fff') + '<circle cx="30" cy="20" r="12" fill="#bc002d"/>'; };
  F.sg = function () {
    var s = r(0, 0, 60, 20, '#ed2939') + r(0, 20, 60, 20, '#fff') +
      '<circle cx="12.5" cy="10" r="7" fill="#fff"/><circle cx="15" cy="10" r="6.3" fill="#ed2939"/>', k, a;
    for (k = 0; k < 5; k++) { a = (-90 + 72 * k) * Math.PI / 180; s += star(25 + 4.5 * Math.cos(a), 10 + 4.5 * Math.sin(a), 1.5, 5, '#fff'); }
    return s;
  };

  F.ad = function () {
    return vs(['#10069f', '#fedd00', '#d50032']).replace(/<rect[^>]*>/g, function (m) { return m; }) +
      '<path d="M25.5,14.5h9v7.5q0,5.2-4.5,7q-4.5-1.800-4.500-7z" fill="#fedd00" stroke="#c8a951" stroke-width=".6"/>' +
      '<path d="M30,14.500v14.500M25.500,19.500h9" stroke="#d50032" stroke-width="1.600"/>';
  };
  F.ar = function () {
    var s = hs(['#74acdf', '#fff', '#74acdf']), k, a;
    for (k = 0; k < 16; k++) { a = k * Math.PI / 8; s += '<path d="M' + (30 + 3.6 * Math.cos(a)).toFixed(2) + ',' + (20 + 3.6 * Math.sin(a)).toFixed(2) + 'L' + (30 + 5.6 * Math.cos(a)).toFixed(2) + ',' + (20 + 5.6 * Math.sin(a)).toFixed(2) + '" stroke="#f6b40e" stroke-width=".8"/>'; }
    return s + '<circle cx="30" cy="20" r="3.8" fill="#f6b40e"/>';
  };
  F.br = function () {
    return r(0, 0, 60, 40, '#009b3a') + '<polygon points="30,4 56,20 30,36 4,20" fill="#fedf00"/><circle cx="30" cy="20" r="9.5" fill="#002776"/>' +
      '<path d="M21,18.2Q30,14.600 39,21.800" stroke="#fff" stroke-width="1.800" fill="none"/>';
  };
  F.cn = function () {
    var s = r(0, 0, 60, 40, '#de2910') + star(10, 10, 6, 5, '#ffde00');
    [[20, 4], [24, 8], [24, 14], [20, 18]].forEach(function (q) { s += star(q[0], q[1], 2, 5, '#ffde00', '', Math.atan2(10 - q[1], 10 - q[0]) + Math.PI / 2); });
    return s;
  };
  F.mx = function () {
    return vs(['#006847', '#fff', '#ce1126']) + '<circle cx="30" cy="20" r="5.500" fill="#a67c3d"/><circle cx="30" cy="20" r="6.800" fill="none" stroke="#2f8f4e" stroke-width="1"/><circle cx="30" cy="19" r="2" fill="#6b4a1e"/>';
  };
  F.sa = function () {
    return r(0, 0, 60, 40, '#006c35') + '<path d="M14,15.500h32" stroke="#fff" stroke-width="3.200" stroke-dasharray="2.500 1 4 1 3 1 5 1 2.500 1 4 1 3 1 2"/>' +
      '<path d="M14,27.500h32" stroke="#fff" stroke-width="1.600"/>' + r(14, 25.8, 3, 3.400, '#fff') + '<path d="M44,26v3h2v-3z" fill="#fff"/>';
  };
  F.za = function () {
    return r(0, 0, 60, 20, '#de3831') + r(0, 20, 60, 20, '#002395') +
      '<path d="M0,0L24,20H60M0,40L24,20" stroke="#fff" stroke-width="13" fill="none"/>' +
      '<path d="M0,0L24,20H60M0,40L24,20" stroke="#007a4d" stroke-width="8" fill="none"/>' +
      '<polygon points="0,3 0,37 17,20" fill="#ffb612"/><polygon points="0,8 0,32 12.500,20" fill="#000"/>';
  };
  F.th = function () {
    var u = 40 / 6;
    return r(0, 0, 60, 40, '#a51931') + r(0, u, 60, u, '#fff') + r(0, 2 * u, 60, 2 * u, '#2d2a4a') + r(0, 4 * u, 60, u, '#fff');
  };

  /* ---- compact flag language for the remaining countries ----
     H/V stripes (color or color*weight), R rect, C circle, S star, P polygon, L line, Q crescent, D half disc,
     O ring of stars, Y small cross, + centred cross, U union jack canton. Palette letters below. */
  var PAL = { w: '#fff', k: '#111', r: '#ce1126', g: '#009a44', b: '#0038a8', y: '#fcd116', o: '#ff7900', l: '#6cb4e4', n: '#00247d', d: '#006a4e' };
  var UID = 0;
  function col(c) { return PAL[c] || c; }
  function cres(cx, cy, R, r, dx, c, rot) {
    var a = Math.abs(dx), t = (R * R - r * r + a * a) / (2 * a), h = Math.sqrt(Math.max(0, R * R - t * t)), sg = dx < 0 ? -1 : 1;
    var d = 'M' + t.toFixed(2) + ',' + (-h).toFixed(2) + 'A' + R + ',' + R + ' 0 ' + (t > 0 ? 1 : 0) + ' 0 ' + t.toFixed(2) + ',' + h.toFixed(2) +
      'A' + r + ',' + r + ' 0 ' + (t < a ? 0 : 1) + ' 1 ' + t.toFixed(2) + ',' + (-h).toFixed(2) + 'Z';
    return '<path d="' + d + '" fill="' + col(c) + '" transform="translate(' + cx + ',' + cy + ') rotate(' + (rot || 0) + ') scale(' + sg + ',1)"/>';
  }
  function stripes(list, vert) {
    var it = list.map(function (x) { var p = x.split('*'); return [col(p[0]), +(p[1] || 1)]; }), tot = 0, pos = 0, s = '';
    it.forEach(function (q) { tot += q[1]; });
    it.forEach(function (q) {
      var len = q[1] / tot * (vert ? 60 : 40);
      s += vert ? r(pos.toFixed(2), 0, (len + 0.2).toFixed(2), 40, q[0]) : r(0, pos.toFixed(2), 60, (len + 0.2).toFixed(2), q[0]);
      pos += len;
    });
    return s;
  }
  function dsl(str) {
    var o = '';
    str.split(';').forEach(function (t) {
      if (!t) return;
      var op = t.charAt(0), a = t.slice(2).split(','), n = a.map(Number), i;
      if (op === 'H') o += stripes(a, false);
      else if (op === 'V') o += stripes(a, true);
      else if (op === 'R') o += r(n[0], n[1], n[2], n[3], col(a[4]));
      else if (op === 'C') o += '<circle cx="' + n[0] + '" cy="' + n[1] + '" r="' + n[2] + '" fill="' + col(a[3]) + '"/>';
      else if (op === 'S') o += star(n[0], n[1], n[2], n[3], col(a[4]));
      else if (op === 'P') o += '<polygon fill="' + col(a[1]) + '" points="' + a[0].split(' ').reduce(function (acc, v, k) { return acc + v + (k % 2 ? ' ' : ','); }, '').trim() + '"/>';
      else if (op === 'L') o += '<path d="M' + a[0] + ',' + a[1] + 'L' + a[2] + ',' + a[3] + '" stroke="' + col(a[5]) + '" stroke-width="' + a[4] + '"/>';
      else if (op === 'Q') o += cres(n[0], n[1], n[2], n[3], n[4], a[5], n[6]);
      else if (op === 'D') o += '<path d="M' + a[2] + ',0A' + a[2] + ',' + a[2] + ' 0 0 1 -' + a[2] + ',0Z" fill="' + col(a[3]) + '" transform="translate(' + a[0] + ',' + a[1] + ') rotate(' + (n[4] || 0) + ')"/>';
      else if (op === 'O') for (i = 0; i < n[3]; i++) o += star(n[0] + n[2] * Math.cos(i / n[3] * 6.2832), n[1] + n[2] * Math.sin(i / n[3] * 6.2832), n[4], 5, col(a[5]));
      else if (op === 'Y') o += r(n[0] - n[2] / 2, n[1] - n[3] / 2, n[2], n[3], col(a[4])) + r(n[0] - n[3] / 2, n[1] - n[2] / 2, n[3], n[2], col(a[4]));
      else if (op === '+') o += r(30 - n[1] / 2, 0, n[1], 40, col(a[0])) + r(0, 20 - n[1] / 2, 60, n[1], col(a[0]));
      else if (op === 'U') o += uj(n[0], n[1], n[2], n[3], 'u' + (UID++));
    });
    return o;
  }
  var DD = {
    af: 'V:k,r,g;C:30,20,5.5,w',
    al: 'R:0,0,60,40,#e41e20;P:30 8 25 14 27 16 23 18 26 22 24 26 30 24 36 26 34 22 37 18 33 16 35 14,k',
    dz: 'V:g,w;Q:30,20,9.5,7.6,2.8,r;S:34,20,3.6,5,r',
    ao: 'H:r,k;C:30,20,6.5,y;S:30,20,3,5,r',
    ag: 'R:0,0,60,40,r;P:0 0 60 0 50 13.3 10 13.3,k;P:10 13.3 50 13.3 40 26.6 20 26.6,#0072c6;P:20 26.6 40 26.6 30 40,w;C:30,7,4,y',
    am: 'H:#d90012,#0033a0,#f2a800',
    az: 'H:#00b5e2,#ef3340,#509e2f;Q:26.5,20,5.5,4.4,1.4,w;S:32,20,2.3,8,w',
    bs: 'H:#00778b,#fcd116,#00778b;P:0 0 0 40 26 20,k',
    bh: 'R:0,0,60,40,#ce1126;P:0 0 14 0 20 4 14 8 20 12 14 16 20 20 14 24 20 28 14 32 20 36 14 40 0 40,w',
    bd: 'R:0,0,60,40,#006a4e;C:27,20,12,#f42a41',
    bb: 'V:#00267f,#ffc726,#00267f;L:30,11,30,29,1.6,k;L:25.5,13,25.5,20,1.2,k;L:34.5,13,34.5,20,1.2,k',
    by: 'H:#cf101a*2,#4aa657*1;R:0,0,6,40,w;P:3 4 5 7 3 10 1 7,#cf101a;P:3 16 5 19 3 22 1 19,#cf101a;P:3 28 5 31 3 34 1 31,#cf101a',
    bz: 'R:0,0,60,40,#003f87;R:0,0,60,4,#ce1126;R:0,36,60,4,#ce1126;C:30,20,12,w;C:30,20,9,#2e8b57',
    bj: 'R:0,0,60,40,#e8112d;R:0,0,60,20,#fcd116;R:0,0,22,40,#008751',
    bt: 'P:0 0 60 0 0 40,#ffd520;P:60 0 60 40 0 40,#ff6a00;C:30,20,5,w',
    bo: 'H:#d52b1e,#f9e300,#007934',
    ba: 'R:0,0,60,40,#002395;P:15 0 45 0 45 40,#fecb00;S:11,6,1.6,5,w;S:15,11,1.6,5,w;S:19,16,1.6,5,w;S:23,21,1.6,5,w;S:27,26,1.6,5,w',
    bw: 'R:0,0,60,40,#75aadb;R:0,15.5,60,9,w;R:0,17,60,6,k',
    bn: 'R:0,0,60,40,#f7e017;P:0 6 0 16 60 34 60 24,w;P:0 16 0 24 60 40 60 34,k;C:30,20,5,#cf1126',
    bg: 'H:w,#00966e,#d62612',
    bf: 'H:#ef2b2d,#009e49;S:30,20,7,5,y',
    bi: 'R:0,0,60,40,#ce1126;P:0 0 30 20 0 40,#1eb53a;P:60 0 30 20 60 40,#1eb53a;L:0,0,60,40,5,w;L:60,0,0,40,5,w;C:30,20,9,w;S:30,16.5,2,5,#ce1126;S:27,22,2,5,#ce1126;S:33,22,2,5,#ce1126',
    cv: 'R:0,0,60,40,#003893;R:0,22,60,3,w;R:0,25,60,3,#cf2027;R:0,28,60,3,w;O:20,26.5,7,10,1.1,y',
    kh: 'H:#032ea1*1,#e00025*2,#032ea1*1;P:22 25 22 19 26 19 26 15 30 12 34 15 34 19 38 19 38 25,w',
    cm: 'V:#007a5e,#ce1126,#fcd116;S:30,20,5,5,y',
    cf: 'H:#003082,w,#289728,#ffce00;R:26,0,8,40,#d21034;S:8,6,4,5,y',
    td: 'V:#002664,#fecb00,#c60c30',
    cl: 'R:0,0,60,20,w;R:0,20,60,20,#d52b1e;R:0,0,20,20,#0039a6;S:10,10,5,5,w',
    co: 'H:#fcd116*2,#003893*1,#ce1126*1',
    km: 'H:#ffc61e,w,#ce1126,#3a75c4;P:0 0 0 40 30 20,#3d8e33;Q:8,20,6,5,1.6,w',
    cg: 'R:0,0,60,40,#fbde4a;P:0 0 40 0 0 40,#009543;P:60 0 60 40 20 40,#dc241f',
    cd: 'R:0,0,60,40,#007fff;L:0,40,60,0,9,y;L:0,40,60,0,6,#ce1021;S:8,8,5,5,y',
    cr: 'H:#002b7f*1,w*1,#ce1126*2,w*1,#002b7f*1',
    hr: 'H:#ff0000,w,#171796;R:25,13,10,12,#e0131c;R:25,13,2.5,3,w;R:30,13,2.5,3,w;R:27.5,16,2.5,3,w;R:32.5,16,2.5,3,w;R:25,19,2.5,3,w;R:30,19,2.5,3,w',
    cu: 'H:#002a8f,w,#002a8f,w,#002a8f;P:0 0 0 40 34.6 20,#cf142b;S:11,20,6,5,w',
    cy: 'R:0,0,60,40,w;P:17 22 22 18 30 17 40 16 44 19 38 22 30 24 22 25,#d57800;L:23,29,37,29,1.5,#4e5b31',
    cz: 'H:w,#d7141a;P:0 0 0 40 30 20,#11457e',
    dj: 'H:#6ab2e7,#12ad2b;P:0 0 0 40 30 20,w;S:10,20,4,5,#d7141a',
    dm: 'R:0,0,60,40,#006b3f;+:y,6;+:k,4;+:w,2;C:30,20,8,r',
    do: 'R:0,0,60,40,#002d62;R:30,0,30,20,#ce1126;R:0,20,30,20,#ce1126;+:w,6',
    ec: 'H:#ffdd00*2,#034ea2*1,#ed1c24*1;C:30,20,5,#9c7a2c',
    eg: 'H:#ce1126,w,k;C:30,20,3.5,#c09300',
    sv: 'H:#0f47af,w,#0f47af;C:30,20,5.5,#f2c500',
    gq: 'H:#3e9a00,w,#e32118;P:0 0 0 40 14 20,#0073ce;C:30,20,2.5,#7b5b3b',
    er: 'R:0,0,60,20,#12ad2b;R:0,20,60,20,#4189dd;P:0 0 0 40 60 20,#ea0437;C:14,20,4,#ffc726',
    ee: 'H:#0072ce,k,w',
    sz: 'H:#3e5eb9*1,#ffd900*0.4,#b10c0c*2.2,#ffd900*0.4,#3e5eb9*1;R:18,17,24,6,k;R:18,19,24,2,w',
    et: 'H:#078930,#fcdd09,#da121a;C:30,20,8.5,#0f47af;S:30,20,6,5,#fcdd09',
    fj: 'R:0,0,60,40,#68bfe5;U:0,0,30,20;R:38,12,14,16,w;R:38,12,14,5,r',
    ga: 'H:#009e60,#fcd116,#3a75c4',
    gm: 'H:r*6,w*1,#0c1c8c*4,w*1,#3a7728*6',
    ge: 'R:0,0,60,40,w;+:#ff0000,8;Y:14,10,7,2,#ff0000;Y:46,10,7,2,#ff0000;Y:14,30,7,2,#ff0000;Y:46,30,7,2,#ff0000',
    gh: 'H:#ce1126,#fcd116,#006b3f;S:30,20,7,5,k',
    gr: 'H:#0d5eaf,w,#0d5eaf,w,#0d5eaf,w,#0d5eaf,w,#0d5eaf;R:0,0,22.2,22.2,#0d5eaf;R:8.9,0,4.4,22.2,w;R:0,8.9,22.2,4.4,w',
    gd: 'R:0,0,60,40,#ce1126;P:5 4 55 4 30 20,#fcd116;P:5 36 55 36 30 20,#fcd116;P:5 4 30 20 5 36,#007a5e;P:55 4 30 20 55 36,#007a5e;C:30,20,5,r;S:30,20,3.5,5,y',
    gt: 'V:#4997d0,w,#4997d0;C:30,20,5,#5b8a3c',
    gn: 'V:#ce1126,#fcd116,#009460',
    gw: 'R:0,0,60,40,#009e49;R:0,0,60,20,#fcd116;R:0,0,20,40,#ce1126;S:10,20,6,5,k',
    gy: 'R:0,0,60,40,#009e49;P:0 0 60 20 0 40,w;P:0 1.8 55 20 0 38.2,#fcd116;P:0 0 30 20 0 40,k;P:0 2 24 20 0 38,#ce1126',
    ht: 'H:#00209f,#d21034;R:23,14,14,12,w;C:30,20,3,#2e8b57',
    hn: 'H:#0073cf,w,#0073cf;S:30,20,1.8,5,#0073cf;S:25,19,1.8,5,#0073cf;S:35,19,1.8,5,#0073cf;S:26.5,22,1.8,5,#0073cf;S:33.5,22,1.8,5,#0073cf',
    hu: 'H:#ce2939,w,#477050',
    is: 'R:0,0,60,40,#02529c;R:16,0,10,40,w;R:0,15,60,10,w;R:19,0,4,40,#dc1e35;R:0,18,60,4,#dc1e35',
    in: 'H:#ff9933,w,#138808;C:30,20,5.2,#000080;C:30,20,4.2,w;C:30,20,1,#000080',
    id: 'H:#ff0000,w',
    ir: 'H:#239f40,w,#da0000;C:30,20,3.5,#da0000',
    iq: 'H:#ce1126,w,k;R:20,19,20,2,#007a3d',
    il: 'R:0,0,60,40,w;R:0,4,60,5,#0038b8;R:0,31,60,5,#0038b8;S:30,20,7,6,#0038b8',
    it: 'V:#009246,w,#ce2b37',
    ci: 'V:#f77f00,w,#009e60',
    jm: 'R:0,0,60,40,#009b3a;P:0 0 30 20 0 40,k;P:60 0 30 20 60 40,k;L:0,0,60,40,6,#fed100;L:60,0,0,40,6,#fed100',
    jo: 'H:k,w,#007a3d;P:0 0 0 40 30 20,#ce1126;S:10,20,3,7,w',
    kz: 'R:0,0,60,40,#00afca;C:30,18,6,#fec50c;L:12,31,48,31,1.5,#fec50c',
    ke: 'R:0,0,60,40,#006600;R:0,0,60,26.6,#bb0000;R:0,0,60,13.3,k;R:0,12.5,60,1.6,w;R:0,26,60,1.6,w;C:30,20,7.5,#bb0000;C:30,20,3,w',
    ki: 'R:0,0,60,40,#ce1126;C:30,24,7,y;R:0,24,60,16,#003f87;R:0,27,60,2,w;R:0,31,60,2,w;R:0,35,60,2,w',
    kw: 'H:#007a3d,w,#ce1126;P:0 0 14 13.3 14 26.7 0 40,k',
    kg: 'R:0,0,60,40,#e8112d;C:30,20,9,#ffef00;C:30,20,5.5,#e8112d',
    la: 'H:#ce1126*1,#002868*2,#ce1126*1;C:30,20,6.5,w',
    lv: 'H:#9e3039*2,w*1,#9e3039*2',
    lb: 'H:r*1,w*2,r*1;P:30 12 25 24 35 24,#00a651;R:29,24,2,4,#6b4423',
    ls: 'H:#00209f,w,#009543;P:30 14 26 24 34 24,k',
    lr: 'H:r,w,r,w,r,w,r,w,r,w,r;R:0,0,18,18.2,#002868;S:9,9.1,6,5,w',
    ly: 'H:#e70013*1,k*2,#239e46*1;Q:29,20,5.5,4.5,1.5,w;S:33,20,2.2,5,w',
    li: 'H:#002b7f,#ce1126;R:8,6,8,6,#ffd83d',
    lt: 'H:#fdb913,#006a44,#c1272d',
    mg: 'R:0,0,60,40,#fc3d32;R:0,20,60,20,#007e3a;R:0,0,20,40,w',
    mw: 'R:0,0,60,40,#339e35;R:0,0,60,13.3,k;C:30,13.3,5.5,#ce1126;R:0,13.3,60,13.3,#ce1126',
    my: 'H:r,w,r,w,r,w,r,w,r,w,r,w,r,w;R:0,0,30,22.86,#010066;Q:12,11.4,7,5.7,1.6,y;S:19,11.4,4.5,14,y',
    mv: 'R:0,0,60,40,#d21034;R:10,8,40,24,#007e3a;Q:30,20,7,5.8,2,w',
    ml: 'V:#14b53a,#fcd116,#ce1126',
    mt: 'V:w,#cf142b;R:2,2,6,6,#999',
    mh: 'R:0,0,60,40,#003893;P:0 40 60 4 60 14,w;P:0 40 60 14 60 24,#dd7500;S:12,10,6,12,w',
    mr: 'R:0,0,60,40,#00a95c;R:0,0,60,5,#d01c1f;R:0,35,60,5,#d01c1f;Q:30,19,9,7.5,2.5,#ffd700,-90;S:30,13,2.8,5,#ffd700',
    mu: 'H:#ea2839,#1a206d,#ffd500,#00a551',
    fm: 'R:0,0,60,40,#75b2dd;S:30,9,3.5,5,w;S:30,31,3.5,5,w;S:19,20,3.5,5,w;S:41,20,3.5,5,w',
    md: 'V:#0046ae,#ffd200,#cc092f;C:30,20,5,#a0522d',
    mc: 'H:#ce1126,w',
    mn: 'V:#c4272f,#015197,#c4272f;R:9,10,2,16,#f9cf02;C:10,12,2.2,#f9cf02',
    me: 'R:0,0,60,40,#d4af37;R:2,2,56,36,#c40308;C:30,20,6,#d4af37',
    ma: 'R:0,0,60,40,#c1272d;S:30,20,9,5,#006233;S:30,20,4,5,#c1272d',
    mz: 'R:0,0,60,40,#fce100;R:0,0,60,12.5,#007168;R:0,12.5,60,1.5,w;R:0,14,60,12,k;R:0,26,60,1.5,w;P:0 0 0 40 24 20,#d21034;S:8,20,5,5,y',
    mm: 'H:#fecb00,#34b233,#ea2839;S:30,21,11,5,w',
    na: 'R:0,0,60,40,#009543;P:0 0 60 0 0 40,#003580;L:0,40,60,0,13,w;L:0,40,60,0,9,#d21034;S:10,10,5,12,#ffce00',
    nr: 'R:0,0,60,40,#002b7f;R:0,19,60,2,#ffc61e;S:14,30,5,12,w',
    np: 'P:3 0 37 19.5 15 19.5 37 40 3 40,#003893;P:6 6.5 29 17.5 11 17.5 30 36 6 36,#dc143c;C:12,20,2,w',
    ni: 'H:#0067c6,w,#0067c6;C:30,20,4.5,#e6c200',
    ne: 'H:#e05206,w,#0db02b;C:30,20,5,#e05206',
    ng: 'V:#008751,w,#008751',
    kp: 'H:#024fa2*6,w*1,#ed1c27*18,w*1,#024fa2*6;C:20,20,8,w;S:20,20,7,5,#ed1c27',
    mk: 'R:0,0,60,40,#d20000;L:30,20,0,0,2,y;L:30,20,60,0,2,y;L:30,20,0,40,2,y;L:30,20,60,40,2,y;L:30,20,30,0,2,y;L:30,20,30,40,2,y;L:30,20,0,20,2,y;L:30,20,60,20,2,y;C:30,20,7,#d20000;C:30,20,5.5,#ffe600',
    om: 'R:0,0,60,40,#db161b;R:0,0,60,13.3,w;R:0,26.6,60,13.3,#008000;R:0,0,18,40,#db161b;C:9,7,3,w',
    pk: 'R:0,0,60,40,#01411c;R:0,0,15,40,w;Q:37,20,9,7.5,2.5,w,-25;S:42,15,3,5,w',
    pw: 'R:0,0,60,40,#4aadd6;C:26,20,11,#ffde00',
    pa: 'R:0,0,60,40,w;R:30,0,30,20,#d21034;R:0,20,30,20,#005293;S:15,10,5,5,#005293;S:45,30,5,5,#d21034',
    pg: 'R:0,0,60,40,k;P:0 0 60 0 60 40,#ce1126;C:44,12,5,#fcd116;S:8,26,2.2,5,w;S:14,32,2.2,5,w;S:20,27,2.2,5,w',
    py: 'H:#d52b1e,w,#0038a8;C:30,20,5,#6c8f3d',
    pe: 'V:#d91023,w,#d91023',
    ph: 'H:#0038a8,#ce1126;P:0 0 0 40 35 20,w;C:11,20,4,#fcd116',
    pl: 'H:w,#dc143c',
    pt: 'R:0,0,60,40,#ff0000;R:0,0,24,40,#006600;C:24,20,7,#ffe000;C:24,20,5,#ff0000;C:24,20,3,w',
    qa: 'R:0,0,60,40,#8a1538;P:0 0 22 0 28 3.6 22 7.2 28 10.8 22 14.4 28 18 22 21.6 28 25.2 22 28.8 28 32.4 22 36 28 38 22 40 0 40,w',
    ro: 'V:#002b7f,#fcd116,#ce1126',
    ru: 'H:w,#0039a6,#d52b1e',
    rw: 'R:0,0,60,40,#00a1de;R:0,20,60,10,#fad201;R:0,30,60,10,#20603d;C:48,9,4,#e5be01',
    kn: 'R:0,0,60,40,#ce1126;P:0 0 60 0 0 40,#009e49;L:0,40,60,0,12,y;L:0,40,60,0,9,k;S:22,23,2.8,5,w;S:38,17,2.8,5,w',
    lc: 'R:0,0,60,40,#66ccff;P:30 7 45 33 15 33,w;P:30 7 43 33 17 33,k;P:30 18 45 33 15 33,#fcd116',
    vc: 'V:#0072c6*1,#fcd116*2,#009e60*1;P:30 10 33 15 30 20 27 15,#009e60;P:24 20 27 25 24 30 21 25,#009e60;P:36 20 39 25 36 30 33 25,#009e60',
    ws: 'R:0,0,60,40,#ce1126;R:0,0,30,20,#002b7f;S:15,4.5,2.2,5,w;S:9,9,2.2,5,w;S:21,8,2.2,5,w;S:13,14.5,2.2,5,w;S:22,14,2.2,5,w',
    sm: 'H:w,#5eb6e4;C:30,20,4,#c9a227',
    st: 'H:#12ad2b,#ffce00*2,#12ad2b;P:0 0 0 40 20 20,#d21034;S:30,20,5,5,k;S:44,20,5,5,k',
    sn: 'V:#00853f,#fdef42,#e31b23;S:30,20,6,5,#00853f',
    rs: 'H:#c6363c,#0c4076,w;R:10,11,8,12,#c6363c',
    sc: 'R:0,0,60,40,#007a3d;P:0 40 0 0 20 0,#003f87;P:0 40 20 0 40 0,#fcd856;P:0 40 40 0 60 0 60 13.3,#d62828;P:0 40 60 13.3 60 26.6,w',
    sl: 'H:#1eb53a,w,#0072c6',
    sk: 'H:w,#0b4ea2,#ee1c25;R:10,10,12,16,#ee1c25;R:15,13,2,10,w;R:12,17,8,2,w',
    si: 'H:w,#005da4,#ed1c24;R:8,6,8,10,#005da4',
    sb: 'R:0,0,60,40,#215b33;P:0 0 60 0 0 40,#0051ba;L:0,40,60,0,2,#fcd116;S:8,6,2,5,w;S:15,6,2,5,w;S:11.5,10,2,5,w;S:8,14,2,5,w;S:15,14,2,5,w',
    so: 'R:0,0,60,40,#4189dd;S:30,20,10,5,w',
    kr: 'R:0,0,60,40,w;C:30,20,10,#cd2e3a;D:30,20,10,#0047a0,0;L:9,8,14,13,2.4,k;L:46,32,51,27,2.4,k;L:46,8,51,13,2.4,k;L:9,32,14,27,2.4,k',
    ss: 'R:0,0,60,40,#078930;R:0,0,60,26.6,#da121a;R:0,0,60,13.3,k;R:0,12.4,60,1.6,w;R:0,26,60,1.6,w;P:0 0 0 40 26 20,#0f47af;S:8,20,5,5,#fcdd09',
    es: 'H:#aa151b*1,#f1bf00*2,#aa151b*1',
    lk: 'R:0,0,60,40,#ffbe29;R:4,4,10,32,#00534e;R:15,4,8,32,#eb7400;R:25,4,31,32,#8d153a',
    sd: 'H:#d21034,w,k;P:0 0 0 40 24 20,#007229',
    sr: 'H:#377e3f*2,w*0.5,#b40a2d*4,w*0.5,#377e3f*2;S:30,20,7,5,#ecc81d',
    sy: 'H:#ce1126,w,k;S:20,20,3,5,#007a3d;S:40,20,3,5,#007a3d',
    tj: 'H:#cc0000*2,w*3,#006600*2;C:30,20,3,#f8c300',
    tz: 'R:0,0,60,40,#1eb53a;P:60 0 60 40 0 40,#00a3dd;L:0,40,60,0,12,#fcd116;L:0,40,60,0,8,k',
    tl: 'R:0,0,60,40,#dc241f;P:0 0 0 40 40 20,#ffc726;P:0 0 0 40 20 20,k;S:7,20,5,5,w',
    tg: 'H:#006a4e,#ffce00,#006a4e,#ffce00,#006a4e;R:0,0,24,24,#d21034;S:12,12,7,5,w',
    to: 'R:0,0,60,40,#c10000;R:0,0,24,20,w;R:10,3,4,14,#c10000;R:5,8,14,4,#c10000',
    tt: 'R:0,0,60,40,#ce1126;L:0,0,60,40,12,w;L:0,0,60,40,8,k',
    tn: 'R:0,0,60,40,#e70013;C:30,20,12,w;C:30,20,8.5,#e70013;C:31.5,20,7,w;S:32,20,4,5,#e70013',
    tr: 'R:0,0,60,40,#e30a17;C:22,20,10,w;C:25,20,8,#e30a17;S:34,20,4,5,w',
    tm: 'R:0,0,60,40,#00843d;R:6,0,9,40,#d22630;Q:26,9,5,4.1,1.5,w,-30;S:31,8,1.5,5,w',
    tv: 'R:0,0,60,40,#5bc2e7;U:0,0,30,20;S:40,12,2.4,5,y;S:50,10,2.4,5,y;S:46,20,2.4,5,y;S:52,27,2.4,5,y;S:38,30,2.4,5,y;S:46,34,2.4,5,y',
    ug: 'H:k,y,r,k,y,r;C:30,20,8,w;C:30,20,4,#555',
    ua: 'H:#0057b7,#ffd700',
    ae: 'H:#00732f,w,k;R:0,0,15,40,#ff0000',
    uy: 'H:w,#0038a8,w,#0038a8,w,#0038a8,w,#0038a8,w;R:0,0,22,22.2,w;C:11,11,5,#fcd116',
    uz: 'R:0,0,60,40,#0099b5;R:0,13,60,0.8,#ce1126;R:0,13.8,60,12,w;R:0,25.8,60,0.8,#ce1126;R:0,26.6,60,13.4,#1eb53a;Q:8,6.5,4.5,3.7,1.1,w;S:15,4,1.2,5,w;S:19,4,1.2,5,w;S:15,8,1.2,5,w;S:19,8,1.2,5,w',
    vu: 'R:0,0,60,20,#d21034;R:0,20,60,20,#009543;P:0 0 0 40 30 20,#fdce12;P:0 4 0 36 22 20,k;L:0,5,26,20,3,#fdce12;L:0,35,26,20,3,#fdce12;L:26,20,60,20,3,#fdce12',
    ve: 'H:#ffcc00,#00247d,#cf142b;O:30,21,9,8,1.2,w',
    vn: 'R:0,0,60,40,#da251d;S:30,21,11,5,#ffff00',
    ye: 'H:#ce1126,w,k',
    zm: 'R:0,0,60,40,#198a00;R:42,20,6,20,#de2010;R:48,20,6,20,k;R:54,20,6,20,#ef7d00;C:50,10,3,#ef7d00',
    zw: 'H:#006400,#ffd200,#d40000,k,#d40000,#ffd200,#006400;P:0 0 0 40 26 20,k;P:0 3 0 37 22 20,w;S:8,20,6,5,#d40000',
    tw: 'R:0,0,60,40,#fe0000;R:0,0,30,20,#000095;S:15,10,7,12,w;C:15,10,4,#000095;C:15,10,3,w'
  };
  Object.keys(DD).forEach(function (k) { F[k] = function () { return dsl(DD[k]); }; });

  function svg(cc) {
    var f = F[cc];
    if (!f) return '';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (cc === 'ch' ? 400 : 600) + '" height="400" viewBox="' + (VB[cc] || '0 0 60 40') + '">' + f() + '</svg>';
  }
  function url(cc) { var s = svg(cc); return s ? 'data:image/svg+xml,' + encodeURIComponent(s) : ''; }
  function image(cc) {
    return new Promise(function (ok) {
      var u = url(cc); if (!u) return ok(null);
      var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = u;
    });
  }

  function paint(n) {
    var cc = n.getAttribute('data-cc'), u = url(cc);
    if (n.firstChild || !u) return;
    var i = new Image(); i.src = u; i.width = 60; i.height = 40; i.decoding = 'async';
    i.alt = n.getAttribute('data-alt') || ''; n.appendChild(i);
  }

  function guess() {
    var z = '';
    try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
    if (z.indexOf('Australia/') === 0) return 'au';
    var m = { 'Pacific/Auckland': 'nz', 'Europe/London': 'gb', 'Europe/Dublin': 'ie', 'Europe/Berlin': 'de', 'Europe/Zurich': 'ch', 'Europe/Oslo': 'no',
      'Europe/Stockholm': 'se', 'Europe/Amsterdam': 'nl', 'Europe/Copenhagen': 'dk', 'Europe/Helsinki': 'fi', 'Europe/Vienna': 'at', 'Europe/Paris': 'fr',
      'Europe/Brussels': 'be', 'Europe/Luxembourg': 'lu', 'Asia/Singapore': 'sg', 'Asia/Tokyo': 'jp', 'America/Toronto': 'ca', 'America/Vancouver': 'ca',
      'America/Edmonton': 'ca', 'America/Winnipeg': 'ca', 'America/Halifax': 'ca', 'America/Regina': 'ca', 'America/St_Johns': 'ca',
      'America/New_York': 'us', 'America/Chicago': 'us', 'America/Denver': 'us', 'America/Los_Angeles': 'us', 'America/Phoenix': 'us',
      'America/Anchorage': 'us', 'America/Detroit': 'us', 'America/Boise': 'us', 'Pacific/Honolulu': 'us', 'Europe/Andorra': 'ad', 'America/Argentina/Buenos_Aires': 'ar', 'America/Sao_Paulo': 'br', 'Asia/Shanghai': 'cn', 'America/Mexico_City': 'mx', 'Asia/Riyadh': 'sa', 'Africa/Johannesburg': 'za', 'Asia/Bangkok': 'th', 'America/Indiana/Indianapolis': 'us' };
    return m[z] || '';
  }

  function init() {
    var n = document.querySelectorAll('.fl[data-cc]'), late = [], i, g, t, b, io;
    for (i = 0; i < n.length; i++) { if (n[i].classList.contains('big')) paint(n[i]); else late.push(n[i]); }
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { paint(e.target); io.unobserve(e.target); } }); }, { rootMargin: '300px' });
      late.forEach(function (x) { io.observe(x); });
    } else {
      var run = function () { late.forEach(paint); };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1200 }); else setTimeout(run, 200);
    }
    g = guess();
    if (g) {
      t = document.querySelector('.ctile[data-cc="' + g + '"]');
      if (t) { t.classList.add('you'); b = document.createElement('em'); b.className = 'yb'; b.textContent = 'YOUR REGION'; t.appendChild(b); }
    }
  }

  window.RTFlags = { svg: svg, url: url, image: image, paint: paint, has: function (cc) { return !!F[cc]; } };
  init();
})();
