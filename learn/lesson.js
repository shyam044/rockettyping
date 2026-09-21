/* ═══════════════════════════════════════════════════════════════
   ROCKET TYPING — SHARED LESSON ENGINE
   One file, reused by every lesson page under /learn/. Each lesson
   HTML file only supplies its own unique text content (title, intro,
   SEO copy) plus a tiny config object (slug + exercise list) — this
   file builds the exercise card, the keymap + virtual hands, and
   runs all of the typing / stats / animation logic.

   Being one shared, cached file (not duplicated per lesson) is the
   faster option at scale: every visitor's browser downloads and
   parses it once, then reuses the cached copy across every lesson
   page they open — including for large numbers of concurrent
   visitors, since it's a static file served from cache/CDN rather
   than something generated per request.
═══════════════════════════════════════════════════════════════ */
window.RocketLesson = (function () {
  'use strict';

  /* ── Keyboard layout + geometry (SIZE TUNING) ──
     UNIT/KEY_H/GAP/STAGE_W/STAGE_H drive the whole keyboard + hands
     proportionally — keep in sync with the --km-stage-w/--km-stage-h
     custom properties in lesson.css if these ever change. */
  var UNIT = 38, KEY_H = 32, GAP = 3, STAGE_W = 610, STAGE_H = 270;
  var HAND_SCALE = UNIT / 54;
  function unitW(n) { return n * UNIT - GAP; }

  var ROWS = [
    {
      keys: [
        ['`', 'Backquote', 1, 'l'], ['1', 'Digit1', 1, 'l'], ['2', 'Digit2', 1, 'l'], ['3', 'Digit3', 1, 'l'],
        ['4', 'Digit4', 1, 'l'], ['5', 'Digit5', 1, 'l'], ['6', 'Digit6', 1, 'r'], ['7', 'Digit7', 1, 'r'],
        ['8', 'Digit8', 1, 'r'], ['9', 'Digit9', 1, 'r'], ['0', 'Digit0', 1, 'r'], ['-', 'Minus', 1, 'r'],
        ['=', 'Equal', 1, 'r'], ['⌫', 'Backspace', 2, 'r']
      ]
    },
    {
      keys: [
        ['Tab', 'Tab', 1.5, 'l'], ['Q', 'KeyQ', 1, 'l'], ['W', 'KeyW', 1, 'l'], ['E', 'KeyE', 1, 'l'],
        ['R', 'KeyR', 1, 'l'], ['T', 'KeyT', 1, 'l'], ['Y', 'KeyY', 1, 'r'], ['U', 'KeyU', 1, 'r'],
        ['I', 'KeyI', 1, 'r'], ['O', 'KeyO', 1, 'r'], ['P', 'KeyP', 1, 'r'], ['[', 'BracketLeft', 1, 'r'],
        [']', 'BracketRight', 1, 'r'], ['\\', 'Backslash', 1.5, 'r']
      ]
    },
    {
      keys: [
        ['Caps', 'CapsLock', 1.8, 'l'], ['A', 'KeyA', 1, 'l'], ['S', 'KeyS', 1, 'l'], ['D', 'KeyD', 1, 'l'],
        ['F', 'KeyF', 1, 'l'], ['G', 'KeyG', 1, 'l'], ['H', 'KeyH', 1, 'r'], ['J', 'KeyJ', 1, 'r'],
        ['K', 'KeyK', 1, 'r'], ['L', 'KeyL', 1, 'r'], [';', 'Semicolon', 1, 'r'], ["'", 'Quote', 1, 'r'],
        ['↵', 'Enter', 2.3, 'r']
      ]
    },
    {
      keys: [
        ['⇧', 'ShiftLeft', 2.3, 'l'], ['Z', 'KeyZ', 1, 'l'], ['X', 'KeyX', 1, 'l'], ['C', 'KeyC', 1, 'l'],
        ['V', 'KeyV', 1, 'l'], ['B', 'KeyB', 1, 'l'], ['N', 'KeyN', 1, 'r'], ['M', 'KeyM', 1, 'r'],
        [',', 'Comma', 1, 'r'], ['.', 'Period', 1, 'r'], ['/', 'Slash', 1, 'r'], ['⇧', 'ShiftRight', 2.7, 'r']
      ]
    },
    {
      keys: [
        ['Ctrl', 'ControlLeft', 1.5, 'l'], ['⊞', 'MetaLeft', 1.3, 'l'], ['Alt', 'AltLeft', 1.3, 'l'],
        ['Space', 'Space', 6.2, 'b'],
        ['Alt', 'AltRight', 1.3, 'r'], ['Ctrl', 'ControlRight', 1.5, 'r']
      ]
    }
  ];

  /* Which finger presses each physical key (standard touch-typing map).
     Ctrl/Win/Alt aren't part of the touch-typing finger map (no fixed
     target finger) — they still highlight on press, just without a
     finger animation, same as the rest of the keyboard's unmapped keys. */
  var fingerOfCode = {
    Backquote: 'LP', Digit1: 'LP', KeyQ: 'LP', KeyA: 'LP', KeyZ: 'LP', Tab: 'LP', CapsLock: 'LP', ShiftLeft: 'LP',
    Digit2: 'LR', KeyW: 'LR', KeyS: 'LR', KeyX: 'LR',
    Digit3: 'LM', KeyE: 'LM', KeyD: 'LM', KeyC: 'LM',
    Digit4: 'LI', KeyR: 'LI', KeyF: 'LI', KeyV: 'LI', Digit5: 'LI', KeyT: 'LI', KeyG: 'LI', KeyB: 'LI',
    Digit6: 'RI', KeyY: 'RI', KeyH: 'RI', KeyN: 'RI', Digit7: 'RI', KeyU: 'RI', KeyJ: 'RI', KeyM: 'RI',
    Digit8: 'RM', KeyI: 'RM', KeyK: 'RM', Comma: 'RM',
    Digit9: 'RR', KeyO: 'RR', KeyL: 'RR', Period: 'RR',
    Digit0: 'RP', KeyP: 'RP', Semicolon: 'RP', Quote: 'RP', Minus: 'RP', Equal: 'RP',
    BracketLeft: 'RP', BracketRight: 'RP', Backslash: 'RP', Enter: 'RP', ShiftRight: 'RP', Backspace: 'RP', Slash: 'RP',
    Space: 'TR'
  };
  var homeKey = { LP: 'KeyA', LR: 'KeyS', LM: 'KeyD', LI: 'KeyF', RI: 'KeyJ', RM: 'KeyK', RR: 'KeyL', RP: 'Semicolon', TR: 'Space' };
  var handOfFinger = { LP: 'l', LR: 'l', LM: 'l', LI: 'l', RI: 'r', RM: 'r', RR: 'r', RP: 'r', TL: 'b', TR: 'b' };
  var fingerIds = ['LP', 'LR', 'LM', 'LI', 'RI', 'RM', 'RR', 'RP'];
  /* Original (UNIT=54-tuned) finger widths & length offsets — scaled by
     HAND_SCALE at the point of use in buildHands(), so they track UNIT. */
  var fingerWidthsBase = {
    LP: { base: 17, tip: 14 }, LR: { base: 20, tip: 17 }, LM: { base: 22, tip: 18 }, LI: { base: 20, tip: 17 },
    RI: { base: 20, tip: 17 }, RM: { base: 22, tip: 18 }, RR: { base: 20, tip: 17 }, RP: { base: 17, tip: 14 }
  };
  var lengthBonusBase = { LP: -45, LR: 0, LM: 15, LI: -10, RI: -10, RM: 15, RR: 0, RP: -45 };
  var CONVERGE = 0.1;

  var keymapOn = true;
  var kbBuilt = false;
  var keyPos = {};
  var fingers = {};
  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* ── Finger / thumb path generators (same geometry math as the
     virtual-typing-hands prototype, parameterized on live key positions;
     every literal pixel constant is multiplied by HAND_SCALE so the whole
     hand resizes in lockstep with UNIT/KEY_H above). ── */
  function fingerPath(bx, by, tx, ty, baseW, tipW, bend) {
    bend = bend || 0;
    var dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux, bxo = px * bend, byo = py * bend;
    var b1x = bx + px * baseW / 2, b1y = by + py * baseW / 2, b2x = bx - px * baseW / 2, b2y = by - py * baseW / 2;
    var t1x = tx + px * tipW / 2, t1y = ty + py * tipW / 2, t2x = tx - px * tipW / 2, t2y = ty - py * tipW / 2;
    var c1x = bx + ux * len * 0.4 + px * baseW * 0.28 + bxo, c1y = by + uy * len * 0.4 + py * baseW * 0.28 + byo;
    var c2x = tx - ux * len * 0.3 + px * tipW * 0.28 + bxo, c2y = ty - uy * len * 0.3 + py * tipW * 0.28 + byo;
    var c3x = tx - ux * len * 0.3 - px * tipW * 0.28 + bxo, c3y = ty - uy * len * 0.3 - py * tipW * 0.28 + byo;
    var c4x = bx + ux * len * 0.4 - px * baseW * 0.28 + bxo, c4y = by + uy * len * 0.4 - py * baseW * 0.28 + byo;
    return 'M ' + b1x + ' ' + b1y + ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + t1x + ' ' + t1y +
      ' A ' + (tipW / 2) + ' ' + (tipW / 2) + ' 0 0 1 ' + t2x + ' ' + t2y +
      ' C ' + c3x + ' ' + c3y + ', ' + c4x + ' ' + c4y + ', ' + b2x + ' ' + b2y + ' Z';
  }
  function creaseLines(bx, by, tx, ty, baseW, tipW) {
    var dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux;
    var q = 4 * HAND_SCALE;
    function oneCrease(t) {
      var cx = bx + dx * t, cy = by + dy * t, wdt = (baseW + (tipW - baseW) * t) * 0.76;
      var p1x = cx + px * wdt / 2, p1y = cy + py * wdt / 2, p2x = cx - px * wdt / 2, p2y = cy - py * wdt / 2, qx = cx + ux * q, qy = cy + uy * q;
      return 'M ' + p1x + ' ' + p1y + ' Q ' + qx + ' ' + qy + ', ' + p2x + ' ' + p2y;
    }
    return oneCrease(0.38) + ' ' + oneCrease(0.72);
  }
  function thumbPath(side, baseX, baseY, tipX, tipY) {
    var dx = tipX - baseX, dy = tipY - baseY, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux;
    var baseW = 30 * HAND_SCALE, tipW = 21 * HAND_SCALE, o1 = 10 * HAND_SCALE, o1y = 12 * HAND_SCALE, o2 = 7 * HAND_SCALE, o2y = 7 * HAND_SCALE;
    var b1x = baseX + px * baseW / 2, b1y = baseY + py * baseW / 2, b2x = baseX - px * baseW / 2, b2y = baseY - py * baseW / 2;
    var t1x = tipX + px * tipW / 2, t1y = tipY + py * tipW / 2, t2x = tipX - px * tipW / 2, t2y = tipY - py * tipW / 2;
    var c1x = baseX + dx * 0.25 + px * baseW * 0.55 + side * o1, c1y = baseY + dy * 0.25 + py * baseW * 0.55 - o1y;
    var c2x = tipX - dx * 0.18 + px * tipW * 0.65 + side * o2, c2y = tipY - dy * 0.18 + py * tipW * 0.65 - o2y;
    var c3x = tipX - dx * 0.18 - px * tipW * 0.65 + side * o2, c3y = tipY - dy * 0.18 - py * tipW * 0.65 - o2y;
    var c4x = baseX + dx * 0.25 - px * baseW * 0.55 + side * o1, c4y = baseY + dy * 0.25 - py * baseW * 0.55 - o1y;
    return 'M ' + b1x + ' ' + b1y + ' C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + t1x + ' ' + t1y +
      ' A ' + (tipW / 2) + ' ' + (tipW / 2) + ' 0 0 1 ' + t2x + ' ' + t2y +
      ' C ' + c3x + ' ' + c3y + ', ' + c4x + ' ' + c4y + ', ' + b2x + ' ' + b2y + ' Z';
  }
  function thumbCrease(baseX, baseY, tipX, tipY) {
    var dx = tipX - baseX, dy = tipY - baseY, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, px = -uy, py = ux, t = 0.48;
    var width = 18 * HAND_SCALE, q = 3 * HAND_SCALE;
    var cx = baseX + dx * t, cy = baseY + dy * t, p1x = cx + px * width / 2, p1y = cy + py * width / 2, p2x = cx - px * width / 2, p2y = cy - py * width / 2;
    return 'M ' + p1x + ' ' + p1y + ' Q ' + (cx + ux * q) + ' ' + (cy + uy * q) + ', ' + p2x + ' ' + p2y;
  }

  /* ── Build Keyboard + Hands ─────────────────────────────────── */
  function buildKeyboard() {
    var kb = document.getElementById('km-kb');
    if (!kb || kbBuilt) return;
    kbBuilt = true;
    kb.innerHTML = '';
    keyPos = {};

    var maxRowW = 0;
    ROWS.forEach(function (row) {
      var rw = 0;
      row.keys.forEach(function (k) { rw += k[2] * UNIT; });
      if (rw > maxRowW) maxRowW = rw;
    });
    // Center the whole keyboard block (the widest row) inside the stage,
    // instead of sitting flush against the left edge — this is what keeps
    // the background box symmetric with no lopsided empty space.
    var globalOffsetX = Math.max(0, (STAGE_W - maxRowW) / 2);

    ROWS.forEach(function (row, ri) {
      var rw = 0;
      row.keys.forEach(function (k) { rw += k[2] * UNIT; });
      var x = globalOffsetX + (maxRowW - rw) / 2; // center each row against the widest row too
      var yTop = ri * (KEY_H + GAP);
      row.keys.forEach(function (def) {
        var label = def[0], code = def[1], mult = def[2], hand = def[3];
        var width = unitW(mult);
        var div = document.createElement('div');
        div.className = 'km-key km-' + hand;
        div.style.left = x + 'px';
        div.style.top = yTop + 'px';
        div.style.width = width + 'px';
        div.style.height = KEY_H + 'px';
        div.textContent = label;
        div.dataset.code = code;
        div.dataset.hand = hand;
        kb.appendChild(div);
        keyPos[code] = { x: x + width / 2, y: yTop + KEY_H / 2 };
        x += mult * UNIT;
      });
    });

    buildHands(kb);
    scaleStage();
  }

  function buildHands(kb) {
    var svg = svgEl('svg', { id: 'km-hands', viewBox: '0 0 ' + STAGE_W + ' ' + STAGE_H });
    kb.appendChild(svg);

    var homeRowY = keyPos['KeyA'].y;
    var fingerBaseY = homeRowY + 150 * HAND_SCALE;
    var palmTopY = fingerBaseY - 55 * HAND_SCALE;
    var wristY = palmTopY + 130 * HAND_SCALE;
    var leftBaseXs = ['LP', 'LR', 'LM', 'LI'].map(function (f) { return keyPos[homeKey[f]].x; });
    var rightBaseXs = ['RI', 'RM', 'RR', 'RP'].map(function (f) { return keyPos[homeKey[f]].x; });
    var leftCenterX = (leftBaseXs[0] + leftBaseXs[3]) / 2;
    var rightCenterX = (rightBaseXs[0] + rightBaseXs[3]) / 2;

    function palmGeometry(baseXs, thumbSide) {
      var pad = 20 * HAND_SCALE, minX = baseXs[0], maxX = baseXs[3], leftX = minX - pad, rightX = maxX + pad;
      var thumbBulge = 84 * HAND_SCALE, otherBulge = 26 * HAND_SCALE;
      var bulgeRight = thumbSide > 0 ? thumbBulge : otherBulge;
      var bulgeLeft = thumbSide > 0 ? otherBulge : thumbBulge;
      var midY = (palmTopY + wristY) / 2;
      var wristSpan = (rightX - leftX) * 0.5, wristCenterX = (leftX + rightX) / 2 + thumbSide * 24 * HAND_SCALE;
      var wristLeftX = wristCenterX - wristSpan / 2, wristRightX = wristCenterX + wristSpan / 2;
      var n1 = 4 * HAND_SCALE, n2 = 14 * HAND_SCALE, n3 = 16 * HAND_SCALE;
      return 'M ' + leftX + ' ' + palmTopY +
        ' Q ' + (leftX - n1) + ' ' + (palmTopY - n2) + ', ' + ((leftX + rightX) / 2) + ' ' + (palmTopY - n3) +
        ' Q ' + (rightX + n1) + ' ' + (palmTopY - n2) + ', ' + rightX + ' ' + palmTopY +
        ' Q ' + (rightX + bulgeRight) + ' ' + midY + ', ' + wristRightX + ' ' + wristY +
        ' L ' + wristLeftX + ' ' + wristY +
        ' Q ' + (leftX - bulgeLeft) + ' ' + midY + ', ' + leftX + ' ' + palmTopY + ' Z';
    }
    svg.appendChild(svgEl('path', { d: palmGeometry(leftBaseXs, +1), class: 'km-palm km-fl' }));
    svg.appendChild(svgEl('path', { d: palmGeometry(rightBaseXs, -1), class: 'km-palm km-fr' }));

    fingerIds.forEach(function (f) {
      var isLeft = f[0] === 'L', centerX = isLeft ? leftCenterX : rightCenterX;
      var homeCode = homeKey[f];
      var tip = { x: keyPos[homeCode].x, y: keyPos[homeCode].y - 20 * HAND_SCALE };
      var baseX = tip.x + (centerX - tip.x) * CONVERGE, baseY = fingerBaseY + lengthBonusBase[f] * HAND_SCALE;
      var wdt = { base: fingerWidthsBase[f].base * HAND_SCALE, tip: fingerWidthsBase[f].tip * HAND_SCALE };
      var path = svgEl('path', { class: 'km-finger km-f' + handOfFinger[f], d: fingerPath(baseX, baseY, tip.x, tip.y, wdt.base, wdt.tip) });
      var crease = svgEl('path', { class: 'km-crease', d: creaseLines(baseX, baseY, tip.x, tip.y, wdt.base, wdt.tip) });
      svg.appendChild(path); svg.appendChild(crease);
      fingers[f] = { path: path, crease: crease, baseX: baseX, baseY: baseY, homeX: tip.x, homeY: tip.y, curX: tip.x, curY: tip.y, w: wdt };
    });

    var to1 = 30 * HAND_SCALE, to2 = 48 * HAND_SCALE, to3 = 70 * HAND_SCALE, to4 = 12 * HAND_SCALE;
    var thumbConfigs = {
      TL: { side: -1, baseX: leftBaseXs[3] + to1, baseY: palmTopY + to2, tipX: leftBaseXs[3] + to3, tipY: palmTopY - to4 },
      TR: { side: +1, baseX: rightBaseXs[0] - to1, baseY: palmTopY + to2, tipX: rightBaseXs[0] - to3, tipY: palmTopY - to4 }
    };
    ['TL', 'TR'].forEach(function (f) {
      var cfg = thumbConfigs[f];
      var path = svgEl('path', { class: 'km-finger km-fb', d: thumbPath(cfg.side, cfg.baseX, cfg.baseY, cfg.tipX, cfg.tipY) });
      var crease = svgEl('path', { class: 'km-crease', d: thumbCrease(cfg.baseX, cfg.baseY, cfg.tipX, cfg.tipY) });
      svg.appendChild(path); svg.appendChild(crease);
      fingers[f] = {
        path: path, crease: crease, baseX: cfg.baseX, baseY: cfg.baseY, homeX: cfg.tipX, homeY: cfg.tipY,
        curX: cfg.tipX, curY: cfg.tipY, w: { base: 30 * HAND_SCALE, tip: 21 * HAND_SCALE }, side: cfg.side, isThumb: true
      };
    });
  }



  /* ── Finger animation ──────────────────────────────────────── */
  function animateFinger(fid, targetX, targetY, press) {
    var fg = fingers[fid];
    if (!fg) return;
    clearTimeout(fg._homeTimer);
    var dur = 130;
    var startX = fg.curX;
    var startY = fg.curY;
    var t0 = performance.now();
    if (fg._raf) cancelAnimationFrame(fg._raf);
    function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      fg.curX = startX + (targetX - startX) * ease;
      fg.curY = startY + (targetY - startY) * ease;
      if (fg.isThumb) {
        fg.path.setAttribute('d', thumbPath(fg.side, fg.baseX, fg.baseY, fg.curX, fg.curY));
        fg.crease.setAttribute('d', thumbCrease(fg.baseX, fg.baseY, fg.curX, fg.curY));
      } else {
        fg.path.setAttribute('d', fingerPath(fg.baseX, fg.baseY, fg.curX, fg.curY, fg.w.base, fg.w.tip, fg.bend || 0));
        fg.crease.setAttribute('d', creaseLines(fg.baseX, fg.baseY, fg.curX, fg.curY, fg.w.base, fg.w.tip));
      }
      if (t < 1) {
        fg._raf = requestAnimationFrame(step);
      } else {
        fg._raf = null;
      }
    }
    fg._raf = requestAnimationFrame(step);
    if (press) {
      fg.path.classList.add('km-active');
      fg.crease.classList.add('km-active');
      clearTimeout(fg._releaseTimer);
      fg._releaseTimer = setTimeout(function () {
        fg.path.classList.remove('km-active');
        fg.crease.classList.remove('km-active');
      }, 150);
    }
  }
  function returnHome(fid) {
    var fg = fingers[fid];
    if (!fg) return;
    clearTimeout(fg._homeTimer);
    fg._homeTimer = setTimeout(function () {
      if (_guidedFinger === fid) return;
      animateFinger(fid, fg.homeX, fg.homeY, false);
    }, 170);
  }
  /* ── Press a key: highlight it + move its finger (real keystrokes only) ── */
  function pressKey(code) {
    var keyEl = document.querySelector('.km-key[data-code="' + code + '"]');
    if (keyEl) {
      var hand = keyEl.dataset.hand;
      var cls = hand === 'l' ? 'km-pl' : (hand === 'r' ? 'km-pr' : 'km-pb');
      keyEl.classList.remove('km-pl', 'km-pr', 'km-pb');
      keyEl.classList.add(cls);
      clearTimeout(keyEl._khTimer);
      keyEl._khTimer = setTimeout(function () {
        keyEl.classList.remove('km-pl', 'km-pr', 'km-pb');
      }, 210);
    }
    var posi = keyPos[code];
    var fid = fingerOfCode[code];
    if (!posi || !fid) return;
    if (_guidedFinger === fid) _guidedFinger = null;
    animateFinger(fid, posi.x, posi.y - (code === 'Space' ? 4 * HAND_SCALE : 0), true);
    returnHome(fid);
  }




  /* ── Mouse click animations ─────────────────────────────────── */
  function handleMouseDown(btn) {
    if (!keymapOn) return;
    var svg = document.getElementById('km-mouse-svg');
    if (!svg) return;
    var lDot = document.getElementById('km-lclick-dot');
    var rDot = document.getElementById('km-rclick-dot');
    if (btn === 0) {
      svg.classList.add('km-lc');
      if (lDot) { lDot.style.opacity = '1'; lDot.style.transition = 'opacity 0.05s'; }
    } else if (btn === 2) {
      svg.classList.add('km-rc');
      if (rDot) { rDot.style.opacity = '1'; rDot.style.transition = 'opacity 0.05s'; }
    } else {
      svg.classList.add('km-mc');
    }
  }
  function handleMouseUp() {
    var svg = document.getElementById('km-mouse-svg');
    if (!svg) return;
    svg.classList.remove('km-lc', 'km-rc', 'km-mc');
    var lDot = document.getElementById('km-lclick-dot');
    var rDot = document.getElementById('km-rclick-dot');
    if (lDot) { lDot.style.opacity = '0'; }
    if (rDot) { rDot.style.opacity = '0'; }
  }

  /* ── Sound Engine ───────────────────────────────────────────── */
  var soundOn = true; /* default ON — beginners benefit from the audio feedback */
  var _audioCtx = null;
  function _getAudioCtx() {
    if (!_audioCtx) { try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
    return _audioCtx;
  }
  function playKeyClick() {
    if (!soundOn) return;
    if (typeof testActive !== 'undefined' && !testActive) return;
    var ctx = _getAudioCtx(); if (!ctx) return;
    var bufSize = ctx.sampleRate * 0.035;
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 4) * 0.9;
    var src = ctx.createBufferSource(); src.buffer = buf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.7;
    var g = ctx.createGain(); g.gain.setValueAtTime(0.8, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(ctx.destination);
    src.start(); src.stop(ctx.currentTime + 0.04);
  }
  window.kmSoundToggle = function () {
    soundOn = !soundOn;
    var icon = document.getElementById('km-sound-icon'), pill = document.getElementById('km-sound-pill');
    if (soundOn) { if (icon) icon.textContent = '🔊'; if (pill) { pill.textContent = 'ON'; pill.className = 'km-pill on'; } }
    else { if (icon) icon.textContent = '🔇'; if (pill) { pill.textContent = 'OFF'; pill.className = 'km-pill off'; } }
    try { localStorage.setItem('rt_keysound', soundOn ? '1' : '0'); } catch (e) { }
  };

  /* A short, bright "landing" chime for each rocket that touches down on
     the results screen — an ascending major-triad arpeggio (C5, E5, G5)
     so each landing feels like a small reward, building toward a
     satisfying resolution that nudges the user into the next exercise. */
  function playRocketLandSound(index) {
    if (!soundOn) return;
    var ctx = _getAudioCtx(); if (!ctx) return;
    var freqs = [523.25, 659.25, 783.99];
    var freq = freqs[index] || freqs[freqs.length - 1];
    var t = ctx.currentTime;
    var osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
    var osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.setValueAtTime(freq * 2, t);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    osc.connect(g); osc2.connect(g); g.connect(ctx.destination);
    osc.start(t); osc2.start(t);
    osc.stop(t + 0.38); osc2.stop(t + 0.38);
  }

  /* ── Responsive scaling ──────────────────────────────────────
     #km-stage-outer is fluid width (capped at STAGE_W). Scale the native
     STAGE_W×STAGE_H stage down to fit it exactly, on any device size, and
     set an explicit pixel height on the outer element (transform doesn't
     affect layout size) so there's no layout jump and no page overflow. */
  function scaleStage() {
    var outer = document.getElementById('km-stage-outer');
    var scaler = document.getElementById('km-stage-scaler');
    if (!outer || !scaler) return;
    var s = Math.min(1, outer.clientWidth / STAGE_W) || 1;
    scaler.style.transform = 'scale(' + s + ')';
    outer.style.height = (STAGE_H * s) + 'px';
  }

  /* ── Toggle ─────────────────────────────────────────────────── */
  window.kmToggle = function () {
    keymapOn = !keymapOn;
    var collapsible = document.getElementById('km-collapsible');
    var pill = document.getElementById('km-pill');
    var app = document.getElementById('app');
    if (keymapOn) {
      if (collapsible) { collapsible.classList.remove('km-hidden'); }
      if (pill) { pill.textContent = 'ON'; pill.className = 'km-pill on'; }
      if (app) { app.classList.remove('km-compact'); }
      if (!kbBuilt) buildKeyboard();
      scaleStage();
    } else {
      if (collapsible) { collapsible.classList.add('km-hidden'); }
      if (pill) { pill.textContent = 'OFF'; pill.className = 'km-pill off'; }
      if (app) { app.classList.add('km-compact'); }
    }
    try { localStorage.setItem('rt_keymap', keymapOn ? '1' : '0'); } catch (e) { }
  };

  /* ── Init ────────────────────────────────────────────────────── */
  function kmInit() {
    try {
      var saved = localStorage.getItem('rt_keymap');
      if (saved === '0') {
        keymapOn = false;
        var sc = document.getElementById('km-collapsible');
        var pl = document.getElementById('km-pill');
        var ap = document.getElementById('app');
        if (sc) sc.classList.add('km-hidden');
        if (pl) { pl.textContent = 'OFF'; pl.className = 'km-pill off'; }
        if (ap) ap.classList.add('km-compact');
      }
    } catch (e) { }
    try {
      /* Default is ON (beginners benefit from hearing each keystroke).
         Only switch OFF if the user explicitly muted it on a previous
         visit (saved value === '0'). Any other value (missing, or '1')
         leaves it on, matching the markup's default. */
      if (localStorage.getItem('rt_keysound') === '0') {
        soundOn = false;
        var si = document.getElementById('km-sound-icon'), sp = document.getElementById('km-sound-pill');
        if (si) si.textContent = '🔇';
        if (sp) { sp.textContent = 'OFF'; sp.className = 'km-pill off'; }
      }
    } catch (e) { }

    // Reserve the correct on-screen height immediately (the #km-kb stage
    // has a fixed native layout box as soon as the CSS above applies,
    // independent of when its contents are actually built) — this is
    // what keeps CLS low without needing a hardcoded pixel guess.
    scaleStage();

    // INP FIX: defer heavy DOM injection (buildKeyboard creates the keys
    // + SVG hand paths) to an idle slot so it never blocks the first user
    // interaction. requestIdleCallback isn't available everywhere; fall
    // back to a 200 ms timeout which still yields to first paint + input.
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(buildKeyboard, { timeout: 2000 });
    } else {
      setTimeout(buildKeyboard, 200);
    }

    // Keydown listener — real physical keystrokes drive the sound, key
    // highlight, and finger animation (no separate mock input box).
    // PERF FIX: throttle the visual update to max ~30 fps (33 ms gate).
    // At 120 WPM keydown fires every ~100 ms but the finger animation
    // takes ~130-190 ms to complete, so this keeps the compositor from
    // getting contested. Sound plays on every keystroke regardless.
    var _kmLastUpdate = 0;
    document.addEventListener('keydown', function (e) {
      playKeyClick();
      if (!keymapOn) return;
      var now = performance.now();
      if (now - _kmLastUpdate < 33) return;
      _kmLastUpdate = now;
      pressKey(e.code);
    });

    // Mouse down/up
    document.addEventListener('mousedown', function (e) { handleMouseDown(e.button); });
    document.addEventListener('mouseup', function () { handleMouseUp(); });
    // Prevent context menu from stealing mouse-up on right-click
    document.addEventListener('contextmenu', function () { handleMouseUp(); });

    window.addEventListener('resize', scaleStage);
    if (typeof ResizeObserver !== 'undefined') {
      var outer = document.getElementById('km-stage-outer');
      if (outer) new ResizeObserver(scaleStage).observe(outer);
    }
  }



  /* ═══ MARKUP TEMPLATES ═══ */

  /* Minimalist rocket icon (body + porthole + two fins), reused as both
     the dim "target" outline and the solid "earned" rocket. */
  var ROCKET_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
    + '<path d="M12 1.5c2.8 2.6 4.3 6.2 4.3 9.8 0 1.7-.4 3.1-1 4.3l1.7 1.9v3l-3-1.1c-.6.15-1.3.2-2 .2s-1.4-.05-2-.2l-3 1.1v-3l1.7-1.9c-.6-1.2-1-2.6-1-4.3 0-3.6 1.5-7.2 4.3-9.8z"/>'
    + '<circle cx="12" cy="10" r="1.6" fill="#0a0a23"/>'
    + '<path d="M8.3 15.5l-2.8 1.2 1-3.3z"/>'
    + '<path d="M15.7 15.5l2.8 1.2-1-3.3z"/>'
    + '</svg>';

  var KEYMAP_WIDGET_HTML = '<div id="km-center-row" style="display:flex;justify-content:center;width:100%;">\n<div id="km-wrap">\n    <div id="km-scene">\n        <div id="km-header">\n            <div id="km-toggle-row">\n                <button id="km-toggle-btn" type="button" onclick="kmToggle()" title="Toggle keymap visualization">\n                    <span>⌨️</span>\n                    <span>KEY MAP</span>\n                    <span id="km-pill" class="km-pill on">ON</span>\n                </button>\n            </div>\n            <button id="km-sound-btn" type="button" onclick="kmSoundToggle()" title="Toggle keyboard sound">\n                <span id="km-sound-icon">🔊</span>\n                <span> SOUND </span>\n                <span id="km-sound-pill" class="km-pill on">ON</span>\n            </button>\n        </div>\n        <div id="km-collapsible">\n            <div id="km-kb-col">\n                <div id="km-stage-outer">\n                    <div id="km-stage-scaler">\n                        <div id="km-kb"></div>\n                    </div>\n                </div>\n                <div id="km-mouse-wrap">\n                    <svg id="km-mouse-svg" viewBox="0 0 70 110" xmlns="http://www.w3.org/2000/svg">\n                        <path d="M 8 44 Q 8 12 35 8 Q 62 12 62 44 L 62 86 Q 62 104 35 104 Q 8 104 8 86 Z" fill="#1A2230" stroke="#2e3f52" stroke-width="1.5"/>\n                        <path id="km-mlbtn" d="M 9 42 Q 9 14 34 10 L 34 52 L 9 52 Z" fill="#21293A" stroke="#2e3f52" stroke-width="1.2" class="km-mbtn"/>\n                        <path id="km-mrbtn" d="M 61 42 Q 61 14 36 10 L 36 52 L 61 52 Z" fill="#21293A" stroke="#2e3f52" stroke-width="1.2" class="km-mbtn"/>\n                        <line x1="35" y1="10" x2="35" y2="52" stroke="#2e3f52" stroke-width="1.5"/>\n                        <rect id="km-mwheel" x="30" y="20" width="10" height="20" rx="5" fill="#2e3f52"/>\n                        <rect x="31" y="21" width="4" height="18" rx="2" fill="rgba(255,255,255,0.07)"/>\n                        <ellipse cx="35" cy="86" rx="24" ry="8" fill="#16202f" opacity="0.5"/>\n                        <circle id="km-lclick-dot" cx="22" cy="34" r="4" fill="#e2b714" opacity="0"/>\n                        <circle id="km-rclick-dot" cx="48" cy="34" r="4" fill="#00e6cc" opacity="0"/>\n                        <text x="35" y="97" text-anchor="middle" font-size="7" fill="#3a4a5a" font-family="Roboto Mono,monospace" letter-spacing="0.5">MOUSE</text>\n                    </svg>\n                    <p>Left / Right click</p>\n                </div>\n            </div>\n        </div>\n    </div>\n</div>\n</div>';

  function buildMarkup(cfg) {
    var rocketSlots = '';
    for (var i = 0; i < 3; i++) {
      rocketSlots += '<div class="ex-rocket-slot" data-slot="' + i + '">'
        + '<div class="ex-rocket-ghost">' + ROCKET_SVG + '</div>'
        + '</div>';
    }

    return ''
      + '<div id="lesson-exercise-card">'
      + '<div class="ex-header">'
      + '<span id="ex-name">Exercise 1</span>'
      + '<div class="ex-dots" id="ex-dots"></div>'
      + '<span id="ex-counter">1 / ' + cfg.exercises.length + '</span>'
      + '</div>'
      + '<div class="ex-display-wrap">'
      + '<div id="ex-display"></div>'
      + '<input id="ex-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Type the exercise text here">'
      + '</div>'
      + '<div class="ex-body-row">'
      + '<div class="ex-stats-col">'
      + '<div class="ex-stat-chip ex-stat-wpm"><div class="ex-stat-icon">⚡</div><div class="ex-stat-lbl">WPM</div><div class="ex-stat-val" id="stat-wpm">0</div></div>'
      + '<div class="ex-stat-chip ex-stat-acc"><div class="ex-stat-icon">🎯</div><div class="ex-stat-lbl">Accuracy</div><div class="ex-stat-val" id="stat-acc">100%</div></div>'
      + '<div class="ex-stat-chip ex-stat-prog"><div class="ex-stat-icon">📊</div><div class="ex-stat-lbl">Progress</div><div class="ex-stat-val" id="stat-prog">0/0</div></div>'
      + '</div>'
      + '<div class="ex-keymap-col">' + KEYMAP_WIDGET_HTML + '</div>'
      + '</div>'
      + '<div class="ex-complete-banner" id="ex-complete-banner">'
      + '<div class="ex-rockets" id="ex-rockets">' + rocketSlots + '</div>'
      + '<div class="ex-complete-msg" id="ex-complete-msg"></div>'
      + '<div class="ex-complete-stats" id="ex-complete-stats"></div>'
      + '<div class="ex-complete-btns">'
      + '<button class="btn-ex-retry" type="button" id="btn-ex-retry">&#8635; Retry</button>'
      + '<button class="btn-ex-next" type="button" id="btn-ex-next">Next Exercise &rarr;</button>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '<div id="lesson-complete">'
      + '<div class="lc-emoji">\ud83c\udfc6</div>'
      + '<h2 id="lc-title">Lesson Complete!</h2>'
      + '<p id="lc-msg">Nice work — that\'s the whole lesson done.</p>'
      + '<div class="lc-actions" id="lc-actions">'
      + '<a class="btn-lc-primary" href="../learn">\ud83d\udcda Back to Lessons</a>'
      + '<a class="btn-lc-secondary" href="../">\u2328\ufe0f Try the Full Typing Test</a>'
      + '</div>'
      + '</div>';
  }


  /* ═══ EXERCISE ENGINE ═══ */
  var EXERCISES = [], LESSON_SLUG = '', LESSON_NUM = 1, LESSON_KEY_LABEL = '';
  var lessonsManifestPromise = Promise.resolve(null);
  var lessonFinished = false;
  var nextLessonHref = '../learn';
  var exIdx = 0, pos = 0, typedCorrect = 0, errors = 0, startTime = null;
  var totalKeystrokes = 0, totalCorrectKeystrokes = 0, prevValLen = 0;
  var inputEl, displayEl;

  function focusHiddenInput() { if (inputEl) inputEl.focus(); }

  /* Map a typed character to its KeyboardEvent.code, so we can find and
     highlight the matching key on the keymap before the user presses it —
     this is the "which key do I press next" cue for beginners. */
  function codeForChar(ch) {
    if (ch === ' ') return 'Space';
    if (/[a-zA-Z]/.test(ch)) return 'Key' + ch.toUpperCase();
    if (/[0-9]/.test(ch)) return 'Digit' + ch;
    var map = {
      ',': 'Comma', '.': 'Period', '/': 'Slash', ';': 'Semicolon', "'": 'Quote',
      '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight',
      '\\': 'Backslash', '`': 'Backquote'
    };
    return map[ch] || null;
  }

  var _nextKeyRetries = 0;
  var _guidedFinger = null;

  function highlightNextKey() {
    var prevEls = document.querySelectorAll('.km-key.km-next');
    for (var i = 0; i < prevEls.length; i++)prevEls[i].classList.remove('km-next');

    if (!EXERCISES[exIdx]) return;

    var ex = EXERCISES[exIdx].text;
    if (pos >= ex.length) {
      if (_guidedFinger) {
        returnHome(_guidedFinger);
        _guidedFinger = null;
      }
      return;
    }

    var code = codeForChar(ex[pos]);
    if (!code) {
      if (_guidedFinger) {
        returnHome(_guidedFinger);
        _guidedFinger = null;
      }
      return;
    }

    var keyEl = document.querySelector('.km-key[data-code="' + code + '"]');

    if (keyEl) {
      keyEl.classList.add('km-next');
      _nextKeyRetries = 0;
      guideNextFinger();
    } else if (_nextKeyRetries < 40) {
      _nextKeyRetries++;
      setTimeout(highlightNextKey, 100);
    }
  }

  function guideNextFinger() {
    if (!keymapOn || !EXERCISES[exIdx]) return;
    var ex = EXERCISES[exIdx].text;
    if (pos >= ex.length) {
      if (_guidedFinger) {
        returnHome(_guidedFinger);
        _guidedFinger = null;
      }
      return;
    }
    var code = codeForChar(ex[pos]);
    var fid = fingerOfCode[code];
    if (!code || !fid || !keyPos[code] || !fingers[fid]) return;
    if (_guidedFinger && _guidedFinger !== fid) returnHome(_guidedFinger);
    _guidedFinger = fid;
    var fg = fingers[fid];
    clearTimeout(fg._homeTimer);
    var target = keyPos[code];
    animateFinger(fid, target.x, target.y - (code === 'Space' ? 4 * HAND_SCALE : 0), false);
  }





  /* Persists "which lesson, which exercise" so a returning visitor can
     pick up where they left off. Called every time an exercise starts,
     so it always reflects the exercise currently in progress (not yet
     completed) — resuming lands them back on exactly that one. */
  function saveProgress(slug, exerciseIndex) {
    try {
      localStorage.setItem('rt_progress', JSON.stringify({ slug: slug, exerciseIndex: exerciseIndex }));
    } catch (e) { }
  }

  function renderExercise() {
    var ex = EXERCISES[exIdx];
    pos = 0; typedCorrect = 0; errors = 0; startTime = null;
    totalKeystrokes = 0; totalCorrectKeystrokes = 0; prevValLen = 0;
    inputEl.value = '';

    saveProgress(LESSON_SLUG, exIdx);

    document.getElementById('ex-name').textContent = ex.name;
    document.getElementById('ex-counter').textContent = (exIdx + 1) + ' / ' + EXERCISES.length;

    var dots = document.getElementById('ex-dots');
    dots.innerHTML = '';
    EXERCISES.forEach(function (_, i) {
      var d = document.createElement('div');
      d.className = 'ex-dot' + (i === exIdx ? ' active' : (i < exIdx ? ' done' : ''));
      dots.appendChild(d);
    });

    displayEl.innerHTML = '';
    ex.text.split('').forEach(function (ch) {
      var span = document.createElement('span');
      span.className = 'ex-char';
      span.textContent = ch;
      displayEl.appendChild(span);
    });

    hideCompleteBanner();
    updateCurrent();
    updateStats();
    highlightNextKey();
    focusHiddenInput();
  }

  function updateCurrent() {
    var chars = displayEl.children;
    for (var i = 0; i < chars.length; i++) chars[i].classList.remove('current');
    if (chars[pos]) chars[pos].classList.add('current');
  }

  /* WPM: standard "characters typed / 5 / minutes" formula, using only
     characters currently correct (net WPM) so racing through mistakes
     doesn't inflate the number. Guarded against the very first keystroke,
     where elapsed time is near-zero and would otherwise flash an absurd
     spike (e.g. "9000 WPM") for a fraction of a second. */
  function computeWpm() {
    if (!startTime) return 0;
    var elapsedMin = (Date.now() - startTime) / 60000;
    if (elapsedMin < 0.006) return 0; // ~0.35s minimum before showing a number
    return Math.max(0, Math.round((typedCorrect / 5) / elapsedMin));
  }

  /* Accuracy: cumulative, like real typing tests — every keystroke you
     ever made in this exercise counts against the total, even ones you
     later fixed with backspace. This is different from (and more honest
     than) just looking at the current, already-corrected buffer. */
  function computeAccuracy() {
    return totalKeystrokes > 0 ? Math.round((totalCorrectKeystrokes / totalKeystrokes) * 100) : 100;
  }

  function updateStats() {
    document.getElementById('stat-wpm').textContent = computeWpm();
    document.getElementById('stat-acc').textContent = computeAccuracy() + '%';
    document.getElementById('stat-prog').textContent = pos + '/' + EXERCISES[exIdx].text.length;
  }

  /* Rocket rating (Rocket Typing's spin on a star rating) — 1 to 3 rockets
     based on this exercise's accuracy, each with a short encouraging line. */
  function rocketRating() {
    var acc = computeAccuracy();
    if (acc >= 95) return { count: 3, msg: '\ud83c\udf89 Perfect Launch! Flawless typing.' };
    if (acc >= 80) return { count: 2, msg: '\ud83d\ude80 Great Liftoff! Keep that rhythm.' };
    return { count: 1, msg: '\ud83d\udcaa Nice Start \u2014 every launch needs practice.' };
  }

  function showCompleteBanner() {
    var r = rocketRating();
    var slots = document.querySelectorAll('.ex-rocket-slot');
    /* Matches the .ex-rocket-fill animation-delay values in lesson.css
       (150ms / 450ms / 750ms) plus ~385ms for the fall duration up to
       its impact moment, so each chime lands right as the rocket does. */
    var fallDelays = [150, 450, 750];
    var impactOffset = 385;
    for (var i = 0; i < slots.length; i++) {
      var old = slots[i].querySelector('.ex-rocket-fill');
      if (old) old.remove();
      if (i < r.count) {
        var fill = document.createElement('div');
        fill.className = 'ex-rocket-fill';
        fill.innerHTML = ROCKET_SVG;
        slots[i].appendChild(fill);
        setTimeout((function (idx) { return function () { playRocketLandSound(idx); }; })(i),
          (fallDelays[i] || 0) + impactOffset);
      }
    }
    document.getElementById('ex-complete-msg').textContent = r.msg;

    var finalWpm = computeWpm(), finalAcc = computeAccuracy();
    document.getElementById('ex-complete-stats').innerHTML =
      '<span class="ex-cs-pill ex-cs-wpm"><span class="ex-cs-icon">⚡</span><b>' + finalWpm + '</b> WPM</span>' +
      '<span class="ex-cs-pill ex-cs-acc"><span class="ex-cs-icon">🎯</span><b>' + finalAcc + '%</b> Accuracy</span>' +
      '<span class="ex-cs-pill ex-cs-prog"><span class="ex-cs-icon">✅</span><b>' + EXERCISES[exIdx].text.length + '/' + EXERCISES[exIdx].text.length + '</b> Done</span>';

    document.getElementById('ex-complete-banner').classList.add('show');
  }

  function hideCompleteBanner() {
    document.getElementById('ex-complete-banner').classList.remove('show');
    var fills = document.querySelectorAll('.ex-rocket-fill');
    for (var i = 0; i < fills.length; i++) fills[i].remove();
    document.getElementById('ex-complete-msg').textContent = '';
    document.getElementById('ex-complete-stats').innerHTML = '';
  }

  function onTypingInput() {
    var ex = EXERCISES[exIdx].text;
    var val = inputEl.value;
    if (val.length > ex.length) val = val.slice(0, ex.length);
    if (!startTime && val.length > 0) startTime = Date.now();

    /* Cumulative keystroke tally for honest accuracy — only counts
       characters as they're newly typed (grows on typing, untouched by
       backspace), never recomputed from the current buffer alone. */
    if (val.length > prevValLen) {
      for (var k = prevValLen; k < val.length; k++) {
        totalKeystrokes++;
        if (val[k] === ex[k]) totalCorrectKeystrokes++;
      }
    }
    prevValLen = val.length;

    var chars = displayEl.children;
    var correctCount = 0, errCount = 0;

    for (var i = 0; i < ex.length; i++) {
      if (i < val.length) {
        if (val[i] === ex[i]) {
          chars[i].className = 'ex-char correct';
          correctCount++;
        } else {
          chars[i].className = 'ex-char incorrect';
          errCount++;
        }
      } else {
        chars[i].className = 'ex-char';
      }
    }

    pos = val.length;
    typedCorrect = correctCount;
    errors = errCount;
    inputEl.value = val;

    updateCurrent();
    updateStats();
    highlightNextKey();

    if (pos >= ex.length) {
      showCompleteBanner();
      inputEl.blur();

      /*
       * IMPORTANT:
       * Save the NEXT exercise immediately when this exercise is
       * completed. This allows the user to close the page without
       * clicking "Next Exercise" and still resume correctly later.
       *
       * Exercise indexes are zero-based:
       * 0 = Exercise 1
       * 1 = Exercise 2
       * 2 = Exercise 3
       * 3 = Exercise 4
       */
      if (exIdx < EXERCISES.length - 1) {
        saveProgress(LESSON_SLUG, exIdx + 1);
      }
    }
  }


  function nextExercise() {
    exIdx++;
    if (exIdx >= EXERCISES.length) { showCompletion(); return; }
    renderExercise();
  }

  function retryExercise() { renderExercise(); }

  /* Fill in the lesson number / message / next-lesson button using the
     lessons manifest. Runs once the (already in-flight, non-blocking)
     fetch resolves — by the time someone finishes 4 exercises this has
     almost always long since completed, so there's no visible delay. */
  function applyManifestToCompletion(manifest) {
    var num = LESSON_NUM, nextEntry = null, keyLabel = LESSON_KEY_LABEL;
    if (manifest && manifest.length) {
      var idx = -1;
      for (var i = 0; i < manifest.length; i++) { if (manifest[i].slug === LESSON_SLUG) { idx = i; break; } }
      if (idx > -1) {
        num = idx + 1;
        nextEntry = manifest[idx + 1] || null;
        if (manifest[idx].keyLabel) keyLabel = manifest[idx].keyLabel;
      }
    }

    document.getElementById('lc-title').textContent = 'Lesson ' + num + ' Complete!';

    var msgEl = document.getElementById('lc-msg');
    var actionsEl = document.getElementById('lc-actions');
    if (nextEntry) {
      msgEl.textContent = 'You\'ve mastered ' + keyLabel + '. Ready for the next key?';
      actionsEl.innerHTML =
        '<a class="btn-lc-primary" href="../learn/' + nextEntry.slug + '">🚀 Continue: ' + nextEntry.title + '</a>'
        + '<a class="btn-lc-secondary" href="../learn">📚 All Lessons</a>';
      nextLessonHref = '../learn/' + nextEntry.slug;
      saveProgress(nextEntry.slug, 0);
    } else {
      msgEl.textContent = 'You\'ve mastered ' + keyLabel + '. New lessons are added regularly — come back soon for the next key.';
      actionsEl.innerHTML =
        '<a class="btn-lc-primary" href="../learn">📚 Back to Lessons</a>'
        + '<a class="btn-lc-secondary" href="../">⌨️ Try the Full Typing Test</a>';
      nextLessonHref = '../learn';
      try { localStorage.removeItem('rt_progress'); } catch (e) { }
    }
  }

  function showCompletion() {
    document.getElementById('lesson-exercise-card').style.display = 'none';
    document.getElementById('lesson-complete').style.display = 'block';
    lessonFinished = true;

    lessonsManifestPromise
      .then(applyManifestToCompletion)
      .catch(function () { applyManifestToCompletion(null); });

    try {
      var done = JSON.parse(localStorage.getItem('rt_lessons_done') || '[]');
      if (done.indexOf(LESSON_SLUG) === -1) {
        done.push(LESSON_SLUG);
        localStorage.setItem('rt_lessons_done', JSON.stringify(done));
      }
    } catch (e) { }
  }

  /* ── Global keyboard rules ──
     1) Space bar must never scroll the page — it always lands in the
        exercise, no matter what currently has focus.
     2) Tab arms a "restart" combo; Enter right after it retries the
        exercise.
     3) Enter by itself, once the exercise is fully typed, advances to
        the next exercise (or finishes the lesson on the last one). */
  var tabArmed = false;

  function onGlobalKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      tabArmed = true;
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (lessonFinished) {
        window.location.href = nextLessonHref;
        return;
      }
      if (tabArmed) {
        tabArmed = false;
        retryExercise();
        return;
      }
      if (pos >= EXERCISES[exIdx].text.length) {
        nextExercise();
      }
      return;
    }

    if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') {
      tabArmed = false;
    }

    if (e.code === 'Space' && document.activeElement !== inputEl) {
      e.preventDefault();
      focusHiddenInput();
      var len = EXERCISES[exIdx].text.length;
      if (pos < len) {
        inputEl.value += ' ';
        onTypingInput();
      }
    }
  }

  /* ═══ PUBLIC API ═══ */
  function init(cfg) {
    EXERCISES = cfg.exercises;
    LESSON_SLUG = cfg.slug;
    LESSON_NUM = cfg.lessonNumber || 1;
    LESSON_KEY_LABEL = cfg.keyLabel || 'this key';

    /* Fetch the shared lesson manifest in the background. This starts
       immediately but is never awaited before rendering — the exercise
       card and keymap appear right away regardless of network speed.
       By the time someone finishes typing (several seconds, minimum),
       this has almost always already resolved, so the "next lesson"
       button is ready before it's needed. manifestUrl defaults to the
       shared lessons.json next to lesson.js/lesson.css. */
    lessonsManifestPromise = fetch(cfg.manifestUrl || 'lessons.json')
      .then(function (res) { return res.ok ? res.json() : null; })
      .catch(function () { return null; });

    var mount = document.getElementById(cfg.mountId || 'lesson-mount');
    if (!mount) return;
    mount.innerHTML = buildMarkup(cfg);

    inputEl = document.getElementById('ex-input');
    displayEl = document.getElementById('ex-display');
    inputEl.addEventListener('input', onTypingInput);
    displayEl.addEventListener('click', focusHiddenInput);
    document.getElementById('btn-ex-next').addEventListener('click', nextExercise);
    document.getElementById('btn-ex-retry').addEventListener('click', retryExercise);
    document.addEventListener('keydown', onGlobalKeydown, false);

    /* "Continue" links from the hub page look like ?ex=2 (0-based) to
       resume at a specific exercise. Anything missing/invalid/out of
       range just falls back to starting at the first exercise. */
    var resumeIdx = parseInt(new URLSearchParams(window.location.search).get('ex'), 10);
    exIdx = (resumeIdx >= 0 && resumeIdx < EXERCISES.length) ? resumeIdx : 0;

    renderExercise();
    kmInit();
  }

  return { init: init };

})();