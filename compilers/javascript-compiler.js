"use strict";
/* ══════════════════════════════════════════════════════════════════════
   JAVASCRIPT COMPILER  (self-written, fully offline, no APIs)
   JS is already extremely close to the CoreEngine canonical grammar
   (let/var/const, if/else, while, for, functions, arrays all match), so
   this adapter is intentionally small: it just maps console.log/error/
   process.stdout.write/readline() onto the runtime's print/read builtins
   and strips comments. Everything else is parsed and executed for real
   by core-engine.js.
   Exposed globally as: JavaScriptCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const JavaScriptCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/console\.(log|error|info|warn)\s*\(/g, 'print(');
    src = src.replace(/process\.stdout\.write\s*\(/g, 'printraw(');
    src = src.replace(/\breadline\s*\(\s*\)/g, 'read_line()');
    return src;
  }
  function run(code, stdin) {
    const canonical = toCanonical(code);
    const res = CoreEngine.runCanonical(canonical, stdin);
    return { ok: res.ok, output: res.output || '', error: res.error || null, errorType: res.errorType || null };
  }
  return { run, toCanonical };
})();
if (typeof module !== 'undefined') module.exports = JavaScriptCompiler;
