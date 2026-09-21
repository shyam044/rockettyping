"use strict";
/* ══════════════════════════════════════════════════════════════════════
   GO COMPILER  (self-written, fully offline, no APIs)
   Strips package/import lines, extracts func main(){...}, and rewrites
   fmt.Println/Printf/Scan, := declarations, and range-based for loops
   onto the shared canonical grammar before real parsing + execution.
   Exposed globally as: GoCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const GoCompiler = (() => {
  // Shared statement-level translation, applied to both main() and any
  // top-level helper functions so recursion/helpers get the same
  // treatment (fmt.*, :=, var, for-loops, ranges, arrays, bare if).
  function translateBody(body) {
    body = body.replace(/fmt\.Println\s*\(/g, 'print(');
    body = body.replace(/fmt\.Print\s*\(/g, 'printraw(');
    body = body.replace(/fmt\.Printf\s*\(/g, 'printf(');
    body = body.replace(/fmt\.Scan(?:ln)?\s*\(\s*&([A-Za-z_]\w*)\s*\)/g, '$1 = read_token_auto();');
    body = body.replace(/bufio\.NewReader\([^)]*\)/g, '');
    body = body.replace(/[A-Za-z_]\w*\.ReadString\('\\n'\)/g, 'read_line()');
    body = body.replace(/:=/g, '=');
    body = body.replace(/\bvar\s+([A-Za-z_]\w*)\s+\w+\s*=/g, '$1 =');
    body = body.replace(/\bvar\s+([A-Za-z_]\w*)\s+\w+\s*;?/g, '$1 = 0;');
    // for i := 0; i < n; i++ {   (already `=` after := fix above)
    body = body.replace(/for\s+([^{;]*;[^{;]*;[^{]*)\{/g, 'for ($1) {');
    // for i, v := range arr {  (both index and value used)
    body = body.replace(/for\s+([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*=\s*range\s+([A-Za-z_]\w*)\s*\{/g, (m, idx, val, arr) => {
      if (idx === '_' && val === '_') return `for (__i in range(0, len(${arr}))) {`;
      if (idx === '_') return `for (${val} in ${arr}) {`;
      if (val === '_') return `for (${idx} in range(0, len(${arr}))) {`;
      return `for (${idx} = 0; ${idx} < len(${arr}); ${idx} = ${idx} + 1) { ${val} = ${arr}[${idx}];`;
    });
    // for v := range arr {  (value only, no index)
    body = body.replace(/for\s+([A-Za-z_]\w*)\s*=\s*range\s+([A-Za-z_]\w*)\s*\{/g, 'for ($1 in $2) {');
    // remaining bare `for cond {` (Go's while) / `for {` (infinite loop)
    body = body.replace(/\bfor\s+(?!\()([^{]*?)\s*\{/g, (m, cond) => {
      cond = cond.trim();
      return cond === '' ? 'while (true) {' : `while (${cond}) {`;
    });
    body = body.replace(/\[\]int\{([^}]*)\}/g, '[$1]');
    body = AdapterUtils.stripTypeKeywords(body);
    return body;
  }

  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/^\s*package\s+\w+\s*$/gm, '');
    src = src.replace(/import\s*\(([\s\S]*?)\)/g, '');
    src = src.replace(/^\s*import\s+"[^"]*"\s*$/gm, '');
    // Go's `if cond {` never uses parentheses around the condition — the
    // canonical grammar requires them.
    src = AdapterUtils.wrapBareConditions(src, ['if']);

    let body = AdapterUtils.extractMainBody(src, /func\s+main\s*\(\s*\)\s*\{/);
    body = translateBody(body);

    // top-level user-defined funcs
    const funcRe = /func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)[^{]*\{/g;
    let extra = '', m2; const seen = new Set();
    while ((m2 = funcRe.exec(src))) {
      if (m2[1] === 'main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean).join(', ');
      let fBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      fBody = translateBody(fBody);
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
if (typeof module !== 'undefined') module.exports = GoCompiler;