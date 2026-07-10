"use strict";
/* ══════════════════════════════════════════════════════════════════════
   UNIVERSAL COMPILER  —  100% self-written, runs fully offline, no APIs.
   Architecture:
     1. Per-language ADAPTER  — regex/structural transform that rewrites
        real C/Java/Go/Rust/... source into one canonical mini-language
        (strips wrappers like main(), type keywords, normalises print/
        input idioms, converts Ruby's `end` blocks to braces, etc).
     2. Canonical LEXER + PARSER + EVALUATOR — one shared recursive-
        descent parser and tree-walking interpreter that actually
        executes the resulting program (real parsing + real execution,
        not string/pattern matching against expected output).
   Python keeps its own dedicated indentation-based interpreter (already
   in this file) since its grammar is fundamentally different (no braces).
═══════════════════════════════════════════════════════════════════════ */
const CoreEngine = (() => {

  class RuntimeErr extends Error {}
  class ParseErr extends Error {}

  /* ────────────────────────────────────────────────────────────────
     1. CANONICAL LEXER
        Canonical grammar looks like a small JS/C subset:
          let x = 5; x = x + 1;
          if (cond) { ... } else if (cond) { ... } else { ... }
          while (cond) { ... }
          for (i = 0; i < n; i = i + 1) { ... }
          for (x in range(0, n)) { ... }
          function name(a, b) { ... return expr; }
          print(a, b);  printraw(a);  printf(fmt, a, b);
          arrays: [1,2,3]   arr[i]   arr.length   arr.push(x) ...
  ──────────────────────────────────────────────────────────────── */
  const KEYWORDS = new Set([
    'let','var','const','if','else','while','for','in','function','return',
    'break','continue','true','false','null','and','or','not',
    'try','catch','finally','throw'
  ]);

  function lex(src, opts) {
    opts = opts || {};
    const toks = []; let i = 0; const n = src.length; let line = 1;
    const push = (t, v) => toks.push({ t, v, line });
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
      if (!opts.noSlashComments && c === '/' && src[i+1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i+1] === '*') { i += 2; while (i < n && !(src[i]==='*'&&src[i+1]==='/')) { if(src[i]==='\n')line++; i++; } i += 2; continue; }
      if (/[0-9]/.test(c)) {
        let j = i; while (j < n && /[0-9]/.test(src[j])) j++;
        if (src[j] === '.' && /[0-9]/.test(src[j+1])) { j++; while (j < n && /[0-9]/.test(src[j])) j++; }
        push('NUM', parseFloat(src.slice(i, j))); i = j; continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        const q = c; let j = i + 1, s = '';
        while (j < n && src[j] !== q) {
          if (src[j] === '\\') {
            const e = src[j+1];
            const map = { n:'\n', t:'\t', r:'\r', '\\':'\\', '"':'"', "'":"'", '`':'`', '0':'\0' };
            s += (map[e] !== undefined ? map[e] : e); j += 2;
          } else { s += src[j]; j++; }
        }
        push('STR', s); i = j + 1; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i; while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        const w = src.slice(i, j);
        push(KEYWORDS.has(w) ? 'KW' : 'IDENT', w); i = j; continue;
      }
      const three = src.slice(i, i+3);
      if (three === '===' || three === '!==') { push('OP', three.slice(0,2)); i += 3; continue; }
      if (three === '...') { push('OP', '...'); i += 3; continue; }
      const two = src.slice(i, i+2);
      if (['==','!=','<=','>=','&&','||','+=','-=','*=','/=','%=','++','--','**','//'].includes(two)) { push('OP', two); i += 2; continue; }
      if ('+-*/%=<>!(){}[],;.:&|'.includes(c)) { push('OP', c); i++; continue; }
      i++; // skip unknown char
    }
    push('EOF', null);
    return toks;
  }

  /* ────────────────────────────────────────────────────────────────
     2. PARSER  (recursive descent -> AST)
  ──────────────────────────────────────────────────────────────── */
  class Parser {
    constructor(toks) { this.toks = toks; this.pos = 0; }
    peek(o=0) { return this.toks[this.pos+o]; }
    at(t, v) { const tk = this.peek(); return tk.t===t && (v===undefined || tk.v===v); }
    atOp(v) { return this.at('OP', v); }
    atKw(v) { return this.at('KW', v); }
    next() { return this.toks[this.pos++]; }
    expectOp(v) { if (!this.atOp(v)) throw new ParseErr(`Expected "${v}" but got "${this.peek().v}" (line ${this.peek().line})`); return this.next(); }
    expectKw(v) { if (!this.atKw(v)) throw new ParseErr(`Expected "${v}" (line ${this.peek().line})`); return this.next(); }
    skipSemis() { while (this.atOp(';')) this.next(); }

    parseProgram() {
      const body = [];
      this.skipSemis();
      while (!this.at('EOF')) { body.push(this.parseStatement()); this.skipSemis(); }
      return { k:'Program', body };
    }

    parseBlock() {
      this.expectOp('{');
      const body = [];
      this.skipSemis();
      while (!this.atOp('}')) { body.push(this.parseStatement()); this.skipSemis(); }
      this.expectOp('}');
      return body;
    }

    parseStatement() {
      if (this.atKw('let') || this.atKw('var') || this.atKw('const')) return this.parseDecl();
      if (this.atKw('if')) return this.parseIf();
      if (this.atKw('while')) return this.parseWhile();
      if (this.atKw('for')) return this.parseFor();
      if (this.atKw('function')) return this.parseFunc();
      if (this.atKw('try')) return this.parseTry();
      if (this.atKw('throw')) { this.next(); const e = this.parseExpr(); return { k:'Throw', expr:e }; }
      if (this.atKw('return')) { this.next(); const e = (this.atOp(';')||this.atOp('}'))?null:this.parseExpr(); return { k:'Return', expr:e }; }
      if (this.atKw('break')) { this.next(); return { k:'Break' }; }
      if (this.atKw('continue')) { this.next(); return { k:'Continue' }; }
      if (this.atOp('{')) return { k:'Block', body: this.parseBlock() };
      return this.parseExprOrAssignStatement();
    }

    parseDecl() {
      this.next(); // let/var/const
      const name = this.next().v;
      let expr = { k:'Null' };
      if (this.atOp('=')) { this.next(); expr = this.parseExpr(); }
      return { k:'Assign', target: { k:'Ident', name }, op:'=', expr };
    }

    parseIf() {
      this.next(); this.expectOp('(');
      const cond = this.parseExpr(); this.expectOp(')');
      const then = this.atOp('{') ? this.parseBlock() : [this.parseStatement()];
      let elseBody = null;
      this.skipSemis();
      if (this.atKw('else')) {
        this.next();
        if (this.atKw('if')) { elseBody = [this.parseIf()]; }
        else { elseBody = this.atOp('{') ? this.parseBlock() : [this.parseStatement()]; }
      }
      return { k:'If', cond, then, elseBody };
    }

    parseWhile() {
      this.next(); this.expectOp('(');
      const cond = this.parseExpr(); this.expectOp(')');
      const body = this.atOp('{') ? this.parseBlock() : [this.parseStatement()];
      return { k:'While', cond, body };
    }

    parseFor() {
      this.next(); this.expectOp('(');
      // for (x in expr)
      if (this.at('IDENT') && this.peek(1).t==='KW' && this.peek(1).v==='in') {
        const varName = this.next().v; this.next(); // in
        const iter = this.parseExpr();
        this.expectOp(')');
        const body = this.atOp('{') ? this.parseBlock() : [this.parseStatement()];
        return { k:'ForIn', varName, iter, body };
      }
      // C-style: init; cond; update
      let init = null;
      if (!this.atOp(';')) init = (this.atKw('let')||this.atKw('var')||this.atKw('const')) ? this.parseDecl() : this.parseExprOrAssignStatement(true);
      this.expectOp(';');
      let cond = null;
      if (!this.atOp(';')) cond = this.parseExpr();
      this.expectOp(';');
      let update = null;
      if (!this.atOp(')')) update = this.parseExprOrAssignStatement(true);
      this.expectOp(')');
      const body = this.atOp('{') ? this.parseBlock() : [this.parseStatement()];
      return { k:'ForC', init, cond, update, body };
    }

    parseFunc() {
      this.next();
      const name = this.next().v;
      this.expectOp('(');
      const params = [];
      while (!this.atOp(')')) {
        params.push(this.next().v);
        if (this.atOp(',')) this.next();
      }
      this.expectOp(')');
      const body = this.parseBlock();
      return { k:'FuncDef', name, params, body };
    }

    parseTry() {
      this.next(); // try
      const block = this.parseBlock();
      let catchVar = null, catchBody = null, finallyBody = null;
      if (this.atKw('catch')) {
        this.next();
        if (this.atOp('(')) { this.next(); catchVar = this.next().v; this.expectOp(')'); }
        catchBody = this.parseBlock();
      }
      if (this.atKw('finally')) { this.next(); finallyBody = this.parseBlock(); }
      return { k:'Try', block, catchVar, catchBody, finallyBody };
    }

    // handles: ident = expr ;  |  ident[expr] = expr ;  |  ident OP= expr ;  |  bare expr ;
    parseExprOrAssignStatement(noSemi) {
      const expr = this.parseExpr();
      const compoundOps = ['+=','-=','*=','/=','%='];
      if (this.atOp('=') || compoundOps.some(o=>this.atOp(o))) {
        const opTok = this.next();
        const rhs = this.parseExpr();
        if (!noSemi) {} // caller handles semicolon via skipSemis loop
        if (opTok.v !== '=') {
          const binOp = opTok.v[0];
          return { k:'Assign', target: expr, op:'=', expr: { k:'Binary', op:binOp, left:expr, right:rhs } };
        }
        return { k:'Assign', target: expr, op:'=', expr: rhs };
      }
      if ((this.atOp('++') || this.atOp('--'))) {
        const op = this.next().v;
        return { k:'Assign', target: expr, op:'=', expr: { k:'Binary', op: op==='++'?'+':'-', left: expr, right: { k:'Num', value:1 } } };
      }
      return { k:'ExprStmt', expr };
    }

    // ── expression grammar (precedence climbing) ──
    parseExpr() { return this.parseOr(); }
    parseOr() {
      let l = this.parseAnd();
      while (this.atOp('||') || this.atKw('or')) { this.next(); l = { k:'Logical', op:'||', left:l, right:this.parseAnd() }; }
      return l;
    }
    parseAnd() {
      let l = this.parseEquality();
      while (this.atOp('&&') || this.atKw('and')) { this.next(); l = { k:'Logical', op:'&&', left:l, right:this.parseEquality() }; }
      return l;
    }
    parseEquality() {
      let l = this.parseCompare();
      while (this.atOp('==') || this.atOp('!=')) { const op = this.next().v; l = { k:'Binary', op, left:l, right:this.parseCompare() }; }
      return l;
    }
    parseCompare() {
      let l = this.parseAdd();
      while (this.atOp('<') || this.atOp('>') || this.atOp('<=') || this.atOp('>=')) { const op = this.next().v; l = { k:'Binary', op, left:l, right:this.parseAdd() }; }
      return l;
    }
    parseAdd() {
      let l = this.parseMul();
      while (this.atOp('+') || this.atOp('-')) { const op = this.next().v; l = { k:'Binary', op, left:l, right:this.parseMul() }; }
      return l;
    }
    parseMul() {
      let l = this.parseUnary();
      while (this.atOp('*') || this.atOp('/') || this.atOp('%') || this.atOp('//')) { const op = this.next().v; l = { k:'Binary', op, left:l, right:this.parseUnary() }; }
      return l;
    }
    parseUnary() {
      if (this.atOp('!') || this.atKw('not')) { this.next(); return { k:'Unary', op:'!', expr:this.parseUnary() }; }
      if (this.atOp('-')) { this.next(); return { k:'Unary', op:'-', expr:this.parseUnary() }; }
      if (this.atOp('++') || this.atOp('--')) { const op = this.next().v; const target = this.parseUnary();
        return { k:'PreIncDec', op, target }; }
      return this.parsePow();
    }
    parsePow() {
      const base = this.parsePostfix();
      if (this.atOp('**')) { this.next(); const exp = this.parseUnary(); return { k:'Binary', op:'**', left:base, right:exp }; }
      return base;
    }
    parsePostfix() {
      let e = this.parsePrimary();
      for (;;) {
        if (this.atOp('.')) {
          this.next();
          const name = this.next().v;
          if (this.atOp('(')) {
            this.next();
            const args = this.parseArgs();
            e = { k:'MethodCall', obj:e, name, args };
          } else {
            e = { k:'Member', obj:e, name };
          }
        } else if (this.atOp('[')) {
          this.next();
          const idx = this.parseExpr();
          this.expectOp(']');
          e = { k:'Index', obj:e, index: idx };
        } else if (this.atOp('(')) {
          this.next();
          const args = this.parseArgs();
          e = { k:'Call', callee:e, args };
        } else if (this.atOp('++') || this.atOp('--')) {
          const op = this.next().v;
          e = { k:'PostIncDec', op, target:e };
        } else break;
      }
      return e;
    }
    parseArgs() {
      const args = [];
      while (!this.atOp(')')) {
        if (this.atOp('...')) { this.next(); args.push({ k:'Spread', expr: this.parseExpr() }); }
        else args.push(this.parseExpr());
        if (this.atOp(',')) this.next();
      }
      this.expectOp(')');
      return args;
    }
    parsePrimary() {
      const tk = this.peek();
      if (tk.t === 'NUM') { this.next(); return { k:'Num', value: tk.v }; }
      if (tk.t === 'STR') { this.next(); return { k:'Str', value: tk.v }; }
      if (this.atKw('true')) { this.next(); return { k:'Bool', value:true }; }
      if (this.atKw('false')) { this.next(); return { k:'Bool', value:false }; }
      if (this.atKw('null')) { this.next(); return { k:'Null' }; }
      if (this.atOp('(')) { this.next(); const e = this.parseExpr(); this.expectOp(')'); return e; }
      if (this.atOp('[')) {
        this.next();
        const items = [];
        while (!this.atOp(']')) { items.push(this.parseExpr()); if (this.atOp(',')) this.next(); }
        this.expectOp(']');
        return { k:'ArrayLit', items };
      }
      if (this.atOp('{')) {
        this.next();
        const pairs = [];
        while (!this.atOp('}')) {
          if (this.atOp('**')) {
            this.next();
            const spreadExpr = this.parseExpr();
            pairs.push({ spread: spreadExpr });
          } else {
            const key = this.parseExpr();
            this.expectOp(':');
            const val = this.parseExpr();
            pairs.push({ key, val });
          }
          if (this.atOp(',')) this.next();
        }
        this.expectOp('}');
        return { k:'DictLit', pairs };
      }
      if (this.atKw('function')) {
        this.next();
        this.expectOp('(');
        const params = [];
        while (!this.atOp(')')) { params.push(this.next().v); if (this.atOp(',')) this.next(); }
        this.expectOp(')');
        const body = this.parseBlock();
        return { k:'FuncExpr', params, body };
      }
      if (tk.t === 'IDENT') { this.next(); return { k:'Ident', name: tk.v }; }
      throw new ParseErr(`Unexpected token "${tk.v}" (line ${tk.line})`);
    }
  }

  /* ────────────────────────────────────────────────────────────────
     3. RUNTIME VALUES + BUILTINS
  ──────────────────────────────────────────────────────────────── */
  class BreakSig {}
  class ContinueSig {}
  class ReturnSig { constructor(v){ this.value = v; } }
  class ThrowSig { constructor(v){ this.value = v; } }
  class ExitSig { constructor(code){ this.code = code; } }
  const BUILTIN_NAMES = new Set([
    'Number','abs','array','base64_encode','base64_decode','bin','ceil','chr','collections_counter','dict','filter','float',
    'floor','format_rs','hex','int','join','json_dumps','json_loads','len','lower','map',
    'math_cos','math_factorial','math_gcd','math_log','math_sin','math_tan','max','min','oct',
    'ord','parseFloat','parseInt','pop','pow','print','printf','println_rs','printraw','push',
    'pydecode','pydel','pydivmod','pyencode','pyfixed','pyfloat','pyin','pyint','pyreversed',
    'pystr','pyslicestep','pytype','type','bytes_fromhex','pybytes','random_choice','random_randint','random_random','random_shuffle','random_uniform',
    'range','read_float','read_int','read_line','read_token','read_token_auto','reduce','round',
    'pyprint','pyprintraw',
    'slice','split','sprintf','sqrt','str','substr','sys_exit','trim','truediv','upper'
  ]);

  class Closure {
    constructor(params, body, scopes) { this.params = params; this.body = body; this.scopes = scopes; }
  }
  class BuiltinRef {
    constructor(name) { this.name = name; }
  }

  class RangeObj {
    constructor(a,b,step){ this.a=a; this.b=b; this.step=step||1; }
    toArray() {
      const out = []; const cap = 2000000;
      if (this.step > 0) for (let i=this.a; i<this.b && out.length<cap; i+=this.step) out.push(i);
      else for (let i=this.a; i>this.b && out.length<cap; i+=this.step) out.push(i);
      return out;
    }
  }

  function truthy(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (v instanceof Map) return v.size > 0;
    return !!v;
  }

  function toStr(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v instanceof Closure) return '<function>';
    if (Array.isArray(v)) return '[' + v.map(x => typeof x==='string' ? x : toStr(x)).join(', ') + ']';
    if (v instanceof Map) return '{' + Array.from(v.entries()).map(([k, val]) => toStr(k) + ': ' + (typeof val === 'string' ? val : toStr(val))).join(', ') + '}';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
    return String(v);
  }

  // Fully recursive Python-style repr, used by the pystr() builtin so
  // Python programs get correctly-quoted/capitalised nested output
  // (e.g. print([True, "a", {"x": None}]) -> [True, 'a', {'x': None}]).
  // Only used for Python; other languages keep using toStr() above.
  function pyReprInner(v) {
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'string') return "'" + v + "'";
    if (Array.isArray(v)) return '[' + v.map(pyReprInner).join(', ') + ']';
    if (v instanceof Map) return '{' + Array.from(v.entries()).map(([k, val]) => pyReprInner(k) + ': ' + pyReprInner(val)).join(', ') + '}';
    return toStr(v);
  }

  function pystrValue(v) {
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (v === null || v === undefined) return 'None';
    if (Array.isArray(v) || v instanceof Map) return pyReprInner(v);
    return toStr(v);
  }

  function toNum(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
    return 0;
  }

  // very small printf/format engine — used by C printf(), Go Printf, etc.
  function formatPrintf(fmt, args) {
    let ai = 0, out = '';
    for (let i = 0; i < fmt.length; i++) {
      if (fmt[i] === '%' && i+1 < fmt.length) {
        let j = i+1;
        while (j < fmt.length && /[-+0-9.]/.test(fmt[j])) j++;
        const spec = fmt[j];
        const arg = args[ai++];
        if (spec === 'd' || spec === 'i') out += String(Math.trunc(toNum(arg)));
        else if (spec === 'f') {
          const m = fmt.slice(i+1,j).match(/\.(\d+)/);
          const prec = m ? parseInt(m[1]) : 6;
          out += toNum(arg).toFixed(prec);
        }
        else if (spec === 's') out += toStr(arg);
        else if (spec === 'c') out += String.fromCharCode(toNum(arg));
        else if (spec === 'x') out += Math.trunc(toNum(arg)).toString(16);
        else if (spec === '%') { out += '%'; ai--; }
        else out += fmt.slice(i, j+1);
        i = j; continue;
      }
      out += fmt[i];
    }
    return out;
  }
  // Rust/Kotlin-style "{}" placeholder formatting
  function formatBraces(fmt, args) {
    let ai = 0;
    return fmt.replace(/\{\}/g, () => toStr(args[ai++]));
  }

  /* ────────────────────────────────────────────────────────────────
     4. EVALUATOR
  ──────────────────────────────────────────────────────────────── */
  function toIterableArr(v) {
    if (v instanceof RangeObj) return v.toArray();
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v.split('');
    if (v instanceof Map) return Array.from(v.keys());
    return [];
  }

  function pyToPlain(v) {
    if (v instanceof Map) { const o = {}; for (const [k, val] of v) o[k] = pyToPlain(val); return o; }
    if (Array.isArray(v)) return v.map(pyToPlain);
    return v;
  }
  function plainToPy(v) {
    if (Array.isArray(v)) return v.map(plainToPy);
    if (v !== null && typeof v === 'object') { const m = new Map(); for (const k of Object.keys(v)) m.set(k, plainToPy(v[k])); return m; }
    return v;
  }

  class Exec {
    constructor(stdin) {
      this.src = stdin || '';
      this.pos = 0;
      this.out = '';
      this.globals = new Map();
    }

    // ── stdin cursor helpers ──
    readLine() {
      if (this.pos >= this.src.length) return '';
      let j = this.src.indexOf('\n', this.pos);
      if (j === -1) j = this.src.length;
      const line = this.src.slice(this.pos, j).replace(/\r$/, '');
      this.pos = j + 1;
      return line;
    }
    readToken() {
      while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
      let j = this.pos;
      while (j < this.src.length && !/\s/.test(this.src[j])) j++;
      const tok = this.src.slice(this.pos, j);
      this.pos = j;
      return tok;
    }
    readInt()   { return parseInt(this.readToken(), 10) || 0; }
    readFloat() { return parseFloat(this.readToken()) || 0; }

    write(s) {
      this.out += s;
      if (this.out.length > 2_000_000) throw new RuntimeErr('Output limit exceeded (2,000,000 characters) - likely a runaway print loop.');
    }
    writeln(s) { this.write(s + '\n'); }

    run(ast) {
      // hoist function defs first (so calls work regardless of source order)
      for (const st of ast.body) if (st.k === 'FuncDef') {
        this.globals.set(st.name, new Closure(st.params, st.body, [this.globals]));
      }
      const scope = this.globals;
      try {
        for (const st of ast.body) {
          if (st.k === 'FuncDef') continue;
          this.execStmt(st, [scope]);
        }
      } catch (e) {
        if (e instanceof ExitSig) return;
        throw e;
      }
    }

    lookup(scopes, name) {
      for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i];
      return scopes[scopes.length - 1];
    }

    execBlock(body, scopes, stepLimit) {
      for (const st of body) this.execStmt(st, scopes);
    }

    execStmt(st, scopes) {
      this._steps = (this._steps || 0) + 1;
      if (this._steps > 3000000) throw new RuntimeErr('Execution limit exceeded (possible infinite loop).');
      switch (st.k) {
        case 'ExprStmt': this.evalExpr(st.expr, scopes); return;
        case 'Assign': {
          const val = this.evalExpr(st.expr, scopes);
          this.assignTo(st.target, val, scopes);
          return;
        }
        case 'If': {
          if (truthy(this.evalExpr(st.cond, scopes))) this.execBlock(st.then, scopes);
          else if (st.elseBody) this.execBlock(st.elseBody, scopes);
          return;
        }
        case 'While': {
          while (truthy(this.evalExpr(st.cond, scopes))) {
            try { this.execBlock(st.body, scopes); }
            catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContinueSig) continue; throw e; }
          }
          return;
        }
        case 'ForC': {
          if (st.init) this.execStmt(st.init, scopes);
          while (st.cond === null || truthy(this.evalExpr(st.cond, scopes))) {
            try { this.execBlock(st.body, scopes); }
            catch (e) { if (e instanceof BreakSig) break; if (!(e instanceof ContinueSig)) throw e; }
            if (st.update) this.execStmt(st.update, scopes);
          }
          return;
        }
        case 'ForIn': {
          let iterVal = this.evalExpr(st.iter, scopes);
          let items;
          if (iterVal instanceof RangeObj) items = iterVal.toArray();
          else if (Array.isArray(iterVal)) items = iterVal;
          else if (typeof iterVal === 'string') items = iterVal.split('');
          else if (iterVal instanceof Map) items = Array.from(iterVal.keys());
          else items = [];
          const local = new Map(scopes[scopes.length-1] === this.globals ? [] : []);
          const innerScopes = scopes;
          for (const item of items) {
            innerScopes[innerScopes.length-1].set(st.varName, item);
            try { this.execBlock(st.body, innerScopes); }
            catch (e) { if (e instanceof BreakSig) break; if (e instanceof ContinueSig) continue; throw e; }
          }
          return;
        }
        case 'FuncDef': {
          scopes[scopes.length - 1].set(st.name, new Closure(st.params, st.body, scopes.slice()));
          return;
        }
        case 'Return': throw new ReturnSig(st.expr ? this.evalExpr(st.expr, scopes) : null);
        case 'Throw': throw new ThrowSig(this.evalExpr(st.expr, scopes));
        case 'Try': {
          try {
            try {
              this.execBlock(st.block, scopes);
            } catch (e) {
              if (e instanceof BreakSig || e instanceof ContinueSig || e instanceof ReturnSig || e instanceof ExitSig) throw e;
              if (st.catchBody) {
                const errVal = (e instanceof ThrowSig) ? e.value : (e && e.message !== undefined ? e.message : String(e));
                if (st.catchVar) scopes[scopes.length - 1].set(st.catchVar, errVal);
                this.execBlock(st.catchBody, scopes);
                return;
              }
              throw e;
            }
          } finally {
            if (st.finallyBody) this.execBlock(st.finallyBody, scopes);
          }
          return;
        }
        case 'Break': throw new BreakSig();
        case 'Continue': throw new ContinueSig();
        case 'Block': this.execBlock(st.body, scopes); return;
        default: throw new RuntimeErr('Unknown statement: ' + st.k);
      }
    }

    assignTo(target, val, scopes) {
      if (target.k === 'Ident') {
        const scope = this.lookup(scopes, target.name);
        scope.set(target.name, val);
        return;
      }
      if (target.k === 'Index') {
        const obj = this.evalExpr(target.obj, scopes);
        const idx = this.evalExpr(target.index, scopes);
        if (obj instanceof Map) { obj.set(idx, val); return; }
        if (Array.isArray(obj)) {
          const i = Math.trunc(toNum(idx));
          while (obj.length <= i) obj.push(0);
          obj[i] = val;
          return;
        }
        throw new RuntimeErr('Cannot index-assign a non-array value.');
      }
      throw new RuntimeErr('Invalid assignment target.');
    }

    invoke(val, args) {
      if (val instanceof Closure) return this.callClosure(val, args);
      if (val instanceof BuiltinRef) return this.callBuiltin(val.name, args);
      throw new RuntimeErr('Value is not callable.');
    }

    callClosure(closure, args) {
      this._depth = (this._depth || 0) + 1;
      if (this._depth > 350) { this._depth--; throw new RuntimeErr('RecursionError: maximum recursion depth exceeded'); }
      try {
        const scope = new Map();
        closure.params.forEach((p, i) => scope.set(p, args[i] !== undefined ? args[i] : null));
        const callScopes = [...closure.scopes, scope];
        try { this.execBlock(closure.body, callScopes); }
        catch (e) { if (e instanceof ReturnSig) return e.value; throw e; }
        return null;
      } finally {
        this._depth--;
      }
    }

    evalExpr(node, scopes) {
      switch (node.k) {
        case 'Num': return node.value;
        case 'Str': return node.value;
        case 'Bool': return node.value;
        case 'Null': return null;
        case 'Ident': {
          const scope = this.lookup(scopes, node.name);
          if (scope.has(node.name)) return scope.get(node.name);
          if (BUILTIN_NAMES.has(node.name)) return new BuiltinRef(node.name);
          throw new RuntimeErr(`Undefined variable "${node.name}".`);
        }
        case 'ArrayLit': return node.items.map(it => this.evalExpr(it, scopes));
        case 'FuncExpr': return new Closure(node.params, node.body, scopes.slice());
        case 'DictLit': {
          const m = new Map();
          for (const p of node.pairs) {
            if (p.spread) {
              const src = this.evalExpr(p.spread, scopes);
              if (src instanceof Map) for (const [k, v] of src) m.set(k, v);
            } else {
              m.set(this.evalExpr(p.key, scopes), this.evalExpr(p.val, scopes));
            }
          }
          return m;
        }
        case 'Index': {
          const obj = this.evalExpr(node.obj, scopes);
          if (obj instanceof Map) {
            const key = this.evalExpr(node.index, scopes);
            if (!obj.has(key)) throw new RuntimeErr(`Key ${toStr(key)} not found.`);
            return obj.get(key);
          }
          const idx = Math.trunc(toNum(this.evalExpr(node.index, scopes)));
          if (Array.isArray(obj) || typeof obj === 'string') {
            const i = idx < 0 ? obj.length + idx : idx;
            const v = obj[i];
            return v === undefined ? (typeof obj === 'string' ? '' : null) : v;
          }
          throw new RuntimeErr('Cannot index this value.');
        }
        case 'Member': {
          const obj = this.evalExpr(node.obj, scopes);
          if (node.name === 'length') {
            if (Array.isArray(obj) || typeof obj === 'string') return obj.length;
          }
          throw new RuntimeErr(`Unknown property ".${node.name}".`);
        }
        case 'MethodCall': {
          const obj = this.evalExpr(node.obj, scopes);
          const args = node.args.map(a => this.evalExpr(a, scopes));
          return this.callMethod(obj, node.name, args);
        }
        case 'Unary': {
          const v = this.evalExpr(node.expr, scopes);
          if (node.op === '-') return -toNum(v);
          if (node.op === '!') return !truthy(v);
          break;
        }
        case 'PreIncDec': case 'PostIncDec': {
          const old = this.evalExpr(node.target, scopes);
          const nv = toNum(old) + (node.op === '++' ? 1 : -1);
          this.assignTo(node.target, nv, scopes);
          return node.k === 'PreIncDec' ? nv : old;
        }
        case 'Logical': {
          const l = this.evalExpr(node.left, scopes);
          if (node.op === '&&') return truthy(l) ? this.evalExpr(node.right, scopes) : l;
          return truthy(l) ? l : this.evalExpr(node.right, scopes);
        }
        case 'Binary': return this.evalBinary(node, scopes);
        case 'Call': {
          const args = [];
          for (const a of node.args) {
            if (a.k === 'Spread') { for (const x of toIterableArr(this.evalExpr(a.expr, scopes))) args.push(x); }
            else args.push(this.evalExpr(a, scopes));
          }
          if (node.callee.k === 'Ident') {
            const name = node.callee.name;
            const scope = this.lookup(scopes, name);
            if (scope.has(name)) return this.invoke(scope.get(name), args);
            return this.callBuiltin(name, args);
          }
          return this.invoke(this.evalExpr(node.callee, scopes), args);
        }
        default: throw new RuntimeErr('Unknown expression: ' + node.k);
      }
    }

    evalBinary(node, scopes) {
      const op = node.op;
      const l = this.evalExpr(node.left, scopes);
      const r = this.evalExpr(node.right, scopes);
      if (op === '+') {
        if (typeof l === 'string' || typeof r === 'string') return toStr(l) + toStr(r);
        if (Array.isArray(l)) return l.concat(r);
        return toNum(l) + toNum(r);
      }
      if (op === '-') return toNum(l) - toNum(r);
      if (op === '*') return typeof l === 'string' ? l.repeat(Math.max(0,Math.trunc(toNum(r)))) : toNum(l) * toNum(r);
      if (op === '/') { const rv = toNum(r); if (rv === 0) throw new RuntimeErr('Division by zero.'); return Number.isInteger(toNum(l)) && Number.isInteger(rv) ? Math.trunc(toNum(l)/rv) : toNum(l)/rv; }
      if (op === '%') { const rv = toNum(r); if (rv === 0) throw new RuntimeErr('Modulo by zero.'); return toNum(l) % rv; }
      if (op === '//') { const rv = toNum(r); if (rv === 0) throw new RuntimeErr('Division by zero.'); return Math.floor(toNum(l) / rv); }
      if (op === '**') return Math.pow(toNum(l), toNum(r));
      if (op === '==') return looseEq(l, r);
      if (op === '!=') return !looseEq(l, r);
      if (op === '<')  return typeof l==='string'||typeof r==='string' ? toStr(l) < toStr(r) : toNum(l) < toNum(r);
      if (op === '>')  return typeof l==='string'||typeof r==='string' ? toStr(l) > toStr(r) : toNum(l) > toNum(r);
      if (op === '<=') return typeof l==='string'||typeof r==='string' ? toStr(l) <= toStr(r) : toNum(l) <= toNum(r);
      if (op === '>=') return typeof l==='string'||typeof r==='string' ? toStr(l) >= toStr(r) : toNum(l) >= toNum(r);
      throw new RuntimeErr('Unknown operator ' + op);
    }

    callMethod(obj, name, args) {
      // string methods
      if (typeof obj === 'string') {
        switch (name) {
          case 'length': return obj.length;
          case 'upper': case 'toUpperCase': return obj.toUpperCase();
          case 'lower': case 'toLowerCase': return obj.toLowerCase();
          case 'trim': case 'strip': return obj.trim();
          case 'split': return obj.split(args[0] !== undefined ? toStr(args[0]) : /\s+/);
          case 'includes': case 'contains': return obj.includes(toStr(args[0]));
          case 'indexOf': case 'find': return obj.indexOf(toStr(args[0]));
          case 'replace': return obj.split(toStr(args[0])).join(toStr(args[1]));
          case 'substring': case 'substr': case 'slice': return obj.slice(Math.trunc(toNum(args[0])), args[1]!==undefined?Math.trunc(toNum(args[1])):undefined);
          case 'charAt': return obj[Math.trunc(toNum(args[0]))] || '';
          case 'repeat': return obj.repeat(Math.max(0,Math.trunc(toNum(args[0]))));
          case 'toString': return obj;
          case 'toInt': case 'parseInt': return Math.trunc(toNum(obj));
          case 'toFloat': case 'parseFloat': return toNum(obj);
          case 'reversed': case 'reverse': return obj.split('').reverse().join('');
        }
      }
      // array methods
      if (Array.isArray(obj)) {
        switch (name) {
          case 'length': case 'size': return obj.length;
          case 'push': case 'append': case 'add': case 'push_back': obj.push(args[0]); return obj.length;
          case 'pop': return obj.pop();
          case 'shift': return obj.shift();
          case 'unshift': obj.unshift(args[0]); return obj.length;
          case 'sort': obj.sort((a,b)=> typeof a==='string' ? (a<b?-1:a>b?1:0) : toNum(a)-toNum(b)); return obj;
          case 'reverse': case 'reversed': obj.reverse(); return obj;
          case 'includes': case 'contains': return obj.some(x=>looseEq(x,args[0]));
          case 'indexOf': case 'find': return obj.findIndex(x=>looseEq(x,args[0]));
          case 'join': return obj.map(toStr).join(args[0]!==undefined?toStr(args[0]):',');
          case 'slice': return obj.slice(Math.trunc(toNum(args[0])), args[1]!==undefined?Math.trunc(toNum(args[1])):undefined);
          case 'toString': return toStr(obj);
        }
      }
      // dict methods
      if (obj instanceof Map) {
        switch (name) {
          case 'get': return obj.has(args[0]) ? obj.get(args[0]) : (args[1] !== undefined ? args[1] : null);
          case 'keys': return Array.from(obj.keys());
          case 'values': return Array.from(obj.values());
          case 'items': return Array.from(obj.entries()).map(([k, v]) => [k, v]);
          case 'pop': {
            const has = obj.has(args[0]);
            const v = has ? obj.get(args[0]) : (args[1] !== undefined ? args[1] : null);
            if (has) obj.delete(args[0]);
            else if (args[1] === undefined) throw new RuntimeErr(`Key ${toStr(args[0])} not found.`);
            return v;
          }
          case 'update': {
            const other = args[0];
            if (other instanceof Map) for (const [k, v] of other) obj.set(k, v);
            return null;
          }
          case 'setdefault': {
            if (!obj.has(args[0])) obj.set(args[0], args[1] !== undefined ? args[1] : null);
            return obj.get(args[0]);
          }
          case 'copy': return new Map(obj);
        }
      }
      throw new RuntimeErr(`Unknown method ".${name}()" on ${Array.isArray(obj)?'array':(obj instanceof Map ? 'dict' : typeof obj)}.`);
    }

    callBuiltin(name, args) {
      switch (name) {
        case 'print': this.writeln(args.map(toStr).join(' ')); return null;
        case 'printraw': this.write(args.map(toStr).join(' ')); return null;
        case 'printf': this.write(formatPrintf(toStr(args[0]), args.slice(1))); return null;
        case 'sprintf': return formatPrintf(toStr(args[0]), args.slice(1));
        case 'format_rs': return formatBraces(toStr(args[0]), args.slice(1));
        case 'println_rs': this.writeln(formatBraces(toStr(args[0]), args.slice(1))); return null;
        case 'read_line': return this.readLine();
        case 'read_token': return this.readToken();
        case 'read_token_auto': { const tok = this.readToken(); return /^-?\d+(\.\d+)?$/.test(tok) ? parseFloat(tok) : tok; }
        case 'read_int': return this.readInt();
        case 'read_float': return this.readFloat();
        case 'len': { const v = args[0]; if (v instanceof Map) return v.size; return (Array.isArray(v)||typeof v==='string') ? v.length : 0; }
        case 'str': return toStr(args[0]);
        case 'int': case 'parseInt': return Math.trunc(toNum(args[0]));
        case 'float': case 'parseFloat': case 'Number': return toNum(args[0]);
        case 'abs': return Math.abs(toNum(args[0]));
        case 'min': return Math.min(...args.map(toNum));
        case 'max': return Math.max(...args.map(toNum));
        case 'pow': return Math.pow(toNum(args[0]), toNum(args[1]));
        case 'sqrt': return Math.sqrt(toNum(args[0]));
        case 'floor': return Math.floor(toNum(args[0]));
        case 'ceil': return Math.ceil(toNum(args[0]));
        case 'round': return Math.round(toNum(args[0]));
        case 'array': { const size = Math.trunc(toNum(args[0])); const fill = args[1]!==undefined?args[1]:0; return new Array(size).fill(fill); }
        case 'push': args[0].push(args[1]); return args[0];
        case 'pop': return args[0].pop();
        case 'range': {
          const a = args.length>1?toNum(args[0]):0;
          const b = args.length>1?toNum(args[1]):toNum(args[0]);
          const step = args[2]!==undefined?toNum(args[2]):1;
          return new RangeObj(a,b,step);
        }
        case 'upper': return toStr(args[0]).toUpperCase();
        case 'lower': return toStr(args[0]).toLowerCase();
        case 'trim': return toStr(args[0]).trim();
        case 'split': return toStr(args[0]).split(args[1]!==undefined?toStr(args[1]):/\s+/);
        case 'join': return (args[0]||[]).map(toStr).join(args[1]!==undefined?toStr(args[1]):'');
        case 'substr': case 'slice': return toStr(args[0]).slice(Math.trunc(toNum(args[1])), args[2]!==undefined?Math.trunc(toNum(args[2])):undefined);
        // ── Python-only additions (namespaced so other language adapters
        //    never call them; each covers something the canonical grammar
        //    genuinely can't express on its own) ──
        case 'truediv': { // Python's `/` is always float division, unlike
          // the shared `/` operator above which intentionally truncates
          // for two integer operands (that's correct for C/Java/Go/etc,
          // just not for Python).
          const rv = toNum(args[1]); if (rv === 0) throw new RuntimeErr('Division by zero.'); return toNum(args[0]) / rv;
        }
        case 'pystr': return pystrValue(args[0]);
        case 'pyprint': { this.writeln(args.map(pystrValue).join(' ')); return null; }
        case 'pyprintraw': { this.write(args.map(pystrValue).join(' ')); return null; }
        case 'pyreversed': { // Python's reversed() must return the same
          // shape it was given (string in -> string out, list in -> list
          // out); again needs real typeof.
          const v = args[0];
          if (typeof v === 'string') return v.split('').reverse().join('');
          if (Array.isArray(v)) return v.slice().reverse();
          return v;
        }
        case 'pyslicestep': { // full Python slice semantics (seq[start:stop:step])
          const seqRaw = args[0];
          const isStr = typeof seqRaw === 'string';
          const seq = isStr ? seqRaw.split('') : seqRaw;
          const n = seq.length;
          let step = (args[3] !== undefined && args[3] !== null) ? Math.trunc(toNum(args[3])) : 1;
          if (step === 0) throw new RuntimeErr('slice step cannot be zero');
          let start = (args[1] !== undefined && args[1] !== null) ? Math.trunc(toNum(args[1])) : (step > 0 ? 0 : n - 1);
          let stop = (args[2] !== undefined && args[2] !== null) ? Math.trunc(toNum(args[2])) : (step > 0 ? n : -n - 1);
          start = start < 0 ? Math.max(n + start, step > 0 ? 0 : -1) : (step > 0 ? Math.min(start, n) : Math.min(start, n - 1));
          stop = stop < 0 ? Math.max(n + stop, step > 0 ? 0 : -1) : (step > 0 ? Math.min(stop, n) : Math.min(stop, n - 1));
          const out = [];
          if (step > 0) { for (let i = start; i < stop; i += step) out.push(seq[i]); }
          else { for (let i = start; i > stop; i += step) out.push(seq[i]); }
          return isStr ? out.join('') : out;
        }
        case 'pyin': { // Python's `in` membership test - dispatches on
          // type (string substring / array element / dict key), which
          // again needs real typeof.
          const seq = args[1];
          if (typeof seq === 'string') return seq.includes(toStr(args[0]));
          if (Array.isArray(seq)) return seq.some(v => looseEq(v, args[0]));
          if (seq instanceof Map) return seq.has(args[0]);
          return false;
        }
        case 'pydel': { // Python's `del container[key]` - dict delete or
          // array splice depending on real type.
          const container = args[0], key = args[1];
          if (container instanceof Map) { container.delete(key); return null; }
          if (Array.isArray(container)) {
            const i = Math.trunc(toNum(key));
            const idx = i < 0 ? container.length + i : i;
            if (idx >= 0 && idx < container.length) container.splice(idx, 1);
          }
          return null;
        }
        case 'dict': { // dict() / dict(other_dict) / dict([[k,v],...])
          const src = args[0];
          if (src instanceof Map) return new Map(src);
          if (Array.isArray(src)) return new Map(src.map(pair => [pair[0], pair[1]]));
          return new Map();
        }
        // ── functional (need real closures, see Closure/callClosure above) ──
        case 'map': { const fn = args[0]; return toIterableArr(args[1]).map(x => this.invoke(fn, [x])); }
        case 'filter': { const fn = args[0]; return toIterableArr(args[1]).filter(x => truthy(fn ? this.invoke(fn, [x]) : x)); }
        case 'reduce': {
          const fn = args[0], it = toIterableArr(args[1]);
          if (it.length === 0 && args[2] === undefined) throw new RuntimeErr('reduce() of empty sequence with no initial value');
          let acc = args[2] !== undefined ? args[2] : it[0];
          for (let i = (args[2] !== undefined ? 0 : 1); i < it.length; i++) acc = this.invoke(fn, [acc, it[i]]);
          return acc;
        }
        // ── character codes / encoding ──
        case 'ord': { const s = toStr(args[0]); if (s.length !== 1) throw new RuntimeErr(`ord() expected a character, but a string of length ${s.length} found`); return s.charCodeAt(0); }
        case 'chr': return String.fromCharCode(Math.trunc(toNum(args[0])));
        case 'bin': { const n = Math.trunc(toNum(args[0])); return (n < 0 ? '-' : '') + '0b' + Math.abs(n).toString(2); }
        case 'hex': { const n = Math.trunc(toNum(args[0])); return (n < 0 ? '-' : '') + '0x' + Math.abs(n).toString(16); }
        case 'oct': { const n = Math.trunc(toNum(args[0])); return (n < 0 ? '-' : '') + '0o' + Math.abs(n).toString(8); }
        case 'pyencode': { const s = toStr(args[0]); const arr = []; for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i)); return arr; } // ASCII-range approximation only, not true multi-byte UTF-8
        case 'pydecode': { const arr = args[0]; return Array.isArray(arr) ? arr.map(n => String.fromCharCode(Math.trunc(toNum(n)))).join('') : toStr(arr); }
        case 'pydivmod': { const a = toNum(args[0]), b = toNum(args[1]); if (b === 0) throw new RuntimeErr('integer division or modulo by zero'); const q = Math.floor(a / b); return [q, a - q * b]; }
        case 'pyfixed': return Number(toNum(args[0])).toFixed(Math.trunc(toNum(args[1])));
        // ── curated stdlib shims (see python-compiler.js's import handling) ──
        case 'random_random': return Math.random();
        case 'random_randint': { const a = Math.trunc(toNum(args[0])), b = Math.trunc(toNum(args[1])); return a + Math.floor(Math.random() * (b - a + 1)); }
        case 'random_uniform': { const a = toNum(args[0]), b = toNum(args[1]); return a + Math.random() * (b - a); }
        case 'random_choice': { const arr = toIterableArr(args[0]); return arr[Math.floor(Math.random() * arr.length)]; }
        case 'random_shuffle': { const arr = args[0]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return null; }
        case 'math_factorial': { const n = Math.trunc(toNum(args[0])); if (n < 0) throw new RuntimeErr('factorial() not defined for negative values'); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
        case 'math_gcd': { let a = Math.abs(Math.trunc(toNum(args[0]))), b = Math.abs(Math.trunc(toNum(args[1]))); while (b) { const t = b; b = a % b; a = t; } return a; }
        case 'math_log': { const x = toNum(args[0]); const base = args[1] !== undefined ? toNum(args[1]) : Math.E; return Math.log(x) / Math.log(base); }
        case 'math_sin': return Math.sin(toNum(args[0]));
        case 'math_cos': return Math.cos(toNum(args[0]));
        case 'math_tan': return Math.tan(toNum(args[0]));
        case 'json_dumps': return JSON.stringify(pyToPlain(args[0]));
        case 'json_loads': return plainToPy(JSON.parse(toStr(args[0])));
        case 'collections_counter': { const m = new Map(); for (const x of toIterableArr(args[0])) m.set(x, (m.get(x) || 0) + 1); return m; }
        case 'bytes_fromhex': { const hex = toStr(args[0]).replace(/\s+/g, ''); const out = []; for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16)); return out; }
        case 'pybytes': { // bytes(x): list of ints -> itself; string -> char codes; number n -> n zero bytes
          const v = args[0];
          if (v === undefined) return [];
          if (typeof v === 'number') { const out = []; for (let i = 0; i < Math.trunc(v); i++) out.push(0); return out; }
          if (typeof v === 'string') { const out = []; for (let i = 0; i < v.length; i++) out.push(v.charCodeAt(i)); return out; }
          if (Array.isArray(v)) return v.map(x => Math.trunc(toNum(x)));
          return [];
        }
        case 'pytype': { // minimal type() - returns a Python-style class-repr string
          const v = args[0];
          if (v === null || v === undefined) return "<class 'NoneType'>";
          if (typeof v === 'boolean') return "<class 'bool'>";
          if (typeof v === 'number') return Number.isInteger(v) ? "<class 'int'>" : "<class 'float'>";
          if (typeof v === 'string') return "<class 'str'>";
          if (Array.isArray(v)) return "<class 'list'>";
          if (v instanceof Map) return "<class 'dict'>";
          if (v instanceof Closure || v instanceof BuiltinRef) return "<class 'function'>";
          return "<class 'object'>";
        }
        case 'sys_exit': throw new ExitSig(args[0] !== undefined ? args[0] : 0);
        case 'base64_encode': { // ASCII-range approximation, same caveat as pyencode/pydecode above
          const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          const raw = args[0];
          const s = Array.isArray(raw) ? raw.map(c => String.fromCharCode(Math.trunc(toNum(c)))).join('') : toStr(raw);
          const bytes = []; for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
          let out = '';
          for (let i = 0; i < bytes.length; i += 3) {
            const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
            out += B64[b0 >> 2];
            out += B64[((b0 & 3) << 4) | (b1 !== undefined ? (b1 >> 4) : 0)];
            out += b1 !== undefined ? B64[((b1 & 15) << 2) | (b2 !== undefined ? (b2 >> 6) : 0)] : '=';
            out += b2 !== undefined ? B64[b2 & 63] : '=';
          }
          return out;
        }
        case 'base64_decode': {
          const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          const raw = args[0];
          const s = (Array.isArray(raw) ? raw.map(c => String.fromCharCode(Math.trunc(toNum(c)))).join('') : toStr(raw)).replace(/[^A-Za-z0-9+/=]/g, '');
          let out = '';
          for (let i = 0; i < s.length; i += 4) {
            const c0 = B64.indexOf(s[i]), c1 = B64.indexOf(s[i + 1]);
            const c2 = s[i + 2] === '=' || s[i + 2] === undefined ? -1 : B64.indexOf(s[i + 2]);
            const c3 = s[i + 3] === '=' || s[i + 3] === undefined ? -1 : B64.indexOf(s[i + 3]);
            out += String.fromCharCode((c0 << 2) | (c1 >> 4));
            if (c2 !== -1) out += String.fromCharCode(((c1 & 15) << 4) | (c2 >> 2));
            if (c3 !== -1) out += String.fromCharCode(((c2 & 3) << 6) | c3);
          }
          return out;
        }
        case 'pyint': { // Python's int() raises ValueError on bad input;
          // the shared int()/toNum() above silently returns 0 instead
          // (fine for other languages, wrong for Python).
          const v = args[0];
          const base = args[1] !== undefined && args[1] !== null ? Math.trunc(toNum(args[1])) : 10;
          if (typeof v === 'number') return Math.trunc(v);
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (typeof v === 'string') {
            let t = v.trim();
            let neg = false;
            if (t.startsWith('+') || t.startsWith('-')) { neg = t[0] === '-'; t = t.slice(1); }
            if (base === 16 && /^0[xX]/.test(t)) t = t.slice(2);
            else if (base === 2 && /^0[bB]/.test(t)) t = t.slice(2);
            else if (base === 8 && /^0[oO]/.test(t)) t = t.slice(2);
            const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
            const re = new RegExp(`^[${digits}]+$`, 'i');
            if (t === '' || !re.test(t)) throw new RuntimeErr(`invalid literal for int() with base ${base}: '${v}'`);
            const n = parseInt(t, base);
            return neg ? -n : n;
          }
          throw new RuntimeErr('int() argument must be a string or a number.');
        }
        case 'pyfloat': { // same idea as pyint() above, for float()
          const v = args[0];
          if (typeof v === 'number') return v;
          if (typeof v === 'boolean') return v ? 1 : 0;
          if (typeof v === 'string') {
            const t = v.trim();
            if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) throw new RuntimeErr(`could not convert string to float: '${v}'`);
            return parseFloat(t);
          }
          throw new RuntimeErr('float() argument must be a string or a number.');
        }
      }
      throw new RuntimeErr(`Unknown function "${name}()".`);
    }
  }

  function looseEq(a, b) {
    if (Array.isArray(a) && Array.isArray(b)) return a.length===b.length && a.every((v,i)=>looseEq(v,b[i]));
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [k, v] of a) { if (!b.has(k) || !looseEq(v, b.get(k))) return false; }
      return true;
    }
    if (a === b) return true;
    if (typeof a === 'number' || typeof b === 'number') return toNum(a) === toNum(b) && !(a===null&&b===undefined);
    return toStr(a) === toStr(b);
  }

  /* ────────────────────────────────────────────────────────────────
     5. PUBLIC ENTRY — parse + run canonical source
  ──────────────────────────────────────────────────────────────── */
  function runCanonical(canonicalSrc, stdin, opts) {
    try {
      const toks = lex(canonicalSrc, opts);
      const ast = new Parser(toks).parseProgram();
      const exec = new Exec(stdin);
      exec.run(ast);
      return { ok:true, output: exec.out };
    } catch (err) {
      if (err instanceof ThrowSig) {
        return { ok:false, error: 'Uncaught exception: ' + toStr(err.value), errorType: 'RuntimeError' };
      }
      const type = err instanceof ParseErr ? 'SyntaxError' : (err instanceof RuntimeErr ? 'RuntimeError' : 'RuntimeError');
      return { ok:false, error: err.message, errorType: type };
    }
  }

  return { lex, Parser, Exec, runCanonical, RuntimeErr, ParseErr, ThrowSig };
})();
if (typeof module !== 'undefined') module.exports = CoreEngine;