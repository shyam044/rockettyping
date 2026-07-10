"use strict";
/* ══════════════════════════════════════════════════════════════════════
   SWIFT COMPILER  (self-written, fully offline, no APIs)
   Swift allows top-level executable statements (no main() wrapper
   needed), so this adapter mainly rewrites let/var, readLine()/Int(...),
   print(), and 0..<n / 0...n ranges onto the shared canonical grammar
   before real parsing + execution.
   Exposed globally as: SwiftCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const SwiftCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');

    let body = src;
    body = body.replace(/\bvar\b/g, 'let');
    body = body.replace(/Int\(readLine\(\)\s*\?\?\s*""\)\s*\?\?\s*0/g, 'read_int()');
    body = body.replace(/Int\(readLine\(\)!\)!/g, 'read_int()');
    body = body.replace(/Double\(readLine\(\)!\)!/g, 'read_float()');
    body = body.replace(/readLine\(\)\s*!!/g, 'read_line()');
    body = body.replace(/readLine\(\)/g, 'read_line()');
    body = body.replace(/for\s+([A-Za-z_]\w*)\s+in\s+([^.{]+)\.\.<\s*([^{]+)\{/g, 'for ($1 in range($2, $3)) {');
    body = body.replace(/for\s+([A-Za-z_]\w*)\s+in\s+([^.{]+)\.\.\.\s*([^{]+)\{/g, 'for ($1 in range($2, ($3) + 1)) {');
    body = body.replace(/func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:->\s*[\w\[\]?]+\s*)?\{/g, (m, name, params) => {
      const clean = params.split(',').map(p => p.trim().split(':')[0].trim().split(' ').pop()).filter(Boolean).join(', ');
      return `function ${name}(${clean}) {`;
    });
    body = body.replace(/\blet\s+([A-Za-z_]\w*)\s*:\s*[\w<>?\[\] ]+\s*=/g, 'let $1 =');
    body = body.replace(/\.count\b/g, '.length');
    return body;
  }
  function run(code, stdin) {
    const canonical = toCanonical(code);
    const res = CoreEngine.runCanonical(canonical, stdin);
    return { ok: res.ok, output: res.output || '', error: res.error || null, errorType: res.errorType || null };
  }
  return { run, toCanonical };
})();
if (typeof module !== 'undefined') module.exports = SwiftCompiler;
