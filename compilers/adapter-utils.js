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

  return { stripLineComments, stripBlockComments, extractMainBody, stripTypeKeywords, rubyEndToBrace };
})();
if (typeof module !== 'undefined') module.exports = AdapterUtils;
