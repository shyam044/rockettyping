"use strict";
/* ══════════════════════════════════════════════════════════════════════
   PYTHON COMPILER v5.0 — targets the REAL CoreEngine canonical grammar
   (compilers/core-engine.js), not plain JavaScript.

   WHY THIS VERSION EXISTS
   core-engine.js is a hand-written interpreter with its own small
   grammar: let/if/else/while/for/function/return/break/continue,
   arrays, a fixed builtin function list, and a fixed set of array/
   string methods. It has NO classes, NO dict/object literals, NO
   try/catch, NO arrow functions/lambdas-as-values, NO template
   literals, NO destructuring, NO spread. Earlier versions of this
   compiler emitted modern JS (classes, template literals, etc.) which
   that interpreter's parser cannot read at all - that's why even
   `print("Hello World")` was failing with a parser error. This version
   emits ONLY constructs the real interpreter understands.

   Three small, additive builtins were added to core-engine.js to make
   correct Python semantics possible (see callBuiltin in that file):
     truediv(a,b)   - Python's `/` is always float division; the
                      canonical `/` operator intentionally truncates
                      for two integers (correct for C/Java/Go, not
                      Python), so true division needs its own builtin.
     pystr(v)       - like str(), but prints True/False/None the
                      Python way. Needs a real typeof check that the
                      canonical language itself cannot perform.
     pyreversed(v)  - reversed() must return the same shape it was
                      given (string in -> string out, list in -> list
                      out); also needs real typeof.
   Everything else Python needs beyond the raw grammar (enumerate, zip,
   sum, sorted, list.insert/remove/extend, str.startswith, etc.) is
   implemented as small helper functions WRITTEN IN THE CANONICAL
   LANGUAGE ITSELF and prepended to every compiled program - no further
   engine changes required.

   WHAT IS NOT SUPPORTED (and why) - these raise a clear compile-time
   error instead of producing broken output:
     - class / OOP            → the engine has no object/property model
     - dict / set literals     → no object-literal syntax in the grammar
     - try / except / finally  → no exception handling in the grammar
     - lambda used as a value  → functions aren't first-class values in
                                  the engine (Call only dispatches by an
                                  identifier name), so callbacks
                                  (sorted(key=...), map(fn, ...), etc.)
                                  can't work either
     - walrus (:=)             → assignment is a statement, not an
                                  expression, in this grammar
     - *args / **kwargs        → functions are fixed-arity
     - decorators, yield, async, with-statement, multiple inheritance
   Default argument values, tuple unpacking (`a, b = b, a`), f-strings,
   comprehensions used directly in an assignment, slicing, and most
   common str/list operations ARE supported - see the transform code
   below for the exact mapping.
═══════════════════════════════════════════════════════════════════════ */

