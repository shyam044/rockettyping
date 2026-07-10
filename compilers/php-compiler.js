"use strict";
/* ══════════════════════════════════════════════════════════════════════
   PHP COMPILER  (self-written, fully offline, no APIs)
   Strips <?php tags, drops the $ sigil from variables, and rewrites
   echo/print/fgets(STDIN)/array()/foreach onto the shared canonical
   grammar before real parsing + execution.
   Exposed globally as: PhpCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const PhpCompiler = (() => {
  function toCanonical(src) {
    src = src.replace(/<\?php|\?>/g, '');
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '#');
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/\$([A-Za-z_]\w*)/g, '$1'); // strip $ sigil
    src = src.replace(/echo\s+([^;]+);/g, (m, argsStr) => `print(${argsStr.replace(/\s*\.\s*/g, ', ')});`);
    src = src.replace(/\bprint\s+([^;(][^;]*);/g, 'print($1);');
    src = src.replace(/trim\s*\(\s*fgets\s*\(\s*STDIN\s*\)\s*\)/g, 'read_line()');
    src = src.replace(/fgets\s*\(\s*STDIN\s*\)/g, 'read_line()');
    src = src.replace(/\(int\)\s*read_line\(\)/g, 'read_int()');
    src = src.replace(/intval\s*\(\s*read_line\(\)\s*\)/g, 'read_int()');
    src = src.replace(/\barray\s*\(([^)]*)\)/g, '[$1]');
    src = src.replace(/\bcount\s*\(/g, 'len(');
    src = src.replace(/foreach\s*\(\s*([A-Za-z_]\w*)\s+as\s+([A-Za-z_]\w*)\s*\)\s*\{/g, 'for ($2 in $1) {');
    src = src.replace(/function\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g, (m, name, params) => `function ${name}(${params.replace(/\$/g, '')}) {`);
    return src;
  }
  function run(code, stdin) {
    const canonical = toCanonical(code);
    const res = CoreEngine.runCanonical(canonical, stdin);
    return { ok: res.ok, output: res.output || '', error: res.error || null, errorType: res.errorType || null };
  }
  return { run, toCanonical };
})();
if (typeof module !== 'undefined') module.exports = PhpCompiler;
