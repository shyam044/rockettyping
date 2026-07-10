"use strict";
/* ══════════════════════════════════════════════════════════════════════
   C# COMPILER  (self-written, fully offline, no APIs)
   Extracts static void Main(){...}, strips using directives, and
   rewrites Console.WriteLine/ReadLine, List<T>/arrays and type keywords
   onto the shared canonical grammar before real parsing + execution.
   Exposed globally as: CSharpCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const CSharpCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/^\s*using\s+.*?;\s*$/gm, '');

    let body = AdapterUtils.extractMainBody(src, /static\s+void\s+Main\s*\([^)]*\)\s*\{/);
    if (body === src) body = AdapterUtils.extractMainBody(src, /\bMain\s*\([^)]*\)\s*\{/);

    body = body.replace(/Console\.WriteLine\s*\(/g, 'print(');
    body = body.replace(/Console\.Write\s*\(/g, 'printraw(');
    body = body.replace(/int\.Parse\s*\(\s*Console\.ReadLine\s*\(\s*\)\s*\)/g, 'read_int()');
    body = body.replace(/double\.Parse\s*\(\s*Console\.ReadLine\s*\(\s*\)\s*\)/g, 'read_float()');
    body = body.replace(/Console\.ReadLine\s*\(\s*\)/g, 'read_line()');
    body = body.replace(/new\s+int\s*\[\s*\]\s*\{([^}]*)\}/g, '[$1]');
    body = body.replace(/new\s+List<[^>]*>\s*\(\s*\)/g, '[]');
    body = body.replace(/\.Add\s*\(/g, '.push(');
    body = body.replace(/\.Count\b/g, '.length');
    body = AdapterUtils.stripTypeKeywords(body);

    // other static methods in the class (helpers/recursion)
    const methodRe = /(?:public|private|static|\s)+[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
    let extra = '', m2; const seen = new Set();
    while ((m2 = methodRe.exec(src))) {
      if (m2[1] === 'Main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(/\s+/).pop()).filter(Boolean).join(', ');
      let mBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      mBody = mBody.replace(/Console\.WriteLine\s*\(/g, 'print(').replace(/Console\.Write\s*\(/g, 'printraw(');
      mBody = AdapterUtils.stripTypeKeywords(mBody);
      extra += `function ${m2[1]}(${paramNames}) {\n${mBody}\n}\n`;
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
if (typeof module !== 'undefined') module.exports = CSharpCompiler;
