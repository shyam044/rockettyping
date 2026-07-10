"use strict";
/* ══════════════════════════════════════════════════════════════════════
   JAVA COMPILER  (self-written, fully offline, no APIs)
   Extracts the body of public static void main(), strips package/import
   lines and type keywords, and rewrites Scanner and System.out idioms
   onto the shared runtime's read/print builtins before handing off to
   core-engine.js for real parsing + execution.
   Exposed globally as: JavaCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const JavaCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/^\s*(package|import)\s+.*?;\s*$/gm, '');

    let body = AdapterUtils.extractMainBody(src, /public\s+static\s+void\s+main\s*\([^)]*\)\s*\{/);
    body = body.replace(/Scanner\s+\w+\s*=\s*new\s+Scanner\s*\([^)]*\)\s*;/g, '');
    body = body.replace(/\b\w+\.nextInt\s*\(\s*\)/g, 'read_int()');
    body = body.replace(/\b\w+\.nextDouble\s*\(\s*\)/g, 'read_float()');
    body = body.replace(/\b\w+\.nextLine\s*\(\s*\)/g, 'read_line()');
    body = body.replace(/\b\w+\.next\s*\(\s*\)/g, 'read_token()');
    body = body.replace(/System\.out\.println\s*\(/g, 'print(');
    body = body.replace(/System\.out\.print\s*\(/g, 'printraw(');
    body = body.replace(/System\.out\.printf\s*\(/g, 'printf(');
    body = body.replace(/new\s+int\s*\[\s*([^\]]+)\s*\]/g, 'array($1)');
    body = body.replace(/new\s+(?:int|double|String|long|float)\s*\[\]\s*\{([^}]*)\}/g, '[$1]');
    body = body.replace(/\.length\b/g, '.length'); // arrays: keep as-is (property)
    body = AdapterUtils.stripTypeKeywords(body);

    // top-level user-defined static methods (outside main) also get pulled in,
    // with their type keywords/modifiers stripped, so recursive helper
    // methods work too.
    const methodRe = /(?:public|private|static|\s)+[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
    let extra = '';
    let m2;
    const seen = new Set();
    while ((m2 = methodRe.exec(src))) {
      if (m2[1] === 'main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(/\s+/).pop()).filter(Boolean).join(', ');
      const mBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const cleanBody = AdapterUtils.stripTypeKeywords(mBody
        .replace(/System\.out\.println\s*\(/g, 'print(')
        .replace(/System\.out\.print\s*\(/g, 'printraw('));
      extra += `function ${m2[1]}(${paramNames}) {\n${cleanBody}\n}\n`;
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
if (typeof module !== 'undefined') module.exports = JavaCompiler;
