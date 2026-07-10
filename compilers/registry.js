"use strict";
/* ══════════════════════════════════════════════════════════════════════
   COMPILER REGISTRY
   Single entry point the app calls: CompilerRegistry.run(lang, code, stdin)
   Routes to the right per-language compiler file. Load this LAST, after
   core-engine.js, adapter-utils.js, python-compiler.js and every
   *-compiler.js file.
═══════════════════════════════════════════════════════════════════════ */
const CompilerRegistry = (() => {
  const MAP = {
    python:     () => PythonCompiler,
    javascript: () => JavaScriptCompiler,
    typescript: () => TypeScriptCompiler,
    java:       () => JavaCompiler,
    cpp:        () => CppCompiler,
    c:          () => CCompiler,
    go:         () => GoCompiler,
    rust:       () => RustCompiler,
    kotlin:     () => KotlinCompiler,
    swift:      () => SwiftCompiler,
    csharp:     () => CSharpCompiler,
    php:        () => PhpCompiler,
    ruby:       () => RubyCompiler,
  };

  function isSupported(lang) { return !!MAP[lang]; }

  function run(lang, code, stdin) {
    const getCompiler = MAP[lang];
    if (!getCompiler) return { ok:false, output:'', error:`No compiler registered for "${lang}".`, errorType:'ConfigError' };
    let compiler;
    try { compiler = getCompiler(); }
    catch (e) { return { ok:false, output:'', error:`Compiler file for "${lang}" is not loaded (${e.message}).`, errorType:'ConfigError' }; }
    try {
      return compiler.run(code, stdin);
    } catch (err) {
      // A bug/edge-case in an adapter's regex transform should never crash
      // the app — surface it as a compile error instead.
      return { ok:false, output:'', error: 'Internal compiler error: ' + err.message, errorType:'CompileError' };
    }
  }

  return { run, isSupported };
})();
if (typeof module !== 'undefined') module.exports = CompilerRegistry;
