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
  // Like AdapterUtils.splitTopLevel(src, '.') but also refuses to split at
  // a '.' that's a decimal point inside a number literal (e.g. `3.14`),
  // since PHP's concatenation operator and its decimal point look
  // identical and only whitespace/digit-adjacency tells them apart.
  function splitPhpConcat(src) {
    const raw = AdapterUtils.splitTopLevel(src, '.');
    // splitTopLevel doesn't know about decimals, so re-merge any pieces
    // that were split apart at what was actually a decimal point.
    const out = [];
    for (const p of raw) {
      if (out.length && /\d$/.test(out[out.length - 1]) && /^\d/.test(p)) {
        out[out.length - 1] += '.' + p;
      } else out.push(p);
    }
    return out;
  }
  function toCanonical(src) {
    src = src.replace(/<\?php|\?>/g, '');
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '#');
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/\$([A-Za-z_]\w*)/g, '$1'); // strip $ sigil
    // echo $a . $b . "\n";  — PHP's `.` concatenates with NO separator,
    // unlike print()'s space-joining, so wrap each piece in str() and
    // join with '+' to collapse the whole chain into a single argument.
    src = src.replace(/echo\s+([^;]+);/g, (m, argsStr) => {
      const parts = splitPhpConcat(argsStr);
      const joined = parts.length ? parts.map(p => `str(${p})`).join(' + ') : '""';
      return `printraw(${joined});`;
    });
    src = src.replace(/\bprint\s+([^;(][^;]*);/g, 'printraw($1);');
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