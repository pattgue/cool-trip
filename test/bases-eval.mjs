// Un evaluador pequeño de fórmulas de Bases, solo para las pruebas: entiende lo que usan las bases de Cool Trip (src/bases.ts),
// con la sintaxis de la documentación de Obsidian (Bases syntax y Functions). No es Obsidian: sirve para ver que cada fórmula
// se lee entera y da lo que debe con los viajes y lugares de ejemplo, y para pintar las vistas de Cool Bases en el harness.
// evaluate(src, ctx) · ctx: { fm, file: { path, basename, folder, tags }, formulas, today: "AAAA-MM-DD", notes, backlinks(path) }

const MONTHS = { es: ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."], en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] };

function tokenize(src) {
  const out = [];
  let i = 0, prev = null;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/\d/.test(c)) { const m = /^\d+(\.\d+)?/.exec(src.slice(i)); out.push(prev = { t: "num", v: +m[0] }); i += m[0].length; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = "";
      while (j < src.length && src[j] !== c) { if (src[j] === "\\") { j++; s += src[j] === "n" ? "\n" : src[j]; } else s += src[j]; j++; }
      if (j >= src.length) throw new Error("string sin cerrar en " + i);
      out.push(prev = { t: "str", v: s }); i = j + 1; continue;
    }
    /* una expresión regular solo puede empezar donde empieza un valor */
    if (c === "/" && (!prev || (prev.t === "op" && prev.v !== ")" && prev.v !== "]"))) {
      let j = i + 1, inCls = false;
      while (j < src.length && (src[j] !== "/" || inCls)) { if (src[j] === "\\") j++; else if (src[j] === "[") inCls = true; else if (src[j] === "]") inCls = false; j++; }
      const body = src.slice(i + 1, j), fl = /^[gimsuy]*/.exec(src.slice(j + 1))[0];
      out.push(prev = { t: "re", v: new RegExp(body, fl) }); i = j + 1 + fl.length; continue;
    }
    if (/[A-Za-z_$]/.test(c)) { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i)); out.push(prev = { t: "id", v: m[0] }); i += m[0].length; continue; }
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) { out.push(prev = { t: "op", v: two }); i += 2; continue; }
    if ("+-*/%<>!()[],.".includes(c)) { out.push(prev = { t: "op", v: c }); i++; continue; }
    throw new Error(`carácter inesperado «${c}» en ${i}`);
  }
  return out;
}

function parse(src) {
  const tk = tokenize(src);
  let p = 0;
  const peek = (v) => tk[p] && tk[p].t === "op" && tk[p].v === v;
  const eat = (v) => { if (!peek(v)) throw new Error(`se esperaba «${v}» en el token ${p} (${JSON.stringify(tk[p])})`); p++; };
  const bin = (next, ops) => () => { let l = next(); while (tk[p] && tk[p].t === "op" && ops.includes(tk[p].v)) { const op = tk[p++].v; l = { k: "bin", op, l, r: next() }; } return l; };
  const args = () => { const a = []; eat("("); if (!peek(")")) { a.push(expr()); while (peek(",")) { p++; a.push(expr()); } } eat(")"); return a; };
  function primary() {
    const t = tk[p++];
    if (!t) throw new Error("fin inesperado");
    if (t.t === "num" || t.t === "str") return { k: "lit", v: t.v };
    if (t.t === "re") return { k: "lit", v: t.v };
    if (t.t === "op" && t.v === "(") { const e = expr(); eat(")"); return e; }
    if (t.t === "op" && t.v === "[") { const items = []; if (!peek("]")) { items.push(expr()); while (peek(",")) { p++; items.push(expr()); } } eat("]"); return { k: "list", items }; }
    if (t.t === "id") { if (peek("(")) return { k: "call", name: t.v, args: args() }; return { k: "id", name: t.v }; }
    throw new Error("token inesperado " + JSON.stringify(t));
  }
  function postfix() {
    let e = primary();
    for (;;) {
      if (peek(".")) { p++; const id = tk[p++]; if (!id || id.t !== "id") throw new Error("se esperaba un nombre tras «.»"); e = peek("(") ? { k: "method", obj: e, name: id.v, args: args() } : { k: "get", obj: e, key: { k: "lit", v: id.v } }; }
      else if (peek("[")) { p++; const key = expr(); eat("]"); e = { k: "get", obj: e, key }; }
      else return e;
    }
  }
  function unary() { if (peek("!")) { p++; return { k: "not", e: unary() }; } if (peek("-")) { p++; return { k: "neg", e: unary() }; } return postfix(); }
  const mul = bin(unary, ["*", "/", "%"]), add = bin(mul, ["+", "-"]), cmp = bin(add, ["==", "!=", "<=", ">=", "<", ">"]), and = bin(cmp, ["&&"]), or = bin(and, ["||"]);
  function expr() { return or(); }
  const e = expr();
  if (p < tk.length) throw new Error("sobra a partir del token " + p + ": " + JSON.stringify(tk[p]));
  return e;
}

