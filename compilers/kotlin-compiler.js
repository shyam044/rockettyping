"use strict";
/* ══════════════════════════════════════════════════════════════════════
   KOTLIN COMPILER  (self-written, fully offline, no APIs)
   Extracts fun main(){...} (or accepts top-level script code), rewrites
   val/var, println/readLine, and 0 until n / 0..n ranges onto the shared
   canonical grammar before real parsing + execution.
   Exposed globally as: KotlinCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const KotlinCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');

    let body = AdapterUtils.extractMainBody(src, /fun\s+main\s*\([^)]*\)\s*\{/);
    if (body === src) body = src; // top-level script style, no main()

    body = body.replace(/\bval\b/g, 'let').replace(/\bvar\b/g, 'let');
    body = body.replace(/println\s*\(/g, 'print(');
    body = body.replace(/readLine\(\)!!\.toInt\(\)/g, 'read_int()');
    body = body.replace(/readLine\(\)!!\.toDouble\(\)/g, 'read_float()');
    body = body.replace(/readLine\(\)\?\.toIntOrNull\(\)\s*\?:\s*0/g, 'read_int()');
    body = body.replace(/readLine\(\)!!/g, 'read_line()');
    body = body.replace(/readLine\(\)/g, 'read_line()');
    body = body.replace(/for\s*\(\s*([A-Za-z_]\w*)\s+in\s+0\s+until\s+([^)]+)\)\s*\{/g, 'for ($1 in range(0, $2)) {');
    body = body.replace(/for\s*\(\s*([A-Za-z_]\w*)\s+in\s+([^.)]+)\.\.([^)]+)\)\s*\{/g, 'for ($1 in range($2, ($3) + 1)) {');
    body = body.replace(/\.size\b/g, '.length');
    body = body.replace(/\blet\s+([A-Za-z_]\w*)\s*:\s*[\w<>? ]+\s*=/g, 'let $1 =');

    // top-level fun definitions (skip main, already handled)
    const funcRe = /fun\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?::\s*[\w<>?]+\s*)?\{/g;
    let extra = '', m2; const seen = new Set();
    while ((m2 = funcRe.exec(src))) {
      if (m2[1] === 'main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean).join(', ');
      let fBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      fBody = fBody.replace(/\bval\b/g, 'let').replace(/\bvar\b/g, 'let').replace(/println\s*\(/g, 'print(');
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
if (typeof module !== 'undefined') module.exports = KotlinCompiler;
