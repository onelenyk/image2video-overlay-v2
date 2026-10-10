// Code overlays are drawn by code the user (or an AI model, or somebody else's
// template) wrote, so that code is never run in the page. It runs here:
//
//   page  ──►  hidden <iframe sandbox="allow-scripts">   no origin: no storage, no cookies, no access to the page
//                └─►  Worker, one per piece of code      CSP default-src 'none': no network of any kind
//
// The worker draws one frame on an OffscreenCanvas and hands back a bitmap.
// If it does not answer in time it is terminated, so a loop that never ends
// costs one overlay its picture and nothing else.

export type ParamValue = number | string | boolean;
/** A setting the code asks the editor to show: `export const params = { size: { type: "number", default: 4, min: 1, max: 20 } }`. */
export interface ParamSpec { type: "number" | "color" | "text" | "toggle"; default: ParamValue; label?: string; min?: number; max?: number; step?: number }

export interface CodeStatus {
  /** Settings declared by the code, once it has loaded. */
  params: Record<string, ParamSpec>;
  /** Why it cannot draw (syntax error, exception, took too long), with the line in the user's code when known. */
  error: { message: string; line: number | null } | null;
}

export interface FrameRequest { code: string; t: number; w: number; h: number; pw: number; ph: number; params: Record<string, ParamValue> }

export const MAX_CODE = 20_000; // characters
const MAX_WORKERS = 8;
const LOAD_MS = 3000;
/** The longest one frame may take: generous when exporting, tight while editing so the editor stays lively. */
export const BUDGET = { live: 250, exact: 4000 };

// ---------- inside the worker ----------
// Runs before the user's code: random numbers and clocks are fixed, so a frame depends only on `t`.
const PRELUDE = `"use strict";
var __seed = 1;
var __rand = function () { __seed = (__seed + 0x6D2B79F5) | 0; var x = Math.imul(__seed ^ (__seed >>> 15), 1 | __seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
Math.random = __rand;
Date.now = function () { return 0; };
if (self.performance) self.performance.now = function () { return 0; };
var __post = self.postMessage.bind(self);
var ui = (function () {
  var FONT = "px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  var u = {};
  u.clamp = function (v, lo, hi) { return Math.min(hi === undefined ? 1 : hi, Math.max(lo === undefined ? 0 : lo, v)); };
  u.ease = function (k) { k = u.clamp(k); return 1 - Math.pow(1 - k, 3); };
  u.back = function (k) { k = u.clamp(k); return 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); };
  u.prog = function (t, start, seconds) { return u.ease((t - (start || 0)) / (seconds || 1)); };
  u.font = function (ctx, size, weight) { ctx.font = (weight || 600) + " " + size + FONT; };
  u.fit = function (ctx, text, maxWidth, size, weight) { u.font(ctx, size, weight); for (var i = 0; i < 5; i++) { var wide = ctx.measureText(text).width; if (wide <= maxWidth || size <= 6) break; size = Math.max(6, size * maxWidth / wide * 0.985); u.font(ctx, size, weight); } return size; };
  u.text = function (ctx, text, x, y, o) { o = o || {}; ctx.save(); var size = o.size || 32; if (o.maxWidth) size = u.fit(ctx, text, o.maxWidth, size, o.weight); else u.font(ctx, size, o.weight); ctx.textAlign = o.align || "left"; ctx.textBaseline = o.baseline || "middle"; if (o.alpha !== undefined) ctx.globalAlpha *= u.clamp(o.alpha); if (o.outline) { ctx.lineWidth = size * 0.16; ctx.lineJoin = "round"; ctx.strokeStyle = o.outline; ctx.strokeText(text, x, y); } ctx.fillStyle = o.color || "#ffffff"; ctx.fillText(text, x, y); ctx.restore(); return size; };
  u.card = function (ctx, x, y, w, h, o) { o = o || {}; var r = Math.min(o.radius === undefined ? 22 : o.radius, w / 2, h / 2); ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= u.clamp(o.alpha); if (o.shadow !== false) { ctx.shadowColor = o.glow || "rgba(0,0,0,0.38)"; ctx.shadowBlur = o.glow ? 34 : 30; ctx.shadowOffsetY = o.glow ? 0 : 10; } var fill = o.fill || "rgba(17,24,39,0.9)"; if (o.fill2) { var g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, fill); g.addColorStop(1, o.fill2); fill = g; } ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.shadowColor = "transparent"; if (o.edge !== false) { ctx.strokeStyle = o.edge || "rgba(255,255,255,0.16)"; ctx.lineWidth = 1.5; ctx.stroke(); } ctx.restore(); };
  u.pill = function (ctx, text, cx, cy, o) { o = o || {}; var size = o.size || 30; u.font(ctx, size, o.weight || 600); var pad = size * 0.7, w = Math.min(o.maxWidth || 1e9, ctx.measureText(text).width + pad * 2), h = size * 1.9; u.card(ctx, cx - w / 2, cy - h / 2, w, h, { radius: h / 2, fill: o.fill, edge: o.edge, alpha: o.alpha, shadow: o.shadow }); u.text(ctx, text, cx, cy + size * 0.04, { size: size, weight: o.weight || 600, color: o.color, align: "center", maxWidth: w - pad * 2, alpha: o.alpha }); return w; };
  u.ring = function (ctx, cx, cy, r, value, o) { o = o || {}; var lw = o.width || r * 0.2; ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = lw; ctx.strokeStyle = o.track || "rgba(255,255,255,0.14)"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); if (value > 0) { ctx.strokeStyle = o.color || "#ffd60a"; if (o.glow !== false) { ctx.shadowColor = o.color || "#ffd60a"; ctx.shadowBlur = lw; } ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u.clamp(value)); ctx.stroke(); } ctx.restore(); };
  u.path = function (ctx, points, k, o) { o = o || {}; k = u.clamp(k); var len = [], total = 0, i; for (i = 1; i < points.length; i++) { var d = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); len.push(d); total += d; } var run = total * k, head = points[0]; ctx.save(); ctx.lineWidth = o.width || 8; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = o.color || "#0a84ff"; if (o.glow !== false) { ctx.shadowColor = o.color || "#0a84ff"; ctx.shadowBlur = 16; } ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); for (i = 0; i < len.length; i++) { if (run >= len[i]) { ctx.lineTo(points[i + 1][0], points[i + 1][1]); head = points[i + 1]; run -= len[i]; } else { var f = len[i] ? run / len[i] : 0; head = [points[i][0] + (points[i + 1][0] - points[i][0]) * f, points[i][1] + (points[i + 1][1] - points[i][1]) * f]; ctx.lineTo(head[0], head[1]); break; } } if (k > 0) ctx.stroke(); ctx.restore(); return { x: head[0], y: head[1] }; };
  u.dots = function (ctx, cx, cy, count, active, o) { o = o || {}; var gap = o.gap || 22, r = o.size || 5, x = cx - gap * (count - 1) / 2, i; ctx.save(); for (i = 0; i < count; i++) { ctx.fillStyle = i === active ? (o.color || "#ffffff") : "rgba(255,255,255,0.35)"; ctx.beginPath(); if (i === active) ctx.roundRect(x + i * gap - r * 2.2, cy - r, r * 4.4, r * 2, r); else ctx.arc(x + i * gap, cy, r, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); };
  return u;
})();
`;
// One line, so that a line number in an error is the user's own line.
const PRELUDE_LINES = PRELUDE.split("\n").length - 1;

