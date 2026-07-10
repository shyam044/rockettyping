"use strict";
/* ══════════════════════════════════════════════════════════════════════
   RUBY COMPILER  (self-written, fully offline, no APIs)
   Ruby has no braces — blocks are closed with `end` — so this adapter's
   main job is converting that indentation-free but keyword-delimited
   structure into real { } blocks (see AdapterUtils.rubyEndToBrace),
   plus rewriting puts/print/gets onto the shared runtime's print/read
   builtins before real parsing + execution.
   Exposed globally as: RubyCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const RubyCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripLineComments(src, '#');
    src = src.replace(/puts\s+(.+)$/gm, 'print($1);');
    src = src.replace(/\bprint\s+(.+)$/gm, 'printraw($1);');
    src = src.replace(/gets\.chomp\.to_i/g, 'read_int()');
    src = src.replace(/gets\.to_i/g, 'read_int()');
    src = src.replace(/gets\.chomp\.to_f/g, 'read_float()');
    src = src.replace(/gets\.chomp/g, 'read_line()');
    src = src.replace(/\bgets\b/g, 'read_line()');
    src = src.replace(/\.length\b/g, '.length');
    src = AdapterUtils.rubyEndToBrace(src);
    return src;
  }
  function run(code, stdin) {
    const canonical = toCanonical(code);
    const res = CoreEngine.runCanonical(canonical, stdin);
    return { ok: res.ok, output: res.output || '', error: res.error || null, errorType: res.errorType || null };
  }
  return { run, toCanonical };
})();
if (typeof module !== 'undefined') module.exports = RubyCompiler;
