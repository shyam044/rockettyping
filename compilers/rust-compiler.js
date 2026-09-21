"use strict";
/* ══════════════════════════════════════════════════════════════════════
   RUST COMPILER  (self-written, fully offline, no APIs)
   Extracts fn main(){...}, rewrites println!/print! macros, stdin
   reads, `let mut`, vec! literals and 0..n / 0..=n ranges onto the
   shared canonical grammar before real parsing + execution.
   Exposed globally as: RustCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const RustCompiler = (() => {
  // Shared statement-level translation, applied to both main() and any
  // top-level helper functions so recursion/helpers get the same
  // treatment (println!/print!, ranges, vec!, let mut).
  // println!(...)/print!(...) args can themselves contain parens
  // (`println!("{}", fib(10))`), so a single-level `[^)]*` regex breaks on
  // nested calls. This scans with paren-depth tracking to find the real
  // matching close-paren of the macro call before splitting into fmt/args.
  function rewriteMacroCalls(body, macroRe, build) {
    let out = '', i = 0;
    macroRe.lastIndex = 0;
    let m;
    while ((m = macroRe.exec(body))) {
      out += body.slice(i, m.index);
      let j = m.index + m[0].length; // just past the opening '('
      let depth = 1, start = j;
      while (j < body.length && depth > 0) {
        const c = body[j];
        if (c === '"') { j++; while (j < body.length && body[j] !== '"') { if (body[j] === '\\') j++; j++; } }
        else if (c === '(') depth++;
        else if (c === ')') depth--;
        if (depth > 0) j++;
      }
      const inner = body.slice(start, j).trim();
      j++; // consume ')'
      if (body[j] === ';') j++;
      const fmtMatch = /^"([^"]*)"\s*(?:,\s*([\s\S]*))?$/.exec(inner);
      if (fmtMatch) out += build(fmtMatch[1], fmtMatch[2]);
      else out += build('', inner || undefined); // no string literal fmt (rare) — pass through
      i = j;
    }
    out += body.slice(i);
    return out;
  }

  function translateBody(body) {
    body = rewriteMacroCalls(body, /println!\s*\(/g, (fmt, argsStr) => {
      if (fmt === '' && !argsStr) return 'print("");';
      const args = argsStr ? ', ' + argsStr.split(',').map(s => s.trim()).join(', ') : '';
      return `println_rs("${fmt}"${args});`;
    });
    body = rewriteMacroCalls(body, /print!\s*\(/g, (fmt, argsStr) => {
      const args = argsStr ? ', ' + argsStr.split(',').map(s => s.trim()).join(', ') : '';
      return `printraw(format_rs("${fmt}"${args}));`;
    });

    body = body.replace(/(?:io::)?stdin\(\)\.read_line\(\s*&mut\s+([A-Za-z_]\w*)\s*\)[^;]*;/g, '$1 = read_line();');
    body = body.replace(/\.trim\(\)\.parse::<\w+>\(\)\.unwrap\(\)/g, '');
    body = body.replace(/\.trim\(\)\.parse\(\)\.unwrap\(\)/g, '');
    body = body.replace(/let\s+mut\s+/g, 'let ');

    // for i in 0..n {  /  for i in 0..=n {  /  for x in &arr {
    body = body.replace(/for\s+([A-Za-z_]\w*)\s+in\s+([^.{]+)\.\.=\s*([^{]+)\{/g, 'for ($1 in range($2, ($3) + 1)) {');
    body = body.replace(/for\s+([A-Za-z_]\w*)\s+in\s+([^.{]+)\.\.([^{=]+)\{/g, 'for ($1 in range($2, $3)) {');
    body = body.replace(/for\s+([A-Za-z_]\w*)\s+in\s+&?([A-Za-z_]\w*)\s*\{/g, 'for ($1 in $2) {');
    // bare `loop { ... }` -> `while (true) { ... }`
    body = body.replace(/\bloop\s*\{/g, 'while (true) {');

    body = body.replace(/vec!\s*\[([^\]]*)\]/g, '[$1]');
    body = body.replace(/\.push\s*\(/g, '.push(');
    body = body.replace(/\.len\s*\(\s*\)/g, '.length');
    // common String/Vec associated-function calls
    body = body.replace(/String::from\s*\(/g, 'str(');
    body = body.replace(/String::new\s*\(\s*\)/g, '""');
    body = body.replace(/Vec::new\s*\(\s*\)/g, '[]');
    body = body.replace(/\.to_string\s*\(\s*\)/g, '');
    body = body.replace(/\.to_owned\s*\(\s*\)/g, '');
    body = body.replace(/\blet\s+([A-Za-z_]\w*)\s*:\s*[\w<>:; ]+\s*=/g, 'let $1 =');
    body = AdapterUtils.stripTypeKeywords(body);
    return body;
  }

  // Rust functions can end in a bare trailing expression (no `;`, no
  // `return`) that is implicitly the return value — e.g. `{ x*x }` or
  // `{ let y = x*x; y }`. The canonical grammar has no such rule, so this
  // finds the last top-level statement and, if it looks like a bare
  // expression rather than a control-flow/decl statement, prefixes it
  // with `return `.
  function addImplicitReturn(body) {
    const trimmed = body.trim();
    if (trimmed === '') return body;
    let depth = 0, lastSplit = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (c === '(' || c === '{' || c === '[') depth++;
      else if (c === ')' || c === '}' || c === ']') depth--;
      else if (c === ';' && depth === 0) lastSplit = i + 1;
    }
    const tail = trimmed.slice(lastSplit).trim();
    if (tail === '' || tail.endsWith('}') ||
        /^(return|if|while|for|let|break|continue|function|throw)\b/.test(tail)) return body;
    return trimmed.slice(0, lastSplit) + ' return ' + tail + ';';
  }

  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/^\s*use\s+.*?;\s*$/gm, '');
    // Rust's `if cond {` / `while cond {` never use parentheses around the
    // condition — the canonical grammar requires them.
    src = AdapterUtils.wrapBareConditions(src, ['if', 'while']);

    let body = AdapterUtils.extractMainBody(src, /fn\s+main\s*\(\s*\)\s*\{/);
    body = translateBody(body);

    // top-level fn definitions (recursive helpers etc.)
    const funcRe = /fn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)[^{]*\{/g;
    let extra = '', m2; const seen = new Set();
    while ((m2 = funcRe.exec(src))) {
      if (m2[1] === 'main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean).join(', ');
      let fBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      fBody = translateBody(fBody);
      fBody = addImplicitReturn(fBody);
      extra += `function ${m2[1]}(${paramNames}) {\n${fBody}\n}\n`;
    }
    return extra + body;
  }
  function run(code, stdin) {
    const canonical = toCanonical(code);
    const res = CoreEngine.runCanonical(canonical, stdin);
    return { ok: res.ok, output: res.output || '', error: res.error || null, errorType: res.errorType || null };
  }
  return { run, toCanonical };
})();
if (typeof module !== 'undefined') module.exports = RustCompiler;