// Runs after the user's code.
const RUNTIME = `
;(function () {
  var canvas = new OffscreenCanvas(1, 1), ctx = canvas.getContext("2d");
  // The box is w by h units whatever the bitmap's size. Code that resets the transform (a common habit)
  // must come back to that scale, not to raw pixels, so the three transform setters are made relative to it.
  var sx = 1, sy = 1;
  var rawSet = ctx.setTransform.bind(ctx), rawGet = ctx.getTransform.bind(ctx);
  ctx.setTransform = function (a, b, c, d, e, f) {
    if (a && typeof a === "object") { f = a.f; e = a.e; d = a.d; c = a.c; b = a.b; a = a.a; }
    if (a === undefined) { a = 1; b = 0; c = 0; d = 1; e = 0; f = 0; }
    rawSet(a * sx, b * sy, c * sx, d * sy, e * sx, f * sy);
  };
  ctx.resetTransform = function () { rawSet(sx, 0, 0, sy, 0, 0); };
  ctx.getTransform = function () { var m = rawGet(); return new DOMMatrix([m.a / sx, m.b / sy, m.c / sx, m.d / sy, m.e / sx, m.f / sy]); };
  var declared = null;
  try { declared = typeof params === "object" && params ? JSON.parse(JSON.stringify(params)) : null; } catch (e) { declared = null; }
  var ok = typeof draw === "function";
  self.onmessage = function (e) {
    var m = e.data;
    try {
      canvas.width = m.pw; canvas.height = m.ph; // also clears it and resets the drawing state
      sx = m.pw / m.w; sy = m.ph / m.h;
      ctx.resetTransform();
      __seed = 1;
      var p = {};
      if (declared) for (var name in declared) if (declared[name] && typeof declared[name] === "object") p[name] = declared[name].default;
      for (var given in m.params) p[given] = m.params[given];
      draw(ctx, m.t, m.w, m.h, p);
      var bitmap = canvas.transferToImageBitmap();
      __post({ id: m.id, bitmap: bitmap }, [bitmap]);
    } catch (err) {
      __post({ id: m.id, error: String(err && err.message || err) });
    }
  };
  __post({ ready: true, params: declared, error: ok ? null : "The code must define function draw(ctx, t, w, h, p)." });
})();
`;