/* valores: texto, número, booleano, null, listas, fechas ({ d: Date }), enlaces ({ link }) y notas ({ note }) */
const isDate = v => v && typeof v === "object" && v.d instanceof Date;
const truthy = v => Array.isArray(v) ? v.length > 0 : isDate(v) ? true : v && typeof v === "object" ? true : !!v;
const str = v => v == null ? "" : Array.isArray(v) ? v.map(str).join(", ") : typeof v !== "object" || v instanceof RegExp ? String(v) : isDate(v) ? v.d.toISOString().slice(0, 10) : v.note ? v.note.basename : v.link ? "[[" + v.link + "]]" : String(v);
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(s));
  if (!m) throw new Error("fecha no válida: " + str(s));
  return { d: new Date(+m[1], +m[2] - 1, +m[3]) };
}
function fmt(d, f, lang) {
  const p2 = n => String(n).padStart(2, "0");
  return f.replace(/YYYY|MMM|MM|DD|D/g, x => x === "YYYY" ? d.getFullYear() : x === "MMM" ? MONTHS[lang][d.getMonth()] : x === "MM" ? p2(d.getMonth() + 1) : x === "DD" ? p2(d.getDate()) : d.getDate());
}

export function evaluate(src, ctx, scope = {}) {
  const ast = typeof src === "string" ? parse(src) : src;
  const lang = ctx.lang || "es";
  const noteObj = n => ({ note: n });
  const toNote = v => v && typeof v === "object" && v.note ? v.note : v && typeof v === "object" && v.link ? ctx.notes.find(n => n.basename === v.link || n.path === v.link) : typeof v === "string" ? ctx.notes.find(n => n.path === v || n.basename === v) : null;
  const ev = (e, sc) => {
    switch (e.k) {
      case "lit": return e.v;
      case "list": return e.items.map(x => ev(x, sc));
      case "not": return !truthy(ev(e.e, sc));
      case "neg": return -ev(e.e, sc);
      case "id":
        if (e.name in sc) return sc[e.name];
        if (e.name === "true") return true;
        if (e.name === "false") return false;
        if (e.name === "note") return { fm: ctx.fm };
        if (e.name === "file") return noteObj(ctx.file);
        if (e.name === "formula") return { formula: true };
        if (e.name === "values" || e.name === "this") throw new Error(e.name + " no está");
        return ctx.fm[e.name] ?? null;
      case "get": {
        const o = ev(e.obj, sc), key = ev(e.key, sc);
        if (o && o.fm) return o.fm[key] ?? null;
        if (o && o.formula) return formula(key);
        if (o && o.note) {
          const n = o.note;
          if (key === "name") return n.basename + ".md";
          if (key === "basename") return n.basename;
          if (key === "path") return n.path;
          if (key === "folder") return n.path.split("/").slice(0, -1).join("/");
          if (key === "properties") return { fm: n.fm };
          if (key === "backlinks") return ctx.backlinks(n.path).map(b => ({ link: b.basename }));
          throw new Error("file." + key + " no está");
        }
        if (Array.isArray(o)) return o[key] ?? null;
        if (isDate(o) && key === "year") return o.d.getFullYear();
        if (o == null) return null;
        throw new Error(`no se puede leer «${key}» de ${JSON.stringify(o)}`);
      }
      case "bin": {
        if (e.op === "&&") return truthy(ev(e.l, sc)) && truthy(ev(e.r, sc));
        if (e.op === "||") return truthy(ev(e.l, sc)) || truthy(ev(e.r, sc));
        const a = ev(e.l, sc), b = ev(e.r, sc);
        const num = v => isDate(v) ? v.d.getTime() : v;
        switch (e.op) {
          case "+": return typeof a === "string" || typeof b === "string" ? str(a) + str(b) : a + b;
          case "-": return num(a) - num(b);
          case "*": return a * b;
          case "/": return a / b;
          case "%": return a % b;
          case "==": return str(a) === str(b);
          case "!=": return str(a) !== str(b);
          case "<": return num(a) < num(b);
          case ">": return num(a) > num(b);
          case "<=": return num(a) <= num(b);
          case ">=": return num(a) >= num(b);
        }
        throw new Error("operador " + e.op);
      }
      case "call": {
        const A = () => e.args.map(x => ev(x, sc));
        switch (e.name) {
          case "if": return truthy(ev(e.args[0], sc)) ? ev(e.args[1], sc) : e.args[2] ? ev(e.args[2], sc) : null;
          case "date": return parseDate(A()[0]);
          case "today": return parseDate(ctx.today);
          case "now": return parseDate(ctx.today);
          case "number": { const v = A()[0]; if (isDate(v)) return v.d.getTime(); if (typeof v === "boolean") return v ? 1 : 0; const n = Number(str(v)); if (isNaN(n)) throw new Error("number() de " + str(v)); return n; }
          case "list": { const v = A()[0]; return Array.isArray(v) ? v : v == null ? [] : [v]; }
          case "file": { const v = A()[0]; const n = toNote(v); if (!n) throw new Error("file() de " + str(v)); return noteObj(n); }
          case "link": return { link: str(A()[0]) };
          case "max": return Math.max(...A());
          case "min": return Math.min(...A());
        }
        throw new Error("función " + e.name + "() no está");
      }
      case "method": {
        const o = ev(e.obj, sc), name = e.name;
        if (name === "filter" || name === "map") {
          if (!Array.isArray(o)) throw new Error(name + "() en algo que no es lista");
          const out = o.map((value, index) => ev(e.args[0], { ...sc, value, index }));
          return name === "map" ? out : o.filter((_, i) => truthy(out[i]));
        }
        const a = e.args.map(x => ev(x, sc));
        if (o instanceof RegExp) { if (name === "matches") return new RegExp(o.source, o.flags.replace("g", "")).test(str(a[0])); }
        if (isDate(o)) { if (name === "format") return fmt(o.d, a[0], lang); }
        if (Array.isArray(o)) {
          if (name === "join") return o.map(str).join(a[0]);
          if (name === "contains") return o.some(x => str(x) === str(a[0]));
          if (name === "isEmpty") return o.length === 0;
        }
        if (o && o.note) {
          if (name === "hasTag") return (o.note.fm.tags || []).some(t => t === a[0]);
          if (name === "inFolder") return o.note.path.startsWith(a[0] + "/");
        }
        if (typeof o === "number") {
          if (name === "round") return Math.round(o);
          if (name === "floor") return Math.floor(o);
          if (name === "toString") return String(o);
        }
        if (name === "toString") return str(o);
        if (typeof o === "string") {
          if (name === "replace") return a[0] instanceof RegExp ? o.replace(a[0], a[1]) : o.split(a[0]).join(a[1]);
          if (name === "lower") return o.toLowerCase();
          if (name === "repeat") return o.repeat(Math.max(0, a[0]));
          if (name === "contains") return o.includes(a[0]);
        }
        throw new Error(`método .${name}() en ${JSON.stringify(o)}`);
      }
    }
    throw new Error("nodo " + e.k);
  };
  const cache = ctx._cache ||= {};
  function formula(k) {
    if (k in cache) return cache[k];
    if (!(k in ctx.formulas)) throw new Error("formula." + k + " no existe");
    cache[k] = undefined;
    return cache[k] = evaluate(ctx.formulas[k], ctx);
  }
  return ev(ast, scope);
}
export { parse };