const PythonCompiler = (() => {

  /* ───────────────────────── low level helpers ───────────────────────── */

  function stripComment(line) {
    let inStr = null, escape = false, out = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (escape) { out += c; escape = false; continue; }
      if (c === '\\') { escape = true; out += c; continue; }
      if (inStr) { out += c; if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; out += c; continue; }
      if (c === '#') break;
      out += c;
    }
    return out;
  }

  function countOccurrences(str, sub) {
    let n = 0, i = 0;
    while ((i = str.indexOf(sub, i)) !== -1) { n++; i += sub.length; }
    return n;
  }

  function splitTopLevel(str, sep = ',') {
    const parts = [];
    let depth = 0, cur = '', inStr = null, escape = false;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (escape) { cur += c; escape = false; continue; }
      if (inStr) {
        cur += c;
        if (c === '\\') escape = true;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'") { inStr = c; cur += c; continue; }
      if (c === '(' || c === '[' || c === '{') { depth++; cur += c; continue; }
      if (c === ')' || c === ']' || c === '}') { depth--; cur += c; continue; }
      if (depth === 0 && str.slice(i, i + sep.length) === sep) {
        parts.push(cur); cur = ''; i += sep.length - 1; continue;
      }
      cur += c;
    }
    if (cur.trim() !== '' || parts.length > 0) parts.push(cur);
    return parts.map(p => p.trim()).filter(p => p.length > 0);
  }

  function findTopLevelKeyword(str, kw) {
    let depth = 0, inStr = null, escape = false;
    const re = new RegExp('^' + kw + '\\b');
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (escape) { escape = false; continue; }
      if (inStr) { if (c === '\\') escape = true; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (depth === 0 && re.test(str.slice(i))) return i;
    }
    return -1;
  }

  // top-level ':' inside [ ] used for slicing (not dict/annotation colons,
  // since we don't support those anyway - this only ever looks inside brackets)
  function splitSliceColon(inner) {
    const parts = [];
    let depth = 0, inStr = null, cur = '';
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (inStr) { cur += c; if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; cur += c; continue; }
      if (c === '(' || c === '[') { depth++; cur += c; continue; }
      if (c === ')' || c === ']') { depth--; cur += c; continue; }
      if (c === ':' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }

  class UnsupportedError extends Error {}

  function unsupported(feature, why) {
    throw new UnsupportedError(`${feature} is not supported on this platform${why ? ' (' + why + ')' : ''}.`);
  }

  /* ───────────────────────── string masking ─────────────────────────
     Keyword passes (and/or/not/in/is - though and/or/not pass through
     unchanged here, in/is do not) must never touch text inside string
     literals. Mask every string literal before those passes and restore
     it right before returning. */

  const MASK_OPEN = '\u0002', MASK_CLOSE = '\u0003';

  function maskStrings(content) {
    const store = [];
    let out = '', inStr = null, escape = false, buf = '';
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      if (inStr) {
        buf += c;
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === inStr) { store.push(buf); out += MASK_OPEN + (store.length - 1) + MASK_CLOSE; inStr = null; buf = ''; }
        continue;
      }
      if (c === '"' || c === "'") { inStr = c; buf = c; continue; }
      out += c;
    }
    if (inStr) out += buf;
    return { masked: out, store };
  }

  function unmaskStrings(content, store) {
    const re = new RegExp(MASK_OPEN + '(\\d+)' + MASK_CLOSE, 'g');
    return content.replace(re, (m, i) => store[parseInt(i, 10)]);
  }

  // Literal text (unescaped) of a masked placeholder / plain quoted string,
  // used at compile time for %-format and .format() literal parsing.
  function literalStringValue(maskedTokenOrRaw, store) {
    let raw = maskedTokenOrRaw;
    const m = raw.match(new RegExp('^' + MASK_OPEN + '(\\d+)' + MASK_CLOSE + '$'));
    if (m) raw = store[parseInt(m[1], 10)];
    if (!raw || (raw[0] !== '"' && raw[0] !== "'")) return null;
    const q = raw[0];
    if (raw[raw.length - 1] !== q || raw.length < 2) return null;
    let body = raw.slice(1, -1), out = '';
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '\\' && i + 1 < body.length) {
        const e = body[i + 1];
        const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
        out += map[e] !== undefined ? map[e] : e;
        i++;
      } else out += body[i];
    }
    return out;
  }

  function jsQuote(s) {
    return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
  }

  /* ───────────────────────── f-strings ─────────────────────────
     f"...{expr}..." -> ("literal" + pystr(expr) + "literal" ...)
     (canonical has no template-literal interpolation, so this always
     becomes plain string concatenation; pystr() keeps True/False/None
     capitalised the Python way.) */

  // Turns a Python format-spec-mini-language string (the part after ':' in
  // f"{x:.2f}", or after '%' in "%5.2f") into a canonical expression.
  // Supports the common cases (fixed decimals, width, alignment); anything
  // fancier (thousands separators, sign forcing, hex/oct/bin specs) falls
  // back to plain str() rather than erroring, since getting the shape
  // approximately right beats refusing to compile.
  function buildFormattedValue(exprText, spec) {
    const m = spec.match(/^([<>^]?)(\d*)(?:\.(\d+))?([fdxXob%]?)$/);
    if (!m) return `pystr(${exprText})`;
    const [, align, width, prec, type] = m;
    let valueExpr;
    if (type === 'f') valueExpr = `pyfixed(${exprText}, ${prec !== undefined ? prec : 6})`;
    else if (type === 'd') valueExpr = `pystr(pyint(${exprText}))`;
    else if (type === '%') valueExpr = `(pyfixed((${exprText}) * 100, ${prec !== undefined ? prec : 6}) + "%")`;
    else if (type === 'x') valueExpr = `hex(${exprText}).slice(2)`;
    else if (type === 'X') valueExpr = `hex(${exprText}).slice(2).upper()`;
    else if (type === 'o') valueExpr = `oct(${exprText}).slice(2)`;
    else if (type === 'b') valueExpr = `bin(${exprText}).slice(2)`;
    else valueExpr = `pystr(${exprText})`;
    if (width) return `pypad(${valueExpr}, ${width}, ${jsQuote(align || '')})`;
    return valueExpr;
  }

  // Python bytes literals b'...' / B"..." - since bytes are already modeled
  // as plain strings/char-code arrays elsewhere (.encode()/.decode()), just
  // drop the 'b' prefix and treat it as an ordinary string literal.
  function stripBytesPrefix(content) {
    return content.replace(/(^|[^\w])[bB](['"])/g, (m, pre, q) => pre + q);
  }

  function expandFStrings(line) {
    return line.replace(/f(["'])([\s\S]*?)\1/g, (_, quote, content) => {
      const parts = [];
      let i = 0;
      while (i < content.length) {
        if (content[i] === '{' && content[i + 1] === '{') { parts.push(jsQuote('{')); i += 2; continue; }
        if (content[i] === '}' && content[i + 1] === '}') { parts.push(jsQuote('}')); i += 2; continue; }
        if (content[i] === '{') {
          let depth = 1, j = i + 1;
          while (j < content.length && depth > 0) {
            if (content[j] === '{') depth++; else if (content[j] === '}') depth--;
            j++;
          }
          let inner = content.slice(i + 1, j - 1);
          // find the format-spec colon at bracket depth 0 (so slicing like
          // {x[1:2]} isn't mistaken for a format spec)
          let bd = 0, specIdx = -1, inStr = null;
          for (let k = 0; k < inner.length; k++) {
            const c = inner[k];
            if (inStr) { if (c === inStr) inStr = null; continue; }
            if (c === '"' || c === "'") { inStr = c; continue; }
            if (c === '(' || c === '[') bd++;
            else if (c === ')' || c === ']') bd--;
            else if (c === ':' && bd === 0) { specIdx = k; break; }
          }
          let spec = null;
          if (specIdx >= 0) { spec = inner.slice(specIdx + 1); inner = inner.slice(0, specIdx); }
          const convMatch = inner.match(/!([rsa])$/);
          const conv = convMatch ? convMatch[1] : null;
          if (conv) inner = inner.slice(0, convMatch.index);
          inner = inner.trim();
          const exprText = inner;
          parts.push(spec ? buildFormattedValue(exprText, spec.trim()) : `pystr(${exprText})`);
          i = j;
        } else {
          let j = i;
          while (j < content.length && content[j] !== '{' && content[j] !== '}') j++;
          if (j > i) parts.push(jsQuote(content.slice(i, j)));
          i = j;
        }
      }
      if (parts.length === 0) return '""';
      return '(' + parts.join(' + ') + ')';
    });
  }

  /* ───────────────────────── slicing ─────────────────────────
     NAME[a:b] -> NAME.slice(a, b)      (works for both strings & lists)
     NAME[::-1] -> pyreversed(NAME)     (the one step value we can support) */

  // The engine's parser now understands `{key: value, ...}` dict literals
  // natively, so those pass straight through untouched. Python set
  // literals `{a, b, c}` (no colon) have no engine equivalent, so they
  // become an array-based pyset(...) helper call instead.
  function convertSetLiterals(content) {
    let changed = true, guard = 0;
    while (changed && guard++ < 10) {
      changed = false;
      content = content.replace(/\{([^{}]*)\}/g, (m, inner) => {
        if (inner.trim() === '') return m; // {} is an empty dict in Python
        // a generated function/block body (from lambda conversion) looks
        // like `{ return (x * x); }` - it has no colon either, but it's
        // definitely not a Python set literal, so bail out on anything
        // that looks like a statement rather than a bare expression list.
        if (/;|\breturn\b/.test(inner)) return m;
        if (/^\s*\*\*/.test(inner) || /,\s*\*\*/.test(inner)) return m; // dict spread {**a, **b} - leave for the engine
        let depth = 0, inStr = null, hasColon = false;
        for (let i = 0; i < inner.length; i++) {
          const c = inner[i];
          if (inStr) { if (c === inStr) inStr = null; continue; }
          if (c === '"' || c === "'") { inStr = c; continue; }
          if (c === '(' || c === '[') depth++;
          else if (c === ')' || c === ']') depth--;
          else if (c === ':' && depth === 0) { hasColon = true; break; }
        }
        if (hasColon) return m; // real dict literal - leave for the engine
        changed = true;
        return `pyset([${inner}])`;
      });
    }
    return content;
  }

  function convertSlicing(content) {
    const RECV = '(\\u0002\\d+\\u0003|[A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*|\\[[^\\[\\]]*\\]|\\([^()]*\\))*)';
    const re = new RegExp(RECV + '\\[([^\\[\\]]*)\\]', 'g');
    let changed = true, guard = 0;
    while (changed && guard++ < 10) {
      changed = false;
      content = content.replace(re, (m, recv, inner) => {
        if (!inner.includes(':')) return m;
        const segs = splitSliceColon(inner);
        if (segs.length > 3) return m;
        const [s, e, st] = [segs[0] || '', segs[1] || '', segs[2] || ''];
        changed = true;
        const arg = v => v.trim() === '' ? 'null' : `(${v.trim()})`;
        return `pyslicestep(${recv}, ${arg(s)}, ${arg(e)}, ${arg(st)})`;
      });
    }
    return content;
  }

  /* ───────────────────────── list/dict/set comprehensions ─────────────────────────
     Only usable as the entire right-hand side of a simple assignment -
     the engine has no expression-level function literals to build an
     inline map/filter chain, so comprehensions must be expanded into an
     explicit preceding loop. Returns null if `rhs` isn't a comprehension. */

  function findTopLevelColon(str) {
    let depth = 0, inStr = null;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (inStr) { if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ':' && depth === 0) return i;
    }
    return -1;
  }

  function expandComprehension(varName, rhs) {
    let kind, inner;
    let m = rhs.match(/^\[([\s\S]*)\]$/);
    if (m) { kind = 'list'; inner = m[1]; }
    else {
      m = rhs.match(/^\{([\s\S]*)\}$/);
      if (!m) return null;
      inner = m[1];
      const forIdxProbe = findTopLevelKeyword(inner, 'for');
      const exprPart = forIdxProbe === -1 ? inner : inner.slice(0, forIdxProbe);
      kind = findTopLevelColon(exprPart) !== -1 ? 'dict' : 'set';
    }
    const forIdx = findTopLevelKeyword(inner, 'for');
    if (forIdx === -1) return null;
    const rawExpr = inner.slice(0, forIdx).trim();
    let rest = inner.slice(forIdx + 3);
    const inIdx = findTopLevelKeyword(rest, 'in');
    if (inIdx === -1) return null;
    const loopVarRaw = rest.slice(0, inIdx).trim();
    rest = rest.slice(inIdx + 2);
    const ifIdx = findTopLevelKeyword(rest, 'if');
    let rawIter, rawCond = null;
    if (ifIdx === -1) rawIter = rest.trim();
    else { rawIter = rest.slice(0, ifIdx).trim(); rawCond = rest.slice(ifIdx + 2).trim(); }

    const iterExpr = transformExpression(rawIter);
    const cond = rawCond !== null ? transformExpression(rawCond) : null;

    let loopVar = loopVarRaw, unpackPreamble = '';
    if (loopVarRaw.includes(',')) {
      const names = loopVarRaw.split(',').map(s => s.trim());
      loopVar = '__cval';
      unpackPreamble = names.map((n, i) => `${n} = __cval[${i}];`).join(' ') + ' ';
    }

    const lines = [];
    if (kind === 'dict') {
      const colonAt = findTopLevelColon(rawExpr);
      if (colonAt === -1) unsupported('Malformed dict comprehension', 'expected `{key: value for ...}`');
      const key = transformExpression(rawExpr.slice(0, colonAt).trim());
      const val = transformExpression(rawExpr.slice(colonAt + 1).trim());
      lines.push(`${varName} = {};`);
      lines.push(`for (${loopVar} in ${iterExpr}) {`);
      const body = `${varName}[${key}] = ${val};`;
      lines.push(cond ? `${unpackPreamble}if (${cond}) { ${body} }` : `${unpackPreamble}${body}`);
      lines.push('}');
      return lines;
    }

    const expr = transformExpression(rawExpr);
    lines.push(`${varName} = [];`);
    lines.push(`for (${loopVar} in ${iterExpr}) {`);
    const push = `${varName}.push(${expr});`;
    lines.push(cond ? `${unpackPreamble}if (${cond}) { ${push} }` : `${unpackPreamble}${push}`);
    lines.push('}');
    if (kind === 'set') lines.push(`${varName} = pyset(${varName});`);
    return lines;
  }

  /* ───────────────────────── method-call rewriting ───────────────────────── */

  const RECV = '(\\u0002\\d+\\u0003|[A-Za-z_]\\w*(?:\\.[A-Za-z_]\\w*|\\[[^\\[\\]]*\\]|\\([^()]*\\))*)';

  // Finds the index of the ')' matching the '(' at openIdx (which must be
  // content[openIdx] === '('). Operates on already-masked content, so no
  // string-literal awareness is needed here.
  function findMatchingParen(content, openIdx) {
    let depth = 0, inStr = null, escape = false;
    for (let i = openIdx; i < content.length; i++) {
      const c = content[i];
      if (inStr) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }

  function replaceCall(content, methodName, fn) {
    const re = new RegExp(RECV + '\\.' + methodName + '\\(', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(content)) !== null) {
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = findMatchingParen(content, openIdx);
      if (closeIdx === -1) continue;
      const args = content.slice(openIdx + 1, closeIdx);
      out += content.slice(last, m.index) + fn(m[1], args);
      last = closeIdx + 1;
      re.lastIndex = closeIdx + 1;
    }
    out += content.slice(last);
    return out;
  }

  function convertMethodCalls(content) {
    // list-ish (native methods that already exist in callMethod)
    content = replaceCall(content, 'append', (r, a) => `${r}.push(${a})`);
    content = replaceCall(content, 'extend', (r, a) => `pyextend(${r}, ${a})`);
    content = replaceCall(content, 'insert', (r, a) => {
      const p = splitTopLevel(a, ',');
      return `pyinsert(${r}, ${p[0]}, ${p[1]})`;
    });
    content = replaceCall(content, 'remove', (r, a) => `pyremove(${r}, ${a})`);
    content = replaceCall(content, 'count', (r, a) => `pycount(${r}, ${a})`);
    content = replaceCall(content, 'index', (r, a) => `${r}.indexOf(${splitTopLevel(a, ',')[0]})`);
    content = replaceCall(content, 'reverse', (r) => `${r}.reverse()`);

    // strings
    content = replaceCall(content, 'strip', (r) => `${r}.strip()`);
    content = replaceCall(content, 'lstrip', (r) => `${r}.strip()`); // approximation - see notes
    content = replaceCall(content, 'rstrip', (r) => `${r}.strip()`); // approximation - see notes
    content = replaceCall(content, 'upper', (r) => `${r}.upper()`);
    content = replaceCall(content, 'lower', (r) => `${r}.lower()`);
    content = replaceCall(content, 'startswith', (r, a) => `pystartswith(${r}, ${a})`);
    content = replaceCall(content, 'endswith', (r, a) => `pyendswith(${r}, ${a})`);
    content = replaceCall(content, 'find', (r, a) => `${r}.indexOf(${a})`);
    content = replaceCall(content, 'replace', (r, a) => `${r}.replace(${a})`);
    content = replaceCall(content, 'split', (r, a) => `${r}.split(${a})`);
    content = replaceJoin(content);
    content = replaceCall(content, 'capitalize', (r) => `pycapitalize(${r})`);
    content = replaceCall(content, 'title', (r) => `pycapitalize(${r})`); // approximation (whole-string only)
    content = replaceCall(content, 'isdigit', (r) => `pyisdigit(${r})`);
    content = replaceCall(content, 'encode', (r) => `pyencode(${r})`);
    content = replaceCall(content, 'decode', (r) => `pydecode(${r})`);

    return content;
  }

  function replaceJoin(content) {
    const re = new RegExp(RECV + '\\.join\\(', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(content)) !== null) {
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = findMatchingParen(content, openIdx);
      if (closeIdx === -1) continue;
      const args = content.slice(openIdx + 1, closeIdx);
      out += content.slice(last, m.index) + `(${args}).join(${m[1]})`;
      last = closeIdx + 1;
      re.lastIndex = closeIdx + 1;
    }
    out += content.slice(last);
    return out;
  }

  // Python's list.sort() sorts in place with no return value semantics
  // that matter here; the engine's native .sort() with no args already
  // gives a sensible default (numeric-or-string) comparator, so this is
  // just a straight passthrough (no key= support - see header notes).
  function convertSortCalls(content) {
    const re = new RegExp(RECV + '\\.sort\\(', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(content)) !== null) {
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = findMatchingParen(content, openIdx);
      if (closeIdx === -1) continue;
      const args = content.slice(openIdx + 1, closeIdx);
      let keyFn = 'null', reverse = 'false';
      for (const p of splitTopLevel(args, ',')) {
        const mk = p.match(/^key\s*=\s*([\s\S]+)$/);
        const mr = p.match(/^reverse\s*=\s*([\s\S]+)$/);
        if (mk) keyFn = mk[1];
        if (mr) reverse = mr[1];
      }
      out += content.slice(last, m.index) + `pysortinplace(${m[1]}, ${keyFn}, ${reverse})`;
      last = closeIdx + 1;
      re.lastIndex = closeIdx + 1;
    }
    out += content.slice(last);
    return out;
  }

  /* ───────────────────────── operators ───────────────────────── */

  // Captures a "simple operand" immediately to the left/right of a binary
  // operator - identifier chains, indexing, calls, parenthesised groups,
  // numbers, masked strings. Good enough for the vast majority of student
  // code; deeply nested chained expressions are a documented limitation.
  const OPERAND = '[\\w.\\]\\)\\u0002\\u0003]+(?:\\([^()]*\\))?';

  function convertDivMod(content) {
    // true division: a / b  -> truediv(a, b)   (but never `//`)
    content = content.replace(new RegExp('(' + OPERAND + ')\\s*/(?!/)\\s*(' + OPERAND + ')', 'g'),
      (m, a, b) => `truediv(${a}, ${b})`);
    // Python modulo (floor-based sign) - `%`  -> pymod(a, b)
    content = content.replace(new RegExp('(' + OPERAND + ')\\s*%\\s*(' + OPERAND + ')', 'g'),
      (m, a, b) => `pymod(${a}, ${b})`);
    return content;
  }

  function convertMembership(content) {
    content = content.replace(/\bnot\s+in\b/g, '\u0001NOTIN\u0001');
    content = content.replace(new RegExp('(' + OPERAND + ')\\s*\\u0001NOTIN\\u0001\\s*(' + OPERAND + ')', 'g'),
      (m, a, b) => `(not pyin(${a}, ${b}))`);
    content = content.replace(new RegExp('(' + OPERAND + ')\\s+in\\s+(' + OPERAND + ')', 'g'),
      (m, a, b) => `pyin(${a}, ${b})`);
    return content;
  }

  function convertIdentity(content) {
    content = content.replace(/\bis\s+not\b/g, '!=');
    content = content.replace(/\bis\b/g, '==');
    return content;
  }

  /* ───────────────────────── tuple unpacking ───────────────────────── */

  function convertUnpacking(content) {
    const m = content.match(/^((?:\*?[A-Za-z_]\w*)(?:\s*,\s*\*?[A-Za-z_]\w*)+)\s*=\s*([^=].*)$/);
    if (!m) return null;
    const rawTargets = m[1].split(',').map(s => s.trim());
    const starTargets = rawTargets.filter(t => t.startsWith('*'));
    if (starTargets.length > 1) unsupported('Multiple starred targets in one unpacking assignment', 'Python itself only allows one');
    const starIdx = rawTargets.findIndex(t => t.startsWith('*'));

    const tmp = '__unpack';
    let rhsText = m[2].trim();
    if (splitTopLevel(convertTupleLiterals(rhsText), ',').length > 1) rhsText = '[' + rhsText + ']';
    const lines = [`${tmp} = ${transformExpression(rhsText)};`];
    if (starIdx === -1) {
      rawTargets.forEach((t, i) => lines.push(`${t} = ${tmp}[${i}];`));
    } else {
      const before = rawTargets.slice(0, starIdx);
      const starName = rawTargets[starIdx].slice(1);
      const after = rawTargets.slice(starIdx + 1);
      before.forEach((t, i) => lines.push(`${t} = ${tmp}[${i}];`));
      if (after.length === 0) {
        lines.push(`${starName} = ${tmp}.slice(${before.length});`);
      } else {
        lines.push(`${starName} = ${tmp}.slice(${before.length}, len(${tmp}) - ${after.length});`);
        after.forEach((t, i) => lines.push(`${t} = ${tmp}[len(${tmp}) - ${after.length - i}];`));
      }
    }
    return lines;
  }

  /* ───────────────────────── def params ─────────────────────────
     canonical function params are bare names with no default-value
     syntax at all, so defaults are applied via a body preamble instead
     (the engine already fills missing call args with null). */

  function transformDefParams(paramsStr) {
    const parts = splitTopLevel(paramsStr, ',');
    const names = [];
    const preambleLines = [];
    for (let p of parts) {
      p = p.trim();
      if (!p) continue;
      if (p.startsWith('*')) unsupported('*args / **kwargs', 'the engine only supports fixed-arity functions');
      let name = p, def = null;
      const eq = splitTopLevel(p, '=');
      if (eq.length > 1) { name = eq[0]; def = eq.slice(1).join('='); }
      name = name.split(':')[0].trim();
      names.push(name);
      if (def !== null) preambleLines.push(`if (${name} == null) { ${name} = ${transformExpression(def)}; }`);
    }
    return { params: names.join(', '), preamble: preambleLines.join(' ') };
  }

  /* ───────────────────────── main transpiler ───────────────────────── */

  function toCanonical(src) {
    src = src.replace(/\t/g, '    ').replace(/\r\n?/g, '\n');
    const rawLines = src.split('\n');
    const out = [];
    const indentStack = [0];
    const blockStack = [null];
    let pendingBlock = null;
    let inMultiline = false, multilineQuote = null;

    function emit(line) { out.push(line); }

    function closeBlocksTo(indent) {
      while (indent < indentStack[indentStack.length - 1]) {
        indentStack.pop(); blockStack.pop();
        emit('}');
      }
    }

    function hasFollowingContinuation(fromLine, indent) {
      for (let k = fromLine + 1; k < rawLines.length; k++) {
        const stripped = stripComment(rawLines[k]);
        if (stripped.trim() === '') continue;
        const ind = stripped.match(/^(\s*)/)[0].length;
        if (ind !== indent) return false;
        return /^(elif|else|except|finally)\b/.test(stripped.trim());
      }
      return false;
    }

    function countExceptClauses(fromLine, indent) {
      let count = 0;
      for (let k = fromLine + 1; k < rawLines.length; k++) {
        const stripped = stripComment(rawLines[k]);
        if (stripped.trim() === '') continue;
        const ind = stripped.match(/^(\s*)/)[0].length;
        if (ind < indent) break;
        if (ind > indent) continue; // inside a block body, skip
        if (/^except\b/.test(stripped.trim())) { count++; continue; }
        if (/^finally\b/.test(stripped.trim())) continue;
        break;
      }
      return count;
    }

    for (let pyLine = 0; pyLine < rawLines.length; pyLine++) {
      const raw = rawLines[pyLine];

      if (inMultiline) {
        const q = multilineQuote;
        if (raw.includes(q)) {
          const idx = raw.indexOf(q);
          emit(raw.slice(0, idx) + '"' + (raw.slice(idx + 3) ? ';' : ''));
          inMultiline = false; multilineQuote = null;
          continue;
        }
        emit(jsQuote(raw).slice(0, -1)); // keep as a standalone-ish line; best effort
        continue;
      }

      let line = stripComment(raw);
      if (line.trim() === '') { emit(''); continue; }

      const indent = line.match(/^(\s*)/)[0].length;
      let content = line.slice(indent);

      let openedTriple = false;
      for (const q of ['"""', "'''"]) {
        if (countOccurrences(content, q) % 2 === 1) {
          closeBlocksTo(indent);
          const idx = content.indexOf(q);
          emit(' '.repeat(indent) + content.slice(0, idx) + '"' + content.slice(idx + 3));
          inMultiline = true; multilineQuote = q; pendingBlock = null; openedTriple = true;
          break;
        }
      }
      if (openedTriple) continue;

      content = content.replace(/"""([\s\S]*?)"""/g, (m, inner) => jsQuote(inner));
      content = content.replace(/'''([\s\S]*?)'''/g, (m, inner) => jsQuote(inner));

      closeBlocksTo(indent);

      if (indent > indentStack[indentStack.length - 1]) {
        indentStack.push(indent);
        blockStack.push(pendingBlock || { kind: 'other' });
        pendingBlock = null;
      }

      const trimmed = content.trim();
      const enclosingKind = blockStack[blockStack.length - 1] ? blockStack[blockStack.length - 1].kind : null;
      const continues = hasFollowingContinuation(pyLine, indent);

      if (/^try\s*:$/.test(trimmed)) {
        const exceptCount = countExceptClauses(pyLine, indent);
        if (exceptCount > 1) {
          throw new UnsupportedError(`Line ${pyLine + 1}: Multiple \`except\` clauses on one \`try\` are not supported (the engine's grammar only allows a single catch per try) - combine them into one \`except:\` block.\n    ${trimmed}`);
        }
      }

      let result;
      try {
        result = compileStatement(trimmed, enclosingKind, continues);
      } catch (e) {
        if (e instanceof UnsupportedError) {
          throw new UnsupportedError(`Line ${pyLine + 1}: ${e.message}\n    ${trimmed}`);
        }
        throw e;
      }

      if (result.opensBlock) pendingBlock = result.blockInfo;
      if (result.selfPush) { indentStack.push(indent + 0.5); blockStack.push(result.blockInfo || { kind: 'other' }); }

      for (const codeLine of result.lines) emit(' '.repeat(indent) + codeLine);
    }

    closeBlocksTo(0);
    return PRELUDE + '\n' + out.join('\n') + '\n';
  }

  function compileStatement(stmt, enclosingKind, continues) {
    const HEADER_RE = /^(if|elif|else|while|for|def|try|except|finally)\b/;
    if (/^(class|with|lambda\s)\b/.test(stmt)) {
      const kw = stmt.match(/^\s*(\w+)/)[1];
      unsupported(`\`${kw}\``, 'not representable in the engine\'s grammar');
    }
    if (/:=/.test(stmt)) unsupported('The walrus operator (:=)', 'assignment is a statement, not an expression, in this grammar');
    if (/^\s*(global|nonlocal)\b/.test(stmt)) return { lines: [], opensBlock: false };
    if (/^\s*@/.test(stmt)) unsupported('Decorators', 'not representable in the engine\'s grammar');

    if (HEADER_RE.test(stmt)) {
      const colonIdx = findHeaderColon(stmt);
      if (colonIdx === -1) return { lines: [transformExpression(stmt) + ';'], opensBlock: false };
      const header = stmt.slice(0, colonIdx);
      const restRaw = stmt.slice(colonIdx + 1).trim();
      const headerType = header.match(/^\w+/)[0];
      const headerResult = compileHeader(header, enclosingKind);

      if (restRaw) {
        const bodyLines = splitTopLevel(restRaw, ';').flatMap(p => compileStatement(p.trim(), null, false).lines);
        const canContinue = ['if', 'elif', 'while', 'for'].includes(headerType);
        if (canContinue && continues) {
          return { lines: [headerResult.code, ...bodyLines], opensBlock: false, selfPush: true, blockInfo: { kind: 'oneliner' } };
        }
        return { lines: [headerResult.code, ...bodyLines, '}'], opensBlock: false };
      }
      return { lines: [headerResult.code], opensBlock: true, blockInfo: headerResult.blockInfo };
    }

    if (splitTopLevel(stmt, ';').length > 1) {
      return { lines: splitTopLevel(stmt, ';').flatMap(s => compileStatement(s.trim(), enclosingKind, false).lines), opensBlock: false };
    }

    return { lines: transformStatement(stmt), opensBlock: false };
  }

  function findHeaderColon(stmt) {
    let depth = 0, inStr = null, escape = false;
    for (let i = 0; i < stmt.length; i++) {
      const c = stmt[i];
      if (escape) { escape = false; continue; }
      if (inStr) { if (c === '\\') escape = true; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ':' && depth === 0) return i;
    }
    return -1;
  }

  function compileHeader(header, enclosingKind) {
    let m;
    if ((m = header.match(/^if\s+([\s\S]+)$/))) return { code: `if (${transformExpression(m[1])}) {`, blockInfo: { kind: 'other' } };
    if ((m = header.match(/^elif\s+([\s\S]+)$/))) return { code: `else if (${transformExpression(m[1])}) {`, blockInfo: { kind: 'other' } };
    if (header.match(/^else\s*$/)) return { code: `else {`, blockInfo: { kind: 'other' } };
    if ((m = header.match(/^while\s+([\s\S]+)$/))) return { code: `while (${transformExpression(m[1])}) {`, blockInfo: { kind: 'other' } };

    if ((m = header.match(/^for\s+([\s\S]+?)\s+in\s+([\s\S]+)$/))) {
      const targetRaw = m[1].trim();
      const iterExpr = transformExpression(m[2]);
      if (targetRaw.includes(',')) {
        const names = targetRaw.split(',').map(s => s.trim());
        const preamble = names.map((n, i) => `${n} = __tup[${i}];`).join(' ');
        return { code: `for (__tup in ${iterExpr}) { ${preamble}`, blockInfo: { kind: 'for-unpack' } };
      }
      return { code: `for (${targetRaw} in ${iterExpr}) {`, blockInfo: { kind: 'other' } };
    }

    if (header.match(/^try\s*$/)) return { code: `try {`, blockInfo: { kind: 'try' } };
    if ((m = header.match(/^except\s*([\s\S]*)$/))) {
      const spec = m[1].trim();
      const asMatch = spec.match(/^([\s\S]+?)\s+as\s+([A-Za-z_]\w*)$/);
      const alias = asMatch ? asMatch[2] : null;
      // NOTE: exception *type* is not checked - the engine has no
      // exception-type model, so every except clause here behaves like
      // a bare `except:` that catches anything. Only one except clause
      // per try is supported (checked earlier, at the `try:` line).
      // The exception is always bound to __err internally (in addition
      // to any `as name` alias) so a bare `raise` (re-raise) inside the
      // except block can reliably reference the current exception.
      return { code: `catch (__err) {${alias ? ` ${alias} = __err;` : ''}`, blockInfo: { kind: 'other' } };
    }
    if (header.match(/^finally\s*$/)) return { code: `finally {`, blockInfo: { kind: 'other' } };

    if ((m = header.match(/^def\s+([A-Za-z_]\w*)\s*\(([\s\S]*)\)\s*(?:->\s*[^:]+)?$/))) {
      const [, name, paramsRaw] = m;
      const { params, preamble } = transformDefParams(paramsRaw);
      return { code: `function ${name}(${params}) {${preamble ? ' ' + preamble : ''}`, blockInfo: { kind: 'function', name } };
    }

    unsupported(`\`${header.trim()}\``, 'unrecognised statement header');
  }

  function transformStatement(stmt) {
    if (/^return\b/.test(stmt)) {
      const rest = stmt.replace(/^return\s*/, '').trim();
      return [rest ? `return ${transformExpression(rest)};` : `return;`];
    }
    if (/^pass\s*$/.test(stmt)) return [';'];
    if (/^break\s*$/.test(stmt)) return ['break;'];
    if (/^continue\s*$/.test(stmt)) return ['continue;'];
    if (/^assert\s+/.test(stmt)) {
      const rest = stmt.replace(/^assert\s*/, '');
      const parts = splitTopLevel(rest, ',');
      const cond = transformExpression(parts[0]);
      const msg = parts[1] ? transformExpression(parts[1]) : jsQuote('Assertion failed: ' + parts[0]);
      return [`if (not (${cond})) { throw ${msg}; }`];
    }
    if (/^del\s+/.test(stmt)) {
      const rest = stmt.replace(/^del\s*/, '');
      const lines = [];
      for (const target of splitTopLevel(rest, ',')) {
        const m = target.trim().match(/^([\s\S]+)\[([\s\S]+)\]$/);
        if (!m) unsupported('`del`', 'only `del container[key]` is supported (deleting a whole variable is a no-op in this grammar)');
        lines.push(`pydel(${transformExpression(m[1])}, ${transformExpression(m[2])});`);
      }
      return lines;
    }
    if (/^(import|from)\s+/.test(stmt)) {
      const ALLOWED = new Set(['math', 'random', 'json', 'string', 'collections', 'functools', 'base64', 'sys', 'importlib']);
      const m = stmt.match(/^import\s+([\w.]+)/) || stmt.match(/^from\s+([\w.]+)\s+import/);
      const moduleName = m ? m[1].split('.')[0] : null;
      if (moduleName === '__hello__') {
        // a real, if silly, CPython easter egg module: importing it prints
        // "Hello world!" - reproduced here since it's genuinely all it does.
        return [`print(pystr(${jsQuote('Hello world!')}));`];
      }
      if (moduleName && !ALLOWED.has(moduleName)) {
        unsupported(
          `\`import ${moduleName}\``,
          `only a small curated set of stdlib helpers is available here (${Array.from(ALLOWED).join(', ')}), each mapped onto engine builtins - there's no real filesystem, network, OS, GUI, or C-extension access in this sandbox, and third-party packages (numpy, pandas, requests, etc.) can't be installed at all`
        );
      }
      return [''];
    }
    if (/^importlib\.import_module\(/.test(stmt)) {
      const m = stmt.match(/^importlib\.import_module\((["'])(.*?)\1\)\s*$/);
      if (m && m[2] === '__hello__') return [`print(pystr(${jsQuote('Hello world!')}));`];
      unsupported('importlib.import_module() for anything other than "__hello__"', 'there are no real importable module objects in this sandbox - only the fixed set of stdlib shims already listed');
    }
    if (/^exec\(/.test(stmt)) {
      const m = stmt.match(/^exec\((["'])([\s\S]*)\1\)\s*$/);
      if (!m) unsupported('exec() with a non-literal argument', 'the engine has no runtime code-generation hook, so exec() only works when the string is known at compile time');
      const literal = literalStringValue(m[1] + m[2] + m[1], null);
      const execLines = literal.split('\n').filter(l => l.trim() !== '');
      return execLines.flatMap(l => compileStatement(l.trim(), null, false).lines);
    }
    if (/^raise\b/.test(stmt)) {
      const rest = stmt.replace(/^raise\s*/, '').trim();
      if (!rest) return [`throw __err;`]; // bare re-raise (see except-clause note above)
      // raise Exception("msg") / raise ValueError("msg") / raise "msg" -> throw the message
      const callMatch = rest.match(/^[A-Za-z_]\w*\(([\s\S]*)\)$/);
      const msgExpr = callMatch ? (callMatch[1].trim() || jsQuote('Error')) : rest;
      return [`throw ${transformExpression(msgExpr)};`];
    }

    // tuple-unpacking assignment: a, b = b, a  (checked first since the
    // single-target regex below can't match a comma-separated LHS)
    const unpacked = convertUnpacking(stmt);
    if (unpacked) return unpacked;

    // simple assignment: NAME = EXPR  (comprehension-aware)
    const assignMatch = stmt.match(/^([A-Za-z_]\w*(?:\[[^\]]*\])?)\s*=\s*(?!=)([\s\S]+)$/);
    if (assignMatch) {
      const [, target, rhs] = assignMatch;
      const compre = expandComprehension(target, rhs.trim());
      if (compre) return compre;
      return [`${target} = ${transformExpression(rhs)};`];
    }
    // augmented assignment a += b  etc (already valid canonical syntax)
    const augMatch = stmt.match(/^([A-Za-z_]\w*(?:\[[^\]]*\])?)\s*([+\-*\/%]|\*\*)=\s*([\s\S]+)$/);
    if (augMatch) {
      const [, target, op, rhs] = augMatch;
      if (op === '/') return [`${target} = truediv(${target}, ${transformExpression(rhs)});`];
      if (op === '%') return [`${target} = pymod(${target}, ${transformExpression(rhs)});`];
      return [`${target} ${op}= ${transformExpression(rhs)};`];
    }

    return [transformExpression(stmt) + ';'];
  }

  // lambda params: expr  ->  function(params) { return (expr); }
  // Must run BEFORE string masking - it recursively calls transformExpression
  // on the extracted body, which does its own independent masking pass, and
  // feeding it already-masked text would break (the placeholder chars would
  // just get treated as inert operand text with no matching store entry).
  function convertLambdas(content) {
    let out = '', i = 0;
    while (i < content.length) {
      if (content.slice(i, i + 6) === 'lambda' && !/\w/.test(content[i - 1] || '') && !/\w/.test(content[i + 6] || '')) {
        let j = i + 6;
        while (j < content.length && content[j] !== ':') j++;
        const params = content.slice(i + 6, j).trim();
        j++; // skip ':'
        let depth = 0, inStr = null, escape = false, k = j;
        for (; k < content.length; k++) {
          const c = content[k];
          if (inStr) {
            if (escape) { escape = false; continue; }
            if (c === '\\') { escape = true; continue; }
            if (c === inStr) inStr = null;
            continue;
          }
          if (c === '"' || c === "'") { inStr = c; continue; }
          if (c === '(' || c === '[' || c === '{') depth++;
          else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
          else if (c === ',' && depth === 0) break;
        }
        const body = content.slice(j, k).trim();
        out += `function(${params}) { return (${transformExpression(body)}); }`;
        i = k;
        continue;
      }
      out += content[i];
      i++;
    }
    return out;
  }

  function pushMasked(store, quotedText) {
    store.push(quotedText);
    return MASK_OPEN + (store.length - 1) + MASK_CLOSE;
  }

  // "text %s more %d" % (a, b)   or   "text %s" % single_arg
  // Compile-time parsed (format strings are almost always literals), same
  // approach as f-strings: turn it into a concatenation expression.
  function convertPercentFormat(content, store) {
    const re = /(\u0002(\d+)\u0003)\s*%\s*(\[[^\[\]]*\]|\([^()]*\)|-?\d+(?:\.\d+)?|[A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\[[^\]]*\])*)/g;
    return content.replace(re, (m, fmtTok, idx, argsRaw) => {
      const literal = literalStringValue(fmtTok, store);
      if (literal === null) return m; // not a compile-time-known literal - leave alone
      const argsList = /^[([]/.test(argsRaw) ? splitTopLevel(argsRaw.slice(1, -1), ',') : [argsRaw];
      const parts = [];
      let ai = 0, i = 0;
      while (i < literal.length) {
        if (literal[i] === '%' && literal[i + 1] === '%') { parts.push(pushMasked(store, jsQuote('%'))); i += 2; continue; }
        if (literal[i] === '%') {
          const mm = literal.slice(i).match(/^%[-+0 ]?\d*(?:\.(\d+))?[sdifr]/);
          if (mm) {
            const type = mm[0][mm[0].length - 1];
            const prec = mm[1];
            const argExpr = argsList[ai++];
            if (type === 'd' || type === 'i') parts.push(`pystr(pyint(${argExpr}))`);
            else if (type === 'f') parts.push(`pyfixed(${argExpr}, ${prec !== undefined ? prec : 6})`);
            else parts.push(`pystr(${argExpr})`);
            i += mm[0].length;
            continue;
          }
        }
        let j = i;
        while (j < literal.length && literal[j] !== '%') j++;
        parts.push(pushMasked(store, jsQuote(literal.slice(i, j))));
        i = j;
      }
      return parts.length ? '(' + parts.join(' + ') + ')' : '""';
    });
  }

  // "{} and {}".format(a, b) / "{0} {1}".format(a,b) / "{name}".format(name=x)
  // Same compile-time-literal approach.
  function convertFormatMethod(content, store) {
    const re = new RegExp('(' + MASK_OPEN + '(\\d+)' + MASK_CLOSE + ')\\.format\\(', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(content)) !== null) {
      const fmtTok = m[1];
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = findMatchingParen(content, openIdx);
      if (closeIdx === -1) continue;
      const argsRaw = content.slice(openIdx + 1, closeIdx);
      const literal = literalStringValue(fmtTok, store);
      let replacement;
      if (literal === null) {
        replacement = content.slice(m.index, closeIdx + 1); // leave unchanged
      } else {
      const positional = [];
      const kwargs = {};
      let spreadSource = null;
      for (const p of splitTopLevel(argsRaw, ',')) {
        if (p.trim().startsWith('**')) { spreadSource = p.trim().slice(2); continue; }
        const km = p.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
        if (km) kwargs[km[1]] = km[2];
        else positional.push(p);
      }
      const parts = [];
      let i = 0, autoCounter = 0;
      while (i < literal.length) {
        if (literal[i] === '{' && literal[i + 1] === '{') { parts.push(pushMasked(store, jsQuote('{'))); i += 2; continue; }
        if (literal[i] === '}' && literal[i + 1] === '}') { parts.push(pushMasked(store, jsQuote('}'))); i += 2; continue; }
        if (literal[i] === '{') {
          const j = literal.indexOf('}', i);
          if (j === -1) { parts.push(pushMasked(store, jsQuote(literal.slice(i)))); break; }
          const inner = literal.slice(i + 1, j);
          const colonIdx = inner.indexOf(':');
          const keyPart = colonIdx >= 0 ? inner.slice(0, colonIdx) : inner;
          const specPart = colonIdx >= 0 ? inner.slice(colonIdx + 1) : null;
          let exprText;
          if (keyPart === '') exprText = positional[autoCounter++];
          else if (/^\d+$/.test(keyPart)) exprText = positional[parseInt(keyPart, 10)];
          else if (kwargs[keyPart] !== undefined) exprText = kwargs[keyPart];
          else if (spreadSource) exprText = `${spreadSource}[${jsQuote(keyPart)}]`;
          parts.push(specPart !== null ? buildFormattedValue(exprText, specPart) : `pystr(${exprText})`);
          i = j + 1;
          continue;
        }
        let j = i;
        while (j < literal.length && literal[j] !== '{' && literal[j] !== '}') j++;
        parts.push(pushMasked(store, jsQuote(literal.slice(i, j))));
        i = j;
      }
      replacement = parts.length ? '(' + parts.join(' + ') + ')' : '""';
      }
      out += content.slice(last, m.index) + replacement;
      last = closeIdx + 1;
      re.lastIndex = closeIdx + 1;
    }
    out += content.slice(last);
    return out;
  }

  // Python's conditional expression: `A if COND else B`. The engine's
  // grammar has no ternary operator at all, but now that real closures
  // exist we can fake one with an immediately-invoked function.
  function findSpacedTokens(content, token) {
    const positions = [];
    let inStr = null, escape = false;
    for (let i = 0; i < content.length; i++) {
      const c = content[i];
      if (inStr) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'") { inStr = c; continue; }
      if (content.slice(i, i + token.length) === token) positions.push(i);
    }
    return positions;
  }

  function convertTernary(content) {
    const ifPositions = findSpacedTokens(content, ' if ');
    for (const ifIdx of ifPositions) {
      // matching ' else ' via a depth scan relative to this specific 'if'
      // (so `f(a if c else b, x)` finds it even though it's nested inside
      // the call's parens)
      let depth = 0, inStr = null, escape = false, elseIdx = -1;
      for (let i = ifIdx + 4; i < content.length; i++) {
        const c = content[i];
        if (inStr) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === inStr) inStr = null; continue; }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
        else if (depth === 0 && content.slice(i, i + 6) === ' else ') { elseIdx = i; break; }
      }
      if (elseIdx === -1) continue; // not a real ternary here - try the next candidate

      let exprStart = 0;
      { let d = 0;
        for (let i = ifIdx - 1; i >= 0; i--) {
          const c = content[i];
          if (c === ')' || c === ']' || c === '}') d++;
          else if (c === '(' || c === '[' || c === '{') { if (d === 0) { exprStart = i + 1; break; } d--; }
          else if (d === 0 && c === ',') { exprStart = i + 1; break; }
        }
      }
      let exprEnd = content.length;
      { let d = 0;
        for (let i = elseIdx + 6; i < content.length; i++) {
          const c = content[i];
          if (c === '(' || c === '[' || c === '{') d++;
          else if (c === ')' || c === ']' || c === '}') { if (d === 0) { exprEnd = i; break; } d--; }
          else if (d === 0 && c === ',') { exprEnd = i; break; }
        }
      }

      const trueExpr = content.slice(exprStart, ifIdx).trim();
      const cond = content.slice(ifIdx + 4, elseIdx).trim();
      const falseExpr = content.slice(elseIdx + 6, exprEnd).trim();
      const replacement = `(function() { if (${transformExpression(cond)}) { return (${transformExpression(trueExpr)}); } else { return (${transformExpression(falseExpr)}); } })()`;
      const before = convertTernary(content.slice(0, exprStart));
      const after = convertTernary(content.slice(exprEnd));
      return before + replacement + after;
    }
    return content;
  }

  // Python tuple literals like `("Bob", 25)` or `(x,)` have no canonical
  // equivalent - `(...)` in that grammar can only group ONE expression,
  // never a comma list. Since we already treat tuples as plain arrays
  // everywhere else (zip/enumerate/.items() all produce [a, b] pairs),
  // convert them to array literals too. Must not touch real function
  // calls like `foo(a, b)` - only bare parenthesized groups.
  function convertTupleLiterals(content) {
    let out = '', i = 0;
    while (i < content.length) {
      if (content[i] === '(') {
        const prev = i > 0 ? content[i - 1] : '';
        const isCallOrGroup = /[\w\]\)]/.test(prev) || prev === MASK_CLOSE;
        const closeIdx = findMatchingParen(content, i);
        if (closeIdx !== -1) {
          const inner = content.slice(i + 1, closeIdx);
          const parts = splitTopLevel(inner, ',');
          const trailingComma = inner.trim().endsWith(',');
          if (!isCallOrGroup && (parts.length > 1 || (parts.length === 1 && trailingComma && inner.trim() !== ''))) {
            out += '[' + convertTupleLiterals(inner) + ']';
            i = closeIdx + 1;
            continue;
          }
        }
      }
      out += content[i];
      i++;
    }
    return out;
  }

  // eval("some expression") - only when the argument is a literal string
  // known at compile time (by far the common classroom usage). We simply
  // run the literal through our own transformExpression and inline the
  // result - no runtime code generation needed. A dynamically built
  // string (eval(some_variable)) can't work this way and gets a clear
  // error instead of silently failing.
  function convertEval(content, store) {
    const re = /\beval\(/g;
    let out = '', last = 0, m;
    while ((m = re.exec(content)) !== null) {
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = findMatchingParen(content, openIdx);
      if (closeIdx === -1) continue;
      const argsRaw = content.slice(openIdx + 1, closeIdx);
      const literal = literalStringValue(argsRaw.trim(), store);
      if (literal === null) {
        unsupported('eval() with a non-literal argument', 'the engine has no runtime code-generation hook, so eval() only works when the string is known at compile time, e.g. eval("2 + 3")');
      }
      out += content.slice(last, m.index) + `(${transformExpression(literal)})`;
      last = closeIdx + 1;
      re.lastIndex = closeIdx + 1;
    }
    out += content.slice(last);
    return out;
  }

  function parseComprehensionInner(inner) {
    const forIdx = findTopLevelKeyword(inner, 'for');
    if (forIdx === -1) return null;
    const rawExpr = inner.slice(0, forIdx).trim();
    let rest = inner.slice(forIdx + 3);
    const inIdx = findTopLevelKeyword(rest, 'in');
    if (inIdx === -1) return null;
    const loopVarRaw = rest.slice(0, inIdx).trim();
    rest = rest.slice(inIdx + 2);
    const ifIdx = findTopLevelKeyword(rest, 'if');
    let rawIter, rawCond = null;
    if (ifIdx === -1) rawIter = rest.trim();
    else { rawIter = rest.slice(0, ifIdx).trim(); rawCond = rest.slice(ifIdx + 2).trim(); }
    return { rawExpr, loopVarRaw, rawIter, rawCond };
  }

  function comprehensionToIIFE(kind, parsed) {
    const iterExpr = transformExpression(parsed.rawIter);
    const cond = parsed.rawCond !== null ? transformExpression(parsed.rawCond) : null;
    let loopVar = parsed.loopVarRaw, unpackPreamble = '';
    if (parsed.loopVarRaw.includes(',')) {
      const names = parsed.loopVarRaw.split(',').map(s => s.trim());
      loopVar = '__cval';
      unpackPreamble = names.map((n, i) => `${n} = __cval[${i}];`).join(' ') + ' ';
    }
    if (kind === 'dict') {
      const colonAt = findTopLevelColon(parsed.rawExpr);
      if (colonAt === -1) unsupported('Malformed dict comprehension', 'expected `{key: value for ...}`');
      const key = transformExpression(parsed.rawExpr.slice(0, colonAt).trim());
      const val = transformExpression(parsed.rawExpr.slice(colonAt + 1).trim());
      const body = `__out[${key}] = ${val};`;
      return `(function() { let __out = {}; for (${loopVar} in ${iterExpr}) { ${unpackPreamble}${cond ? `if (${cond}) { ${body} }` : body} } return __out; })()`;
    }
    const expr = transformExpression(parsed.rawExpr);
    const push = `__out.push(${expr});`;
    const iife = `(function() { let __out = []; for (${loopVar} in ${iterExpr}) { ${unpackPreamble}${cond ? `if (${cond}) { ${push} }` : push} } return __out; })()`;
    return kind === 'set' ? `pyset(${iife})` : iife;
  }

  // [EXPR for ... ] / {EXPR for ...} / {K: V for ...} used ANYWHERE in an
  // expression (assignment RHS comprehensions are handled earlier, via the
  // more efficient statement-based expandComprehension - this covers
  // everywhere else, e.g. print([x*x for x in nums])).
  function convertBracketComprehensions(content) {
    let changed = true, guard = 0;
    while (changed && guard++ < 15) {
      changed = false;
      content = content.replace(/\[([^\[\]]*)\]/g, (m, inner) => {
        const parsed = parseComprehensionInner(inner);
        if (!parsed) return m;
        changed = true;
        return comprehensionToIIFE('list', parsed);
      });
      content = content.replace(/\{([^{}]*)\}/g, (m, inner) => {
        const forIdxProbe = findTopLevelKeyword(inner, 'for');
        if (forIdxProbe === -1) return m;
        const kind = findTopLevelColon(inner.slice(0, forIdxProbe)) !== -1 ? 'dict' : 'set';
        const parsed = parseComprehensionInner(inner);
        if (!parsed) return m;
        changed = true;
        return comprehensionToIIFE(kind, parsed);
      });
    }
    return content;
  }

  // A generator expression passed directly as a call's sole argument, with
  // no brackets of its own: foo(EXPR for VAR in ITER [if COND]).
  function convertBareGeneratorArgs(content) {
    let out = '', i = 0;
    while (i < content.length) {
      if (content[i] === '(') {
        const prev = i > 0 ? content[i - 1] : '';
        const isCall = /[\w\]\)]/.test(prev) || prev === MASK_CLOSE;
        const closeIdx = findMatchingParen(content, i);
        if (isCall && closeIdx !== -1) {
          const inner = content.slice(i + 1, closeIdx);
          const parsed = parseComprehensionInner(inner);
          if (parsed) {
            out += '(' + comprehensionToIIFE('list', parsed) + ')';
            i = closeIdx + 1;
            continue;
          }
        }
      }
      out += content[i];
      i++;
    }
    return out;
  }

  // Python's f(*mylist, other) spread-call syntax -> canonical's f(...mylist, other)
  function convertSpreadCallArgs(content) {
    let out = '', i = 0;
    while (i < content.length) {
      if (content[i] === '(') {
        const prev = i > 0 ? content[i - 1] : '';
        const isCall = /[\w\]\)]/.test(prev) || prev === MASK_CLOSE;
        const closeIdx = findMatchingParen(content, i);
        if (isCall && closeIdx !== -1) {
          const inner = content.slice(i + 1, closeIdx);
          const parts = splitTopLevel(inner, ',').map(p => {
            const t = p.trim();
            if (/^\*(?!\*)/.test(t)) return '...' + convertSpreadCallArgs(t.slice(1).trim());
            return convertSpreadCallArgs(t);
          });
          out += '(' + parts.join(', ') + ')';
          i = closeIdx + 1;
          continue;
        }
      }
      out += content[i];
      i++;
    }
    return out;
  }

  function transformExpression(content) {
    content = stripBytesPrefix(content);
    content = expandFStrings(content);
    content = convertSpreadCallArgs(content);
    content = convertBareGeneratorArgs(content);
    content = convertBracketComprehensions(content);
    content = convertTupleLiterals(content);
    content = convertLambdas(content);
    content = convertTernary(content);
    const { masked, store } = maskStrings(content);
    content = masked;
    content = convertSetLiterals(content);
    content = convertSlicing(content);
    content = convertFormatMethod(content, store);
    content = convertPercentFormat(content, store);
    content = convertEval(content, store);
    content = convertMethodCalls(content);
    content = convertSortCalls(content);
    content = convertBuiltinCalls(content);
    content = convertDivMod(content);
    content = convertMembership(content);
    content = convertIdentity(content);
    content = content.replace(/\bTrue\b/g, 'true');
    content = content.replace(/\bFalse\b/g, 'false');
    content = content.replace(/\bNone\b/g, 'null');
    content = content.replace(/\b__name__\b/g, jsQuote('__main__'));
    content = content.replace(/\binput\s*\(\s*\)/g, 'read_line()');
    content = content.replace(/\bprint\s*\(([\s\S]*)\)/g, (m, args) => {
      if (/(^|,)\s*end\s*=/.test(args)) {
        const cleaned = splitTopLevel(args, ',').filter(a => !/^end\s*=/.test(a.trim()));
        return `pyprintraw(${cleaned.join(', ')})`;
      }
      return `pyprint(${args})`;
    });
    content = unmaskStrings(content, store);
    return content;
  }

  // maps Python builtin function calls onto canonical builtins / prelude
  // helpers. Runs on masked content, so string args are still placeholders
  // here (fine - we only need argument *shape*, not literal text, except
  // for %/​.format() literal parsing which is handled separately below).
  function convertBuiltinCalls(content) {
    content = replaceTopLevelCall(content, 'str', (a) => `pystr(${a})`);
    content = replaceTopLevelCall(content, 'int', (a) => `pyint(${a})`);
    content = replaceTopLevelCall(content, 'float', (a) => `pyfloat(${a})`);
    content = replaceTopLevelCall(content, 'set', (a) => a.trim() ? `pyset(${a})` : '[]');
    content = replaceTopLevelCall(content, 'reversed', (a) => `pyreversed(${a})`);
    content = replaceTopLevelCall(content, 'sorted', (a) => {
      const p = splitTopLevel(a, ',');
      let reverse = 'false', keyFn = 'null';
      for (const x of p.slice(1)) {
        const mr = x.match(/^reverse\s*=\s*([\s\S]+)$/);
        const mk = x.match(/^key\s*=\s*([\s\S]+)$/);
        if (mr) reverse = mr[1];
        if (mk) keyFn = mk[1];
      }
      return `pysorted(${p[0]}, ${keyFn}, ${reverse})`;
    });
    content = replaceTopLevelCall(content, 'enumerate', (a) => `pyenumerate(${a})`);
    content = replaceTopLevelCall(content, 'zip', (a) => `pyzip(${splitTopLevel(a, ',').join(', ')})`);
    content = replaceTopLevelCall(content, 'sum', (a) => {
      const p = splitTopLevel(a, ',');
      return `pysum(${p[0]}, ${p[1] !== undefined ? p[1] : 'null'})`;
    });
    content = replaceTopLevelCall(content, 'divmod', (a) => `pydivmod(${a})`);
    content = replaceTopLevelCall(content, 'min', (a) => {
      const p = splitTopLevel(a, ',').filter(x => !/^key\s*=/.test(x));
      const keyM = a.match(/\bkey\s*=\s*([\s\S]+?)(?:,|$)/);
      if (p.length > 1) return `min(${p.join(', ')})`;
      return `pymin(${p[0]}, ${keyM ? keyM[1] : 'null'})`;
    });
    content = replaceTopLevelCall(content, 'max', (a) => {
      const p = splitTopLevel(a, ',').filter(x => !/^key\s*=/.test(x));
      const keyM = a.match(/\bkey\s*=\s*([\s\S]+?)(?:,|$)/);
      if (p.length > 1) return `max(${p.join(', ')})`;
      return `pymax(${p[0]}, ${keyM ? keyM[1] : 'null'})`;
    });
    content = replaceTopLevelCall(content, 'any', (a) => `pyany(${a})`);
    content = replaceTopLevelCall(content, 'all', (a) => `pyall(${a})`);
    content = replaceTopLevelCall(content, 'list', (a) => a.trim() ? `pylist(${a})` : '[]');
    content = content.replace(/\bmath\.(sqrt|floor|ceil|pow)\b/g, '$1');
    content = content.replace(/\bmath\.(factorial|gcd|log|sin|cos|tan)\b/g, 'math_$1');
    content = content.replace(/\bmath\.pi\b/g, '3.141592653589793');
    content = content.replace(/\bmath\.e\b/g, '2.718281828459045');
    content = content.replace(/\bmath\.inf\b/g, '1e308');
    content = content.replace(/\brandom\.(random|randint|uniform|choice|shuffle)\b/g, 'random_$1');
    content = content.replace(/\bjson\.(dumps|loads)\b/g, 'json_$1');
    content = content.replace(/\bcollections\.Counter\b/g, 'collections_counter');
    content = content.replace(/\bCounter\(/g, 'collections_counter(');
    content = content.replace(/\bfunctools\.reduce\b/g, 'reduce');
    content = content.replace(/\b(random|randint|uniform|choice|shuffle)\(/g, 'random_$1(');
    content = content.replace(/\b(dumps|loads)\(/g, 'json_$1(');
    content = content.replace(/\bstring\.ascii_lowercase\b/g, jsQuote('abcdefghijklmnopqrstuvwxyz'));
    content = content.replace(/\bstring\.ascii_uppercase\b/g, jsQuote('ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
    content = content.replace(/\bstring\.ascii_letters\b/g, jsQuote('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'));
    content = content.replace(/\bstring\.digits\b/g, jsQuote('0123456789'));
    content = content.replace(/\bstring\.punctuation\b/g, jsQuote('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'));
    content = content.replace(/\bsys\.exit\(/g, 'sys_exit(');
    content = content.replace(/\bsys\.stdout\.write\(/g, 'printraw(');
    content = content.replace(/\bsys\.stdout\.flush\(\)/g, '(0)');
    content = content.replace(/\bsys\.stdin\.readline\(\)/g, 'read_line()');
    content = content.replace(/\bbytes\.fromhex\(/g, 'bytes_fromhex(');
    content = replaceTopLevelCall(content, 'bytes', (a) => `pybytes(${a})`);
    content = replaceTopLevelCall(content, 'type', (a) => `pytype(${a})`);
    content = content.replace(/\bsys\.argv\b/g, '[]');
    content = content.replace(/\bsys\.maxsize\b/g, '9007199254740991');
    content = content.replace(/\bbase64\.b64encode\(/g, 'base64_encode(');
    content = content.replace(/\bbase64\.b64decode\(/g, 'base64_decode(');
    content = content.replace(/\bisinstance\b/, () => unsupported('isinstance', 'no type-introspection in this engine'));
    return content;
  }

  function replaceTopLevelCall(content, name, fn) {
    const re = new RegExp('\\b' + name + '\\(', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(content)) !== null) {
      const openIdx = m.index + m[0].length - 1;
      const closeIdx = findMatchingParen(content, openIdx);
      if (closeIdx === -1) continue;
      const args = content.slice(openIdx + 1, closeIdx);
      out += content.slice(last, m.index) + fn(args);
      last = closeIdx + 1;
      re.lastIndex = closeIdx + 1;
    }
    out += content.slice(last);
    return out;
  }

  /* ───────────────────────── canonical-language prelude ─────────────────────────
     Written in the SAME restricted grammar the engine executes - no
     JavaScript tricks, just for/while/if/arrays/functions, so it needs
     no engine changes at all. */

  const PRELUDE = `
function pymod(a, b) { return a - (a // b) * b; }
function pysum(seq, start) { if (start == null) { start = 0; } let total = start; for (item in seq) { total = total + item; } return total; }
function pymin(seq, keyFn) { let best = null; let bestKey = null; let first = true; for (item in seq) { let k = item; if (keyFn != null) { k = keyFn(item); } if (first) { best = item; bestKey = k; first = false; } else if (k < bestKey) { best = item; bestKey = k; } } return best; }
function pymax(seq, keyFn) { let best = null; let bestKey = null; let first = true; for (item in seq) { let k = item; if (keyFn != null) { k = keyFn(item); } if (first) { best = item; bestKey = k; first = false; } else if (k > bestKey) { best = item; bestKey = k; } } return best; }
function pysorted(seq, keyFn, reverse) { let arr = []; for (item in seq) { arr.push(item); } return pysortinplace(arr, keyFn, reverse); }
function pyenumerate(seq) { let out = []; let i = 0; for (item in seq) { out.push([i, item]); i = i + 1; } return out; }
function pyzip(a, b) { let out = []; let n = len(a); let m = len(b); let lim = n; if (m < lim) { lim = m; } let i = 0; while (i < lim) { out.push([a[i], b[i]]); i = i + 1; } return out; }
function pyany(seq) { for (item in seq) { if (item) { return true; } } return false; }
function pyall(seq) { for (item in seq) { if (not item) { return false; } } return true; }
function pyinsert(lst, idx, x) { lst.push(null); let i = len(lst) - 1; while (i > idx) { lst[i] = lst[i - 1]; i = i - 1; } lst[idx] = x; return lst; }
function pyremove(lst, x) { let idx = lst.indexOf(x); if (idx >= 0) { let i = idx; while (i < len(lst) - 1) { lst[i] = lst[i + 1]; i = i + 1; } lst.pop(); } return lst; }
function pyextend(lst, other) { for (item in other) { lst.push(item); } return lst; }
function pycount(seq, x) { let c = 0; for (item in seq) { if (item == x) { c = c + 1; } } return c; }
function pystartswith(s, prefix) { return s.slice(0, len(prefix)) == prefix; }
function pyendswith(s, suffix) { let n = len(s); let m = len(suffix); if (m > n) { return false; } return s.slice(n - m, n) == suffix; }
function pycapitalize(s) { if (len(s) == 0) { return s; } return s[0].upper() + s.slice(1).lower(); }
function pyisdigit(s) { if (len(s) == 0) { return false; } let i = 0; while (i < len(s)) { if (not "0123456789".includes(s[i])) { return false; } i = i + 1; } return true; }
function pylist(seq) { let out = []; for (item in seq) { out.push(item); } return out; }
function pyset(seq) { let out = []; for (item in seq) { if (not pyin(item, out)) { out.push(item); } } return out; }
function pypad(s, width, align) {
  s = pystr(s);
  let n = len(s);
  if (n >= width) { return s; }
  let padlen = width - n;
  let pad = "";
  let i = 0;
  while (i < padlen) { pad = pad + " "; i = i + 1; }
  if (align == "<") { return s + pad; }
  if (align == "^") {
    let half = padlen // 2;
    return pad.slice(0, half) + s + pad.slice(half);
  }
  return pad + s;
}
function pysortinplace(arr, keyFn, reverse) {
  let n = len(arr);
  let keys = [];
  let i = 0;
  while (i < n) { let k = arr[i]; if (keyFn != null) { k = keyFn(arr[i]); } keys.push(k); i = i + 1; }
  i = 1;
  while (i < n) {
    let cur = arr[i];
    let curKey = keys[i];
    let j = i - 1;
    while (j >= 0 and keys[j] > curKey) {
      arr[j + 1] = arr[j];
      keys[j + 1] = keys[j];
      j = j - 1;
    }
    arr[j + 1] = cur;
    keys[j + 1] = curKey;
    i = i + 1;
  }
  if (reverse == true) { arr.reverse(); }
  return arr;
}
`.trim();

  /* ───────────────────────── public API ───────────────────────── */

  function run(code, stdin = '') {
    let canonical;
    try {
      canonical = toCanonical(code);
    } catch (e) {
      return {
        ok: false,
        output: '',
        error: e instanceof UnsupportedError ? e.message : `Transpilation Error: ${e.message}`,
        errorType: 'SyntaxError'
      };
    }

    const res = CoreEngine.runCanonical(canonical, stdin, { noSlashComments: true });

    if (!res.ok && res.error) {
      res.error = `Python: ${res.error}`;
    }

    return {
      ok: res.ok,
      output: res.output || '',
      error: res.error || null,
      errorType: res.errorType || null
    };
  }

  return { run, toCanonical };
})();

if (typeof module !== 'undefined') module.exports = PythonCompiler;