// ---------- inside the iframe ----------
// Plain script text: it is placed in the iframe's document, never run in the page.
const HOST = `
var workers = {};
var boss = window.parent;
function tell(message, transfer) { boss.postMessage(message, "*", transfer || []); }
function drop(key) { var w = workers[key]; if (w) { w.worker.terminate(); URL.revokeObjectURL(w.url); clearTimeout(w.timer); delete workers[key]; } }
addEventListener("message", function (e) {
  if (e.source !== boss) return;
  var m = e.data;
  if (m.op === "load") {
    drop(m.key);
    var url = URL.createObjectURL(new Blob([m.source], { type: "text/javascript" }));
    var worker;
    try { worker = new Worker(url); } catch (err) { tell({ key: m.key, ready: true, error: String(err && err.message || err), fatal: true }); return; }
    var entry = workers[m.key] = { worker: worker, url: url, timer: 0, pending: null };
    entry.timer = setTimeout(function () { drop(m.key); tell({ key: m.key, ready: true, error: "The code took too long to start.", fatal: true }); }, m.loadMs);
    worker.onerror = function (err) {
      if (err.preventDefault) err.preventDefault();
      var pending = entry.pending;
      drop(m.key);
      tell({ key: m.key, ready: true, error: String(err.message || "The code could not be run."), line: err.lineno || null, fatal: true, id: pending });
    };
    worker.onmessage = function (ev) {
      var d = ev.data;
      if (d.ready) { clearTimeout(entry.timer); tell({ key: m.key, ready: true, params: d.params, error: d.error, fatal: !!d.error }); if (d.error) drop(m.key); return; }
      if (d.id !== entry.pending) return;
      clearTimeout(entry.timer); entry.pending = null;
      if (d.bitmap) tell({ key: m.key, id: d.id, bitmap: d.bitmap }, [d.bitmap]); else tell({ key: m.key, id: d.id, error: d.error });
    };
  } else if (m.op === "frame") {
    var w = workers[m.key];
    if (!w) { tell({ key: m.key, id: m.id, error: "gone", fatal: true }); return; }
    w.pending = m.id;
    clearTimeout(w.timer);
    w.timer = setTimeout(function () { drop(m.key); tell({ key: m.key, id: m.id, error: "The code took too long to draw a frame.", fatal: true }); }, m.budget);
    w.worker.postMessage(m.frame);
  } else if (m.op === "drop") drop(m.key);
});
tell({ boot: true });
`;

const DOCUMENT = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:"><script>${HOST}</script>`;

// ---------- in the page ----------
interface Program {
  key: string;
  ready: Promise<void>;
  resolveReady: () => void;
  status: CodeStatus;
  dead: boolean;
  waiting: Map<number, (bitmap: ImageBitmap | null) => void>;
  /** Frames are drawn one at a time per program. */
  queue: Promise<unknown>;
  used: number;
}

let frame: HTMLIFrameElement | null = null;
let booted: Promise<void> | null = null;
let supported: boolean | null = null;
let nextId = 1;
let clock = 0;
const programs = new Map<string, Program>();
const listeners = new Set<() => void>();

/** Called whenever a program's status changes (loaded, failed), so panels can show it. */
export function onCodeStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const announce = () => listeners.forEach((listener) => listener());

/** False where the browser cannot run code safely (no workers with their own canvas). Known after the first frame. */
export const codeSupported = () => supported !== false;

