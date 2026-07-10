"use strict";
/* ══════════════════════════════════════════════════════════════════════
   TYPESCRIPT COMPILER  (self-written, fully offline, no APIs)
   Strips TypeScript's type-only syntax (interfaces, type aliases, type
   annotations, generics) down to plain executable code, then reuses the
   same shared canonical grammar as JavaScript.
   Exposed globally as: TypeScriptCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const TypeScriptCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/\binterface\s+\w+\s*\{[^}]*\}/g, '');
    src = src.replace(/\btype\s+\w+\s*=.*?;/g, '');
    // strip ": Type" annotations on params/vars/returns (incl. simple generics)
    src = src.replace(/:\s*[A-Za-z_][\w.<>\[\]| ]*(?=[,)=;{])/g, '');
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
if (typeof module !== 'undefined') module.exports = TypeScriptCompiler;
