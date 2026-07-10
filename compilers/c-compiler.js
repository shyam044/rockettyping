"use strict";
/* ══════════════════════════════════════════════════════════════════════
   C COMPILER  (self-written, fully offline, no APIs)
   Plain C is essentially the printf/scanf/arrays subset of the C++
   adapter (no cout/cin/vector expected, but harmless if present), so
   this file reuses CppCompiler's transpiler directly. Requires
   cpp-compiler.js to be loaded first.
   Exposed globally as: CCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const CCompiler = (() => {
  function toCanonical(src) { return CppCompiler.toCanonical(src); }
  function run(code, stdin) { return CppCompiler.run(code, stdin); }
  return { run, toCanonical };
})();
if (typeof module !== 'undefined') module.exports = CCompiler;
