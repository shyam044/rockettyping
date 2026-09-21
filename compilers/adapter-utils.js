"use strict";
/* ══════════════════════════════════════════════════════════════════════
   ADAPTER UTILS — shared helper functions used by every per-language
   compiler front-end (java-compiler.js, cpp-compiler.js, etc.) to turn
   real source code into the CoreEngine canonical mini-language.
   Load this file BEFORE any of the per-language compiler files.
═══════════════════════════════════════════════════════════════════════ */
const AdapterUtils = (() => {

  // Strip // or # line comments, but never inside a string literal.
  function stripLineComments(src, marker) {
    const lines = src.split('\n');
    return lines.map(line => {
      let inStr = null, out = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inStr) { out += c; if (c === inStr && line[i-1] !== '\\') inStr = null; continue; }
        if (c === '"' || c === "'") { inStr = c; out += c; continue; }
        if (marker === '//' && c === '/' && line[i+1] === '/') break;
        if (marker === '#' && c === '#') break;
        out += c;
      }
      return out;
    }).join('\n');
  }

  function stripBlockComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // Extract the { ... } body of the first function matching `re` — used
  // to pull the real program out of main()/Main()/fn main() wrappers.
  // Returns the source unchanged if there's no match.
  function extractMainBody(src, re) {
    const m = re.exec(src);
    if (!m) return src;
    let i = m.index + m[0].length - 1;
    if (src[i] !== '{') {
      const braceIdx = src.indexOf('{', m.index);
      if (braceIdx === -1) return src;
      i = braceIdx;
    }
    let depth = 0, start = i;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start + 1, i); }
    }
    return src;
  }

  // Strip a leading type-keyword token from declarations so
  // `int x = 5;` / `String s = "a";` / `var x = 5` / `val x = 5` all
  // become `x = 5;`. Handles simple generics like `List<Integer> x`.
  function stripTypeKeywords(src) {
    src = src.replace(/\b(?:public|private|static|final|readonly)\b/g, '');
    src = src.replace(/\b(?:int|long|short|byte|float|double|bool|boolean|char|string|String|var|let|const|auto|val|mut|dynamic|object)\b(?:\s*<[^>]*>)?(\s*\[\s*\]\s*)?\s+([A-Za-z_]\w*)\s*=/g, '$2 =');
    src = src.replace(/\b(?:int|long|short|byte|float|double|bool|boolean|char|string|String)\s+([A-Za-z_]\w*)\s*;/g, '$1 = 0;');
    return src;
  }

  // Convert Ruby/shell-style `end`-terminated blocks into brace blocks.
  function rubyEndToBrace(src) {
    const lines = src.split('\n');
    const out = [];
    for (let raw of lines) {
      let line = raw;
      const trimmed = line.trim();
      const startsWithKw = /^(if|unless|while|until|for|def)\b/.test(trimmed) || /\bdo\s*(\|[^|]*\|)?\s*$/.test(trimmed);
      if (/^end\b/.test(trimmed)) { out.push(line.replace(/^(\s*)end\b/, '$1}')); continue; }
      if (/^else\b/.test(trimmed) && trimmed !== 'elsif') {
        out.push(line.replace(/^(\s*)else\s*$/, '$1} else {').replace(/^(\s*)elsif\s+(.*)$/, '$1} else if ($2) {'));
        continue;
      }
      if (startsWithKw) {
        line = line.replace(/^(\s*)unless\s+(.*)$/, '$1if (not ($2)) {');
        line = line.replace(/^(\s*)until\s+(.*)$/, '$1while (not ($2)) {');
        line = line.replace(/^(\s*)if\s+(.*?)(\s+then)?$/, (m0,ind,cond)=> /\{\s*$/.test(m0)?m0:`${ind}if (${cond}) {`);
        line = line.replace(/^(\s*)while\s+(.*?)(\s+do)?$/, (m0,ind,cond)=> /\{\s*$/.test(m0)?m0:`${ind}while (${cond}) {`);
        line = line.replace(/^(\s*)for\s+(\w+)\s+in\s+(.*?)(\s+do)?$/, '$1for ($2 in $3) {');
        line = line.replace(/^(\s*)def\s+([\w?!]+)\s*(\(([^)]*)\))?/, (m0,ind,name,pgroup,params)=> `${ind}function ${name.replace(/[?!]/g,'')}(${params||''}) {`);
      }
      out.push(line);
    }
    return out.join('\n');
  }

  // Some languages (Go, Rust, Swift) let you write `if cond { ... }` /
  // `while cond { ... }` with NO parentheses around the condition — the
  // canonical grammar requires `if (cond) { ... }`. This scans the source
  // and wraps any bare if/while condition in parens, leaving already-
  // parenthesized conditions (`if (cond) {`) untouched. Paren-depth is
  // tracked so conditions containing function calls (`if isValid(x) {`)
  // are handled correctly; the search stops at the first top-level `{`.
  function wrapBareConditions(src, keywords) {
    keywords = keywords || ['if', 'while'];
    let out = '', i = 0;
    const n = src.length;
    const isWordChar = c => c !== undefined && /[A-Za-z0-9_]/.test(c);
    while (i < n) {
      let matched = false;
      for (const kw of keywords) {
        if (src.slice(i, i + kw.length) === kw &&
            !isWordChar(src[i - 1]) && !isWordChar(src[i + kw.length])) {
          let j = i + kw.length;
          while (src[j] === ' ' || src[j] === '\t') j++;
          if (src[j] === '(') { out += src.slice(i, i + kw.length); i = i + kw.length; matched = true; break; }
          let depth = 0, start = j;
          while (j < n) {
            const c = src[j];
            if (c === '"' || c === "'") { // skip over string literals
              const q = c; j++;
              while (j < n && src[j] !== q) { if (src[j] === '\\') j++; j++; }
              j++; continue;
            }
            if (c === '(') depth++;
            else if (c === ')') depth--;
            else if (c === '{' && depth === 0) break;
            else if (c === '\n' && depth === 0 && /^\s*\{/.test(src.slice(j))) break; // brace on next line
            j++;
          }
          const cond = src.slice(start, j).trim();
          if (cond === '') { out += src.slice(i, j); i = j; matched = true; break; }
          out += src.slice(i, i + kw.length) + ' (' + cond + ') ';
          i = j; matched = true; break;
        }
      }
      if (!matched) { out += src[i]; i++; }
    }
    return out;
  }

  // Splits `src` on top-level occurrences of `delim` (a literal string,
  // e.g. '<<' or '.'), ignoring delimiter characters that appear inside
  // string literals or inside (), [], {} nesting. Used by adapters that
  // rewrite chained-insertion/concatenation syntax (C++'s `cout << a << b`,
  // PHP's `$a . $b`) so each operand can be wrapped individually instead
  // of naively joined — a naive join loses track of which pieces are
  // strings vs numbers and can insert spurious separators.
  function splitTopLevel(src, delim) {
    const parts = []; let depth = 0, cur = '', i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '"' || c === "'") {
        const q = c; let j = i + 1, s = c;
        while (j < src.length && src[j] !== q) { if (src[j] === '\\') { s += src[j] + (src[j+1]||''); j += 2; continue; } s += src[j]; j++; }
        s += src[j] || ''; cur += s; i = j + 1; continue;
      }
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      if (depth === 0 && src.slice(i, i + delim.length) === delim) {
        parts.push(cur); cur = ''; i += delim.length; continue;
      }
      cur += c; i++;
    }
    parts.push(cur);
    return parts.map(p => p.trim()).filter(p => p.length > 0);
  }

  // JS/TS object literals use bare identifiers as keys (`{ x: 1 }`), but
  // the canonical grammar's dict literal evaluates the key as an
  // expression (Python-dict style), so a bare `x` would look up a
  // variable named x instead of naming the key "x". This quotes bare
  // identifier keys that immediately follow `{` or `,`, skipping over
  // string literals so nothing inside them is touched. Loop labels
  // (`outer: for (...) { }`) are deliberately left alone by checking
  // that what follows the colon isn't a control-flow keyword.
  function quoteObjectKeys(src) {
    let out = '', i = 0;
    const n = src.length;
    const CONTROL_KW = /^(for|while|if|do|function)\b/;
    while (i < n) {
      const c = src[i];
      if (c === '"' || c === "'" || c === '`') {
        const q = c; let j = i + 1;
        while (j < n && src[j] !== q) { if (src[j] === '\\') j++; j++; }
        out += src.slice(i, j + 1); i = j + 1; continue;
      }
      if (c === '{' || c === ',') {
        out += c; i++;
        let j = i;
        while (j < n && /\s/.test(src[j])) j++;
        const rest = src.slice(j);
        const idMatch = /^([A-Za-z_]\w*)\s*:(?!:)/.exec(rest);
        if (idMatch) {
          const afterColon = rest.slice(idMatch[0].length).replace(/^\s+/, '');
          if (!CONTROL_KW.test(afterColon)) {
            out += src.slice(i, j) + '"' + idMatch[1] + '"';
            i = j + idMatch[1].length;
          }
        }
        continue;
      }
      out += c; i++;
    }
    return out;
  }

  return { stripLineComments, stripBlockComments, extractMainBody, stripTypeKeywords, rubyEndToBrace, wrapBareConditions, splitTopLevel, quoteObjectKeys };
})();
if (typeof module !== 'undefined') module.exports = AdapterUtils;