function boot(): Promise<void> {
  if (booted) return booted;
  booted = new Promise<void>((resolve) => {
    if (typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined") { supported = false; resolve(); return; }
    const el = document.createElement("iframe");
    el.setAttribute("sandbox", "allow-scripts");
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    el.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
    const giveUp = window.setTimeout(() => { supported = false; resolve(); }, 4000);
    window.addEventListener("message", (e) => {
      if (!frame || e.source !== frame.contentWindow) return;
      const m = e.data as { boot?: boolean; key?: string; id?: number; ready?: boolean; params?: unknown; error?: string | null; line?: number | null; fatal?: boolean; bitmap?: ImageBitmap };
      if (m.boot) { clearTimeout(giveUp); supported = true; resolve(); return; }
      const program = m.key ? programs.get(m.key) : undefined;
      if (!program) { m.bitmap?.close(); return; }
      if (m.ready) {
        program.status = { params: cleanParams(m.params), error: m.error ? { message: m.error, line: m.line ? Math.max(1, m.line - PRELUDE_LINES) : null } : null };
      } else if (m.error && m.fatal) {
        program.status = { ...program.status, error: { message: m.error, line: null } };
      }
      if (m.fatal) { program.dead = true; program.waiting.forEach((done) => done(null)); program.waiting.clear(); }
      if (m.ready) program.resolveReady();
      if (m.id != null) {
        const done = program.waiting.get(m.id);
        program.waiting.delete(m.id);
        if (done) done(m.bitmap ?? null); else m.bitmap?.close();
        if (m.error && !m.fatal) program.status = { ...program.status, error: { message: m.error, line: null } };
        else if (m.bitmap && program.status.error) program.status = { ...program.status, error: null };
      }
      announce();
    });
    el.srcdoc = DOCUMENT;
    frame = el;
    document.body.appendChild(el);
  });
  return booted;
}

/** Only plain, known fields of what the code declared survive. */
function cleanParams(raw: unknown): Record<string, ParamSpec> {
  const out: Record<string, ParamSpec> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [name, value] of Object.entries(raw as Record<string, unknown>).slice(0, 12)) {
    const v = value as Record<string, unknown>;
    if (!/^[a-zA-Z_]\w{0,23}$/.test(name) || !v || typeof v !== "object") continue;
    const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
    const label = typeof v.label === "string" ? v.label.slice(0, 30) : undefined;
    if (v.type === "number" && num(v.default) !== undefined) out[name] = { type: "number", default: v.default as number, label, min: num(v.min), max: num(v.max), step: num(v.step) };
    else if (v.type === "color" && typeof v.default === "string" && /^#[0-9a-f]{3,8}$/i.test(v.default)) out[name] = { type: "color", default: v.default, label };
    else if (v.type === "text" && typeof v.default === "string") out[name] = { type: "text", default: v.default.slice(0, 200), label };
    else if (v.type === "toggle" && typeof v.default === "boolean") out[name] = { type: "toggle", default: v.default, label };
  }
  return out;
}

function load(code: string): Program {
  const existing = programs.get(code);
  if (existing) { existing.used = ++clock; return existing; }
  // Make room: the program used longest ago goes
  if (programs.size >= MAX_WORKERS) {
    const oldest = [...programs.values()].sort((a, b) => a.used - b.used)[0];
    programs.delete(oldest.key);
    oldest.waiting.forEach((done) => done(null));
    frame?.contentWindow?.postMessage({ op: "drop", key: oldest.key }, "*");
  }
  let resolveReady = () => {};
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
  const program: Program = { key: code, ready, resolveReady, status: { params: {}, error: null }, dead: false, waiting: new Map(), queue: Promise.resolve(), used: ++clock };
  programs.set(code, program);
  if (code.length > MAX_CODE) {
    program.dead = true;
    program.status.error = { message: "The code is too long.", line: null };
    resolveReady();
  } else {
    // `export` is allowed in front of declarations, as in the examples; a worker script has no modules
    const source = PRELUDE + code.replace(/^(\s*)export\s+(?=(const|let|var|function)\b)/gm, "$1") + RUNTIME;
    frame!.contentWindow!.postMessage({ op: "load", key: code, source, loadMs: LOAD_MS }, "*");
  }
  return program;
}

/** What is known about a piece of code so far: its settings and whether it runs. */
export function codeStatus(code: string): CodeStatus | null {
  return programs.get(code)?.status ?? null;
}

/**
 * One frame of a code overlay as a bitmap, or null if the code cannot draw it
 * (see codeStatus for why). `budget` is the time allowed in milliseconds.
 */
export async function codeFrame(request: FrameRequest, budget: number): Promise<ImageBitmap | null> {
  await boot();
  if (!supported || !frame?.contentWindow) return null;
  const program = load(request.code);
  await program.ready;
  if (program.dead) return null;
  const { t, w, h, pw, ph, params } = request;
  const draw = () => new Promise<ImageBitmap | null>((resolve) => {
    if (program.dead || programs.get(program.key) !== program) { resolve(null); return; }
    const id = nextId++;
    program.waiting.set(id, resolve);
    frame!.contentWindow!.postMessage({ op: "frame", key: program.key, id, budget, frame: { id, t, w, h, pw, ph, params } }, "*");
  });
  const result = program.queue.then(draw);
  program.queue = result;
  return result;
}

/** Loads a piece of code without drawing, so its settings and errors become known. */
export async function codeCheck(code: string): Promise<CodeStatus> {
  await boot();
  if (!supported || !frame?.contentWindow) return { params: {}, error: { message: "unsupported", line: null } };
  const program = load(code);
  await program.ready;
  return program.status;
}

/** Forgets a program that failed, so the same code can be tried again (after a timeout, say). */
export function codeRetry(code: string) {
  const program = programs.get(code);
  if (program?.dead) programs.delete(code);
}
