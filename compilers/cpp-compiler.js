"use strict";
/* ══════════════════════════════════════════════════════════════════════
   C++ COMPILER  (self-written, fully offline, no APIs)
   Strips #include/using-namespace lines, extracts int main(){...}, and
   rewrites cout<<.../cin>>.../scanf/printf/vector idioms onto the shared
   runtime's print/read builtins and native arrays before handing off to
   core-engine.js for real parsing + execution.
   Exposed globally as: CppCompiler.run(code, stdin)
        -> { ok, output, error, errorType }
═══════════════════════════════════════════════════════════════════════ */
const CppCompiler = (() => {
  function toCanonical(src) {
    src = AdapterUtils.stripBlockComments(src);
    src = AdapterUtils.stripLineComments(src, '//');
    src = src.replace(/^\s*#.*$/gm, '');
    src = src.replace(/using\s+namespace\s+std\s*;/g, '');

    let body = AdapterUtils.extractMainBody(src, /\bint\s+main\s*\([^)]*\)\s*\{/);
    if (body === src) body = AdapterUtils.extractMainBody(src, /\bmain\s*\([^)]*\)\s*\{/);
    body = body.replace(/\breturn\s+0\s*;/g, '');
    // normalize multi-word C/C++ integer types down to a single keyword
    // our generic type-stripper recognizes
    body = body.replace(/\b(unsigned\s+)?long\s+long\b/g, 'long');
    body = body.replace(/\bunsigned\s+(int|long|short|char)\b/g, '$1');
    body = body.replace(/\bunsigned\b(?!\s*\()/g, 'int');
    body = body.replace(/\bsize_t\b/g, 'long');

    // cout << a << b << endl;
    body = body.replace(/cout\s*((?:<<\s*[^;]+?)+);/g, (m, chain) => {
      const parts = chain.split('<<').map(s => s.trim()).filter(Boolean);
      let nl = false;
      const args = parts.filter(p => {
        if (p === 'endl' || p === 'std::endl') { nl = true; return false; }
        return true;
      });
      return (nl ? 'print(' : 'printraw(') + args.join(', ') + ');';
    });
    // cin >> a >> b;
    body = body.replace(/cin\s*((?:>>\s*[^;]+?)+);/g, (m, chain) => {
      const parts = chain.split('>>').map(s => s.trim()).filter(Boolean);
      return parts.map(v => `${v} = read_token_auto();`).join(' ');
    });
    // scanf("%d %d", &a, &b);
    body = body.replace(/scanf\s*\(\s*"([^"]*)"\s*,\s*([^)]*)\)\s*;/g, (m, fmt, argsStr) => {
      const vars = argsStr.split(',').map(s => s.trim().replace(/^&/, ''));
      return vars.map(v => `${v} = read_int();`).join(' ');
    });
    // vector<int> v;  /  vector<int> v = {1,2,3};
    body = body.replace(/vector\s*<[^>]*>\s*([A-Za-z_]\w*)\s*(\(\s*\))?\s*;/g, '$1 = [];');
    body = body.replace(/vector\s*<[^>]*>\s*([A-Za-z_]\w*)\s*=\s*\{([^}]*)\}\s*;/g, '$1 = [$2];');
    body = body.replace(/\.push_back\s*\(/g, '.push(');
    body = body.replace(/\.size\s*\(\s*\)/g, '.length');
    // int arr[5] = {1,2,3,4,5};   /   int arr[100];
    body = body.replace(/\b(?:int|float|double|long|char|bool)\s+([A-Za-z_]\w*)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]*)\}\s*;/g, '$1 = [$2];');
    body = body.replace(/\b(?:int|float|double|long|char|bool)\s+([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*;/g, '$1 = array($2);');
    body = body.replace(/\b(?:int|float|double|long|char|bool)\s+([A-Za-z_]\w*\s*(?:,\s*[A-Za-z_]\w*)+)\s*;/g, (m, names) =>
      names.split(',').map(n => n.trim() + ' = 0;').join(' '));
    body = AdapterUtils.stripTypeKeywords(body);

    // pull out user-defined free functions declared above main()
    const funcRe = /(?:[\w:<>]+)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/g;
    let extra = '', m2; const seen = new Set();
    while ((m2 = funcRe.exec(src))) {
      if (m2[1] === 'main' || seen.has(m2[1])) continue;
      seen.add(m2[1]);
      const paramNames = m2[2].split(',').map(p => p.trim().split(/\s+/).pop().replace('&','')).filter(Boolean).join(', ');
      let fBody = AdapterUtils.extractMainBody(src.slice(m2.index), new RegExp(m2[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      fBody = fBody.replace(/cout\s*((?:<<\s*[^;]+?)+);/g, (m,chain)=>{
        const parts = chain.split('<<').map(s=>s.trim()).filter(Boolean);
        let nl=false; const args = parts.filter(p=>{ if(p==='endl'||p==='std::endl'){nl=true;return false;} return true; });
        return (nl?'print(':'printraw(') + args.join(', ') + ');';
      });
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
if (typeof module !== 'undefined') module.exports = CppCompiler;
