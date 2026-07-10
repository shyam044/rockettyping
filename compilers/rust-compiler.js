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
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/^\s*use\s+.*?;\s*$/gm, '');

    let body = AdapterUtils.extractMainBody(src, /fn\s+main\s*\(\s*\)\s*\{/);

    body = body.replace(/println!\s*\(\s*"([^"]*)"\s*(?:,\s*([^)]*))?\)\s*;/g, (m, fmt, argsStr) => {
      const args = argsStr ? ', ' + argsStr.split(',').map(s => s.trim()).join(', ') : '';
      return `println_rs("${fmt}"${args});`;
    });
    body = body.replace(/println!\s*\(\s*\)\s*;/g, 'print("");');
    body = body.replace(/print!\s*\(\s*"([^"]*)"\s*(?:,\s*([^)]*))?\)\s*;/g, (m, fmt, argsStr) => {
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

    body = body.replace(/vec!\s*\[([^\]]*)\]/g, '[$1]');
    body = body.replace(/\blet\s+([A-Za-z_]\w*)\s*:\s*[\w<>:; ]+\s*=/g, 'let $1 =');
    body = AdapterUtils.stripTypeKeywords(body);

    // top-level fn definitions (recursive helpers etc.)
    const funcRe = /fn\s+([A-Za-z_]\w*)\s*\(([^)]*)\)[^{]*\{/g;
    let extra = '', m2; const seen = new Set();
    while ((m2 = funcRe.exec(src))) {
      if (m2[1] === 'main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean).join(', ');
      let fBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      fBody = fBody.replace(/let\s+mut\s+/g, 'let ');
      fBody = AdapterUtils.stripTypeKeywords(fBody);
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
