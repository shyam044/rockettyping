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
    // Ruby range literals: `for i in 1..5` / `(1...5).each do |i|` etc.
    // Convert the common `for VAR in A..B` / `A...B` form to range() calls
    // before rubyEndToBrace rewrites the `for ... in ...` header itself.
    src = src.replace(/^(\s*for\s+\w+\s+in\s+)(.+?)\.\.\.(.+?)(\s+do)?\s*$/gm, (m, pre, a, b) => `${pre}range(${a.trim()}, ${b.trim()})`);
    src = src.replace(/^(\s*for\s+\w+\s+in\s+)(.+?)\.\.(.+?)(\s+do)?\s*$/gm, (m, pre, a, b) => `${pre}range(${a.trim()}, (${b.trim()}) + 1)`);
    // `arr.each do |x| ... end`  ->  `for (x in arr) { ... }`
    src = src.replace(/([A-Za-z_][\w.\[\]]*)\.each\s+do\s*\|\s*([A-Za-z_]\w*)\s*\|/g, 'for ($2 in $1) {');
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