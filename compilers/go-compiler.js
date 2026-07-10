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
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/^\s*package\s+\w+\s*$/gm, '');
    src = src.replace(/import\s*\(([\s\S]*?)\)/g, '');
    src = src.replace(/^\s*import\s+"[^"]*"\s*$/gm, '');

    let body = AdapterUtils.extractMainBody(src, /func\s+main\s*\(\s*\)\s*\{/);
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
    body = body.replace(/for\s+([A-Za-z_]\w*)\s*,\s*[A-Za-z_]\w*\s*=\s*range\s+([A-Za-z_]\w*)\s*\{/g, 'for ($1 in range(0, len($2))) {');
    body = body.replace(/for\s+([A-Za-z_]\w*)\s*=\s*range\s+([A-Za-z_]\w*)\s*\{/g, 'for ($1 in $2) {');
    body = body.replace(/\[\]int\{([^}]*)\}/g, '[$1]');
    body = AdapterUtils.stripTypeKeywords(body);

    // top-level user-defined funcs
    const funcRe = /func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)[^{]*\{/g;
    let extra = '', m2; const seen = new Set();
    while ((m2 = funcRe.exec(src))) {
      if (m2[1] === 'main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean).join(', ');
      let fBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      fBody = fBody.replace(/fmt\.Println\s*\(/g, 'print(').replace(/fmt\.Print\s*\(/g, 'printraw(');
      fBody = AdapterUtils.stripTypeKeywords(fBody);
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
