/* Rocket Typing – certificate renderer. Draws an A4-landscape certificate (2000x1414) on a canvas. */
(function () {
  'use strict';
  var W = 2000, H = 1414, NAVY = '#0b1437', GOLD = '#b8892b', GOLD2 = '#d9b24c', INK = '#1c2340';

  function level(n) { return n < 20 ? 'Novice' : n < 40 ? 'Beginner' : n < 60 ? 'Average' : n < 80 ? 'Fast' : n < 100 ? 'Professional' : 'Elite'; }

  function hash(s) {
    if (window.crypto && crypto.subtle) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) {
        return Array.prototype.map.call(new Uint8Array(b).slice(0, 4), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase();
      });
    }
    var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return Promise.resolve(('00000000' + h.toString(16)).slice(-8).toUpperCase());
  }

  function T(c, txt, x, y, font, color, align, ls) {
    c.font = font; c.fillStyle = color; c.textAlign = align || 'center';
    if ('letterSpacing' in c) c.letterSpacing = (ls || 0) + 'px';
    c.fillText(txt, x, y);
    if ('letterSpacing' in c) c.letterSpacing = '0px';
  }
  function line(c, x1, x2, y, col, w) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke(); }

  function logo() { return new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = '/certificate/assets/logo.png'; }); }

  function fonts() {
    return Promise.all(['700 40px Cinzel', '600 40px Cinzel', '400 40px "Great Vibes"', '500 40px "Playfair Display"',
      'italic 500 40px "Playfair Display"', '700 40px "Roboto Mono"', '400 40px "Roboto Mono"']
      .map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  function make(d, name) {
    var date = new Date(d.ts);
    var ymd = date.getFullYear() + ('0' + (date.getMonth() + 1)).slice(-2) + ('0' + date.getDate()).slice(-2);
    return Promise.all([fonts(), hash([name, d.net, d.acc, d.secs, d.chars, d.keys, d.ts].join('|')), logo()]).then(function (r) {
      var id = 'RT-' + ymd + '-' + r[1], cv = document.createElement('canvas'), c = cv.getContext('2d');
      cv.width = W; cv.height = H;
      var cx = W / 2, i;

      c.fillStyle = '#fffdf6'; c.fillRect(0, 0, W, H);
      c.save(); c.translate(cx, H / 2); c.rotate(-0.35); c.globalAlpha = 0.04;
      T(c, 'ROCKET TYPING', 0, 60, '700 230px Cinzel', NAVY, 'center', 6); c.restore();

      c.strokeStyle = NAVY; c.lineWidth = 22; c.strokeRect(30, 30, W - 60, H - 60);
      c.strokeStyle = GOLD; c.lineWidth = 4; c.strokeRect(58, 58, W - 116, H - 116);
      c.lineWidth = 1.5; c.strokeRect(70, 70, W - 140, H - 140);
      [[70, 70, 1, 1], [W - 70, 70, -1, 1], [70, H - 70, 1, -1], [W - 70, H - 70, -1, -1]].forEach(function (p) {
        c.save(); c.translate(p[0], p[1]); c.scale(p[2], p[3]); c.strokeStyle = GOLD; c.lineWidth = 3;
        c.beginPath(); c.arc(0, 0, 70, 0, Math.PI / 2); c.stroke();
        c.beginPath(); c.arc(0, 0, 46, 0, Math.PI / 2); c.stroke();
        c.fillStyle = NAVY; c.fillRect(0, 0, 14, 14); c.restore();
      });

      if (r[2]) { var lh = 130, lw = r[2].width / r[2].height * lh; c.drawImage(r[2], cx - lw / 2, 88, lw, lh); }
      T(c, 'ROCKET TYPING', cx, 270, '700 34px Cinzel', NAVY, 'center', 12);
      T(c, 'CERTIFICATE', cx, 372, '700 100px Cinzel', NAVY, 'center', 10);
      T(c, 'OF TYPING PROFICIENCY', cx, 424, '600 34px Cinzel', GOLD, 'center', 12);
      line(c, 560, 1440, 455, GOLD2, 2);
      c.fillStyle = GOLD; c.save(); c.translate(cx, 455); c.rotate(Math.PI / 4); c.fillRect(-7, -7, 14, 14); c.restore();

      T(c, 'This is to certify that', cx, 508, 'italic 500 32px "Playfair Display"', INK);
      var size = 120; c.font = size + 'px "Great Vibes"';
      while (c.measureText(name).width > 1300 && size > 50) { size -= 4; c.font = size + 'px "Great Vibes"'; }
      T(c, name, cx, 630, size + 'px "Great Vibes"', NAVY);
      line(c, 500, 1500, 660, GOLD, 2);
      T(c, 'has completed the ' + d.label + ' Typing Test on RocketTyping.com', cx, 712, '500 32px "Playfair Display"', INK);
      T(c, 'and achieved the following results:', cx, 754, '500 32px "Playfair Display"', INK);

      var boxes = [['' + d.net, 'NET SPEED (WPM)'], [d.acc.toFixed(1) + '%', 'ACCURACY'], ['' + d.gross, 'GROSS SPEED (WPM)']];
      boxes.forEach(function (b, k) {
        var x = cx - 200 + (k - 1) * 460, y = 785;
        c.fillStyle = '#fbf5e3'; c.fillRect(x, y, 400, 170);
        c.strokeStyle = GOLD; c.lineWidth = 3; c.strokeRect(x, y, 400, 170);
        c.lineWidth = 1; c.strokeRect(x + 8, y + 8, 384, 154);
        T(c, b[0], x + 200, y + 102, '700 80px Cinzel', NAVY);
        T(c, b[1], x + 200, y + 146, '700 20px "Roboto Mono"', GOLD, 'center', 3);
      });

      T(c, 'Test Duration: ' + d.label + '   |   Characters Typed: ' + d.chars + '   |   Keystrokes: ' + d.keys, cx, 1000, '400 24px "Roboto Mono"', INK);
      T(c, 'Correct Words: ' + d.okW + '   |   Incorrect Words: ' + d.badW + '   |   Proficiency Level: ' + level(d.net), cx, 1036, '400 24px "Roboto Mono"', INK);

      var dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      T(c, dateStr, 400, 1190, '500 34px "Playfair Display"', NAVY); line(c, 190, 610, 1206, INK, 1.5);
      T(c, 'DATE OF ISSUE', 400, 1240, '700 18px "Roboto Mono"', GOLD, 'center', 3);
      T(c, 'Rocket Typing', 1600, 1190, '64px "Great Vibes"', NAVY); line(c, 1390, 1810, 1206, INK, 1.5);
      T(c, 'AUTHORIZED SIGNATURE', 1600, 1240, '700 18px "Roboto Mono"', GOLD, 'center', 3);

      var sx = cx, sy = 1170, g = c.createRadialGradient(sx, sy, 10, sx, sy, 88);
      g.addColorStop(0, '#f1d98b'); g.addColorStop(1, GOLD);
      c.fillStyle = g; c.beginPath(); c.arc(sx, sy, 88, 0, 7); c.fill();
      c.strokeStyle = NAVY; c.lineWidth = 3; c.beginPath(); c.arc(sx, sy, 80, 0, 7); c.stroke();
      c.lineWidth = 1.5; c.beginPath(); c.arc(sx, sy, 50, 0, 7); c.stroke();
      var ring = 'ROCKET TYPING \u2022 TYPING CERTIFICATE \u2022 ';
      c.font = '700 15px Cinzel'; c.fillStyle = NAVY; c.textAlign = 'center';
      for (i = 0; i < ring.length; i++) {
        c.save(); c.translate(sx, sy); c.rotate(i / ring.length * Math.PI * 2); c.fillText(ring[i], 0, -61); c.restore();
      }
      T(c, '\u2605', sx, sy + 17, '48px "Playfair Display"', NAVY);

      T(c, 'Certificate ID: ' + id + '   |   Issued by RocketTyping.com', cx, 1296, '400 19px "Roboto Mono"', INK);
      T(c, 'Net WPM = Gross WPM \u2212 (Incorrect Words \u00F7 Minutes)   |   Gross WPM = (Characters \u00F7 5) \u00F7 Minutes   |   Accuracy = Correct Keystrokes \u00F7 Total Keystrokes', cx, 1322, '400 16px "Roboto Mono"', '#5a6080');
      return cv;
    });
  }

  function png(c, d) {
    var a = document.createElement('a'); a.download = 'RocketTyping-' + d.slug + '-certificate.png';
    a.href = c.toDataURL('image/png'); a.click();
  }
  function pdf(c, d) {
    function go() {
      var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
      doc.save('RocketTyping-' + d.slug + '-certificate.pdf');
    }
    if (window.jspdf) return go();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = go; document.head.appendChild(s);
  }

  window.RTCert = { make: make, png: png, pdf: pdf, level: level };
})();
