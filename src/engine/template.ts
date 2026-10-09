import { ANIMATIONS, animationsFor } from "./animations";
import { prepareSvg } from "./renderer";
import { defaultAnim, normalizeScene } from "./scene";
import type { Anim, AnimType, Asset, BoxEl, El, ImageEl, LineEl, PathEl, PointEl, PolygonEl, Scene, Timing, Vec } from "./types";

// Templates are DATA, not code. A template lists parts ("a pill here, a route
// there") in fractions of the stage and in style tokens; this module checks the
// data and turns it into overlays. Because of that a template can come from
// anywhere (bundled, saved by the user, loaded later from a server) without
// being able to run code, inject markup or break the editor:
//   - only the part kinds, tones, sizes, symbols and animations listed here exist;
//   - every number is range-checked, every text length-limited;
//   - there is no way to pass raw SVG, HTML, URLs or colours outside the palette.
// One style for everything: all sizes, widths and colours come from STYLE.

// ---------- the one style ----------
export const STYLE = {
  tone: { accent: "#ffd60a", danger: "#ff453a", success: "#30d158", info: "#0a84ff", dark: "#111827", light: "#ffffff" },
  /** Text colour that reads on each tone. */
  ink: { accent: "#000000", danger: "#ffffff", success: "#000000", info: "#ffffff", dark: "#ffffff", light: "#000000" },
  text: { sm: 28, md: 34, lg: 46 },
  stroke: { thin: 5, regular: 8, bold: 12 },
  badge: 84,       // diameter of a numbered disc
  point: 22,       // radius of a point
  symbol: 150,     // default size of a plan symbol
  plateOpacity: 0.92,
  fade: 0.3,       // how overlays fade in when their moment comes
  drawSeconds: 1.6 // default time for a route to draw itself
} as const;

export type Tone = keyof typeof STYLE.tone;
export type TextSize = keyof typeof STYLE.text;

// Plan symbols, seen from above. Templates can only name these; they cannot bring their own drawing.
const SYMBOLS = {
  sofa: '<rect x="4" y="13" width="40" height="24" rx="5"/><rect x="10" y="19" width="28" height="14" rx="3"/><path d="M4 21h6M38 21h6"/>',
  bed: '<rect x="8" y="4" width="32" height="40" rx="3"/><rect x="12" y="8" width="10" height="7" rx="2"/><rect x="26" y="8" width="10" height="7" rx="2"/><path d="M8 20h32"/>',
  table: '<circle cx="24" cy="24" r="10"/><rect x="19" y="4" width="10" height="6" rx="2"/><rect x="19" y="38" width="10" height="6" rx="2"/><rect x="4" y="19" width="6" height="10" rx="2"/><rect x="38" y="19" width="6" height="10" rx="2"/>',
  bath: '<rect x="5" y="12" width="38" height="24" rx="10"/><rect x="10" y="17" width="28" height="14" rx="7"/><circle cx="14" cy="24" r="1.5"/>',
  pin: '<path d="M24 4c-7.7 0-14 6.3-14 14 0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14zm0 19a5 5 0 110-10 5 5 0 010 10z" fill="#000" stroke="none"/>',
  home: '<path d="M6 22L24 7l18 15"/><path d="M11 19v21h26V19"/><rect x="20" y="28" width="8" height="12"/>',
  shop: '<path d="M8 16h32l-3 26H11z"/><path d="M17 16v-3a7 7 0 0114 0v3"/>',
  tree: '<circle cx="24" cy="19" r="13"/><path d="M24 32v12M18 44h12"/>',
  bus: '<rect x="9" y="6" width="30" height="32" rx="5"/><path d="M9 22h30M15 38v4M33 38v4"/><circle cx="16" cy="31" r="1.8"/><circle cx="32" cy="31" r="1.8"/>',
  school: '<path d="M4 18l20-9 20 9-20 9z"/><path d="M12 22v10c7 6 17 6 24 0V22M44 18v12"/>',
  exit: '<path d="M10 42V6h22v36"/><path d="M6 42h34M24 24h18M36 18l6 6-6 6"/>',
  tap: '<circle cx="24" cy="18" r="6"/><circle cx="24" cy="18" r="13"/><path d="M24 24v20"/>',
  check: '<path d="M8 25l10 10 22-22" stroke-width="5.5"/>',
  cross: '<path d="M10 10l28 28M38 10L10 38" stroke-width="5.5"/>',
  warn: '<path d="M24 6l20 35H4z"/><path d="M24 19v11M24 35.5v.5" stroke-width="3.6"/>',
  star: '<path d="M24 5l5.9 12 13.1 1.9-9.5 9.3 2.2 13.1L24 35l-11.7 6.3 2.2-13.1L5 18.9 18.1 17z" fill="#000" stroke="none"/>',
} as const;
export type SymbolName = keyof typeof SYMBOLS;
export const SYMBOL_NAMES = Object.keys(SYMBOLS) as SymbolName[];

// ---------- the template format ----------
interface PartBase {
  /** When the part appears, seconds from the start of the video. */
  at?: number;
  /** When it disappears (omit to stay until the end). */
  until?: number;
  anim?: { type: AnimType; seconds?: number };
  name?: string;
  /** Parts with the same `set` belong together (a zone and its label) and land on the photo as one group of that name. */
  set?: string;
}
/** x, y, w, h and d are fractions of the stage: 0..1 across its width (x, w, d) or height (y, h). */
export type Part = PartBase & (
  | { kind: "pill"; text: string; x: number; y: number; tone?: Tone; size?: TextSize }
  | { kind: "text"; text: string; x: number; y: number; tone?: Tone; size?: TextSize }
  | { kind: "badge"; text: string; x: number; y: number; tone?: Tone }
  | { kind: "zone"; x: number; y: number; w: number; h: number; tone?: Tone; fill?: number; border?: "solid" | "dashed" | "none"; label?: string }
  | { kind: "ring"; x: number; y: number; d: number; tone?: Tone; fill?: number; border?: "solid" | "dashed" }
  | { kind: "area"; points: [number, number][]; tone?: Tone; fill?: number }
  | { kind: "point"; x: number; y: number; label?: string; tone?: Tone }
  | { kind: "line"; from: [number, number]; to: [number, number]; tone?: Tone; arrow?: "none" | "end" | "both"; dashed?: boolean; weight?: keyof typeof STYLE.stroke }
  | { kind: "route"; points: [number, number][]; tone?: Tone; seconds?: number; straight?: boolean; weight?: keyof typeof STYLE.stroke }
  | { kind: "symbol"; symbol: SymbolName; x: number; y: number; tone?: Tone; size?: number }
);

/** The kind of picture a template is meant for; the gallery shows it on a sample of that kind. */
export const SAMPLE_KINDS = ["plan", "map", "screen", "photo"] as const;
export type SampleKind = (typeof SAMPLE_KINDS)[number];

export interface TemplateSpec {
  v: 1;
  id: string;
  name: string;
  group: string;
  hint: string;
  sample?: SampleKind;
  parts: Part[];
}

// ---------- validation ----------
const MAX_PARTS = 40, MAX_POINTS = 60, MAX_TEXT = 80;
const num = (v: unknown, lo: number, hi: number, fallback?: number): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback ?? null;
const frac = (v: unknown) => num(v, -0.25, 1.25);
/** Plain text only: control characters become spaces, length is capped. */
const str = (v: unknown, max = MAX_TEXT) =>
  typeof v === "string" ? [...v].map((ch) => (ch.charCodeAt(0) < 32 ? " " : ch)).join("").slice(0, max) : null;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const TONES = Object.keys(STYLE.tone) as Tone[];
const SIZES = Object.keys(STYLE.text) as TextSize[];
const WEIGHTS = Object.keys(STYLE.stroke) as (keyof typeof STYLE.stroke)[];
const pair = (v: unknown): [number, number] | null => {
  if (!Array.isArray(v) || v.length !== 2) return null;
  const x = frac(v[0]), y = frac(v[1]);
  return x === null || y === null ? null : [x, y];
};
const pairs = (v: unknown, min: number): [number, number][] | null => {
  if (!Array.isArray(v) || v.length < min || v.length > MAX_POINTS) return null;
  const out = v.map(pair);
  return out.every((p) => p !== null) ? (out as [number, number][]) : null;
};

/** One part, rebuilt from untrusted data with only known fields, or null if it is unusable. */
function parsePart(raw: unknown): Part | null {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object") return null;
  const common: PartBase = {};
  const at = num(r.at, 0, 120), until = num(r.until, 0, 120);
  if (at !== null) common.at = at;
  if (until !== null && until > (at ?? 0)) common.until = until;
  const name = str(r.name, 40);
  if (name) common.name = name;
  const set = str(r.set, 40)?.trim();
  if (set) common.set = set;
  const a = r.anim as Record<string, unknown> | undefined;
  if (a && typeof a.type === "string" && Object.hasOwn(ANIMATIONS, a.type)) common.anim = { type: a.type as AnimType, seconds: num(a.seconds, 0.3, 10) ?? undefined };
  const tone = oneOf(r.tone, TONES, "accent");
  const x = frac(r.x), y = frac(r.y);

  switch (r.kind) {
    case "pill":
    case "text":
    case "badge": {
      const text = str(r.text, r.kind === "badge" ? 3 : MAX_TEXT);
      if (text === null || x === null || y === null) return null;
      return r.kind === "badge" ? { ...common, kind: "badge", text, x, y, tone } : { ...common, kind: r.kind, text, x, y, tone: oneOf(r.tone, TONES, r.kind === "pill" ? "dark" : "light"), size: oneOf(r.size, SIZES, "md") };
    }
    case "zone": {
      const w = num(r.w, 0.02, 1.5), h = num(r.h, 0.02, 1.5);
      if (x === null || y === null || w === null || h === null) return null;
      return { ...common, kind: "zone", x, y, w, h, tone, fill: num(r.fill, 0, 1, 0.3)!, border: oneOf(r.border, ["solid", "dashed", "none"] as const, "solid"), label: str(r.label) ?? undefined };
    }
    case "ring": {
      const d = num(r.d, 0.02, 1.5);
      if (x === null || y === null || d === null) return null;
      return { ...common, kind: "ring", x, y, d, tone, fill: num(r.fill, 0, 1, 0)!, border: oneOf(r.border, ["solid", "dashed"] as const, "solid") };
    }
    case "area": {
      const points = pairs(r.points, 3);
      return points ? { ...common, kind: "area", points, tone, fill: num(r.fill, 0, 1, 0.3)! } : null;
    }
    case "point":
      return x === null || y === null ? null : { ...common, kind: "point", x, y, label: str(r.label, 40) ?? undefined, tone: oneOf(r.tone, TONES, "info") };
    case "line": {
      const from = pair(r.from), to = pair(r.to);
      return from && to ? { ...common, kind: "line", from, to, tone: oneOf(r.tone, TONES, "light"), arrow: oneOf(r.arrow, ["none", "end", "both"] as const, "none"), dashed: r.dashed === true, weight: oneOf(r.weight, WEIGHTS, "regular") } : null;
    }
    case "route": {
      const points = pairs(r.points, 2);
      return points ? { ...common, kind: "route", points, tone, seconds: num(r.seconds, 0.2, 20, STYLE.drawSeconds)!, straight: r.straight === true, weight: oneOf(r.weight, WEIGHTS, "bold") } : null;
    }
    case "symbol":
      if (x === null || y === null || typeof r.symbol !== "string" || !Object.hasOwn(SYMBOLS, r.symbol)) return null;
      return { ...common, kind: "symbol", symbol: r.symbol as SymbolName, x, y, tone: oneOf(r.tone, TONES, "light"), size: num(r.size, 0.03, 0.8) ?? undefined };
    default:
      return null;
  }
}

/** A template rebuilt from untrusted data. Unknown or malformed parts are dropped; returns null if nothing usable is left. */
export function parseTemplate(raw: unknown): TemplateSpec | null {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object" || r.v !== 1 || !Array.isArray(r.parts)) return null;
  const id = str(r.id, 60), name = str(r.name, 40);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/i.test(id) || !name) return null;
  const parts = r.parts.slice(0, MAX_PARTS).map(parsePart).filter((p): p is Part => p !== null);
  if (!parts.length) return null;
  const sample = SAMPLE_KINDS.find((kind) => kind === r.sample);
  return { v: 1, id, name, group: str(r.group, 24) || "Other", hint: str(r.hint, 120) || "", ...(sample ? { sample } : {}), parts };
}

// ---------- building overlays ----------
const base = (name: string, color: string, opacity = 1) => ({ id: "", name, color, opacity, visible: true, anim: defaultAnim() });
const label = (text: string, color: string, size: number, show = true) => ({ text, show, color, size });

function plate(name: string, text: string, cx: number, cy: number, tone: Tone, size: number, filled: boolean): BoxEl {
  const w = Math.max(size * 2.2, text.length * size * 0.62 + size * 1.2), h = size * 1.9;
  return { ...base(name, STYLE.tone[tone], filled ? STYLE.plateOpacity : 0), type: "box", x: cx - w / 2, y: cy - h / 2, w, h, rot: 0, shape: "rect", radius: h / 2, borderWidth: 0, dashed: false, label: label(text, filled ? STYLE.ink[tone] : STYLE.tone[tone], size) };
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** What a part is called in the Overlays list when the template does not name it. */
export function partName(part: Part): string {
  switch (part.kind) {
    case "pill": case "text": return part.text || "Text";
    case "badge": return `Badge ${part.text}`;
    case "zone": return part.label || "Zone";
    case "ring": return "Ring";
    case "area": return "Area";
    case "point": return part.label || "Point";
    case "line": return part.arrow && part.arrow !== "none" ? "Arrow" : "Line";
    case "route": return "Route";
    case "symbol": return capital(part.symbol);
  }
}

export interface Built {
  elements: El[];
  assets: Record<string, Asset>;
  /** For each element, the set it belongs to (same key = moves together), or null. */
  sets: ({ key: string; name: string } | null)[];
}

/** Overlays for a validated template on a W x H stage. Ids are left empty for the editor to assign. */
export function buildTemplate(spec: TemplateSpec, W: number, H: number): Built {
  const assets: Record<string, Asset> = {};
  const elements: El[] = [];
  const sets: Built["sets"] = [];
  const P = ([x, y]: [number, number]): Vec => ({ x: W * x, y: H * y });

  spec.parts.forEach((part) => {
    const tone = (part as { tone?: Tone }).tone ?? "accent";
    const color = STYLE.tone[tone];
    const name = part.name ?? partName(part);
    let el: El;
    switch (part.kind) {
      case "pill":
      case "text":
        el = plate(name, part.text, W * part.x, H * part.y, tone, STYLE.text[part.size ?? "md"], part.kind === "pill");
        break;
      case "badge": {
        const d = STYLE.badge;
        el = { ...base(name, color), type: "box", x: W * part.x - d / 2, y: H * part.y - d / 2, w: d, h: d, rot: 0, shape: "ellipse", radius: 0, borderWidth: 0, dashed: false, label: label(part.text, STYLE.ink[tone], d * 0.55) } satisfies BoxEl;
        break;
      }
      case "zone":
        el = { ...base(name, color, part.fill ?? 0.3), type: "box", x: W * part.x, y: H * part.y, w: W * part.w, h: H * part.h, rot: 0, shape: "rect", radius: 0, borderWidth: part.border === "none" ? 0 : STYLE.stroke.regular, dashed: part.border === "dashed", label: label(part.label ?? "", "#ffffff", STYLE.text.md, !!part.label) } satisfies BoxEl;
        break;
      case "ring": {
        const d = W * part.d;
        el = { ...base(name, color, part.fill ?? 0), type: "box", x: W * part.x - d / 2, y: H * part.y - d / 2, w: d, h: d, rot: 0, shape: "ellipse", radius: 0, borderWidth: STYLE.stroke.regular, dashed: part.border === "dashed", label: label("", "#ffffff", STYLE.text.md, false) } satisfies BoxEl;
        break;
      }
      case "area":
        el = { ...base(name, color, part.fill ?? 0.3), type: "polygon", points: part.points.map(P), closed: true, fill: true, width: STYLE.stroke.regular, dashed: false } satisfies PolygonEl;
        break;
      case "point":
        el = { ...base(name, color), type: "point", x: W * part.x, y: H * part.y, r: STYLE.point, label: label(part.label ?? "", "#ffffff", STYLE.text.sm, !!part.label) } satisfies PointEl;
        break;
      case "line":
        el = { ...base(name, color), type: "line", a: P(part.from), b: P(part.to), width: STYLE.stroke[part.weight ?? "regular"], arrowA: part.arrow === "both", arrowB: part.arrow === "end" || part.arrow === "both", dashed: !!part.dashed } satisfies LineEl;
        break;
      case "route": {
        // A stroke that draws itself once: time stamps follow the distance along it
        const points = part.points.map(P);
        const lengths = points.map((p, i) => (i ? Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0));
        const total = lengths.reduce((a, b) => a + b, 0) || 1;
        let run = 0;
        const times = lengths.map((len) => { run += len; return (run / total) * (part.seconds ?? STYLE.drawSeconds); });
        el = { ...base(name, color), type: "path", points, width: STYLE.stroke[part.weight ?? "bold"], smooth: !part.straight, glow: 0, sketch: { start: part.at ?? 0, times, hold: part.until != null ? Math.max(0, part.until - (part.at ?? 0) - (part.seconds ?? STYLE.drawSeconds)) : null, fade: 0.4 } } satisfies PathEl;
        break;
      }
      case "symbol": {
        const key = `symbol-${part.symbol}`;
        if (!assets[key]) {
          const prepared = prepareSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${SYMBOLS[part.symbol]}</svg>`);
          if (!prepared) return;
          assets[key] = { format: "svg", data: prepared.markup, aspect: prepared.aspect };
        }
        const size = part.size ? W * part.size : STYLE.symbol;
        el = { ...base(name, color), type: "image", x: W * part.x - size / 2, y: H * part.y - size / 2, w: size, h: size, rot: 0, asset: key, tint: true } satisfies ImageEl;
        break;
      }
    }
    // Timing (routes carry theirs in the stroke) and animation, if it suits this kind of overlay
    if (part.kind !== "route" && (part.at != null || part.until != null)) {
      el.time = { start: part.at ?? 0, end: part.until ?? null, fade: STYLE.fade } satisfies Timing;
    }
    if (part.anim && animationsFor(el.type).includes(part.anim.type)) {
      el.anim = { enabled: true, type: part.anim.type, duration: part.anim.seconds ?? 1.6, delay: 0, intensity: 1 } satisfies Anim;
    }
    elements.push(el);
    sets.push(part.set ? { key: part.set, name: part.set } : null);
  });
  return { elements, assets, sets };
}

// ---------- templates made from the user's own overlays ----------
/** A snapshot of overlays as they are, to be reused on other photos. */
export interface SavedTemplate {
  v: 1;
  kind: "snapshot";
  id: string;
  name: string;
  w: number;
  h: number;
  elements: El[];
  assets: Record<string, Asset>;
  /** Names of the groups the elements refer to by `group`. */
  groups?: Record<string, { name: string }>;
}

const MAX_ASSET_CHARS = 2_000_000;

/** Checks a stored snapshot: malformed overlays are dropped, images must be sanitised SVG or embedded pictures. */
export function parseSaved(raw: unknown): SavedTemplate | null {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== "object" || r.v !== 1 || r.kind !== "snapshot") return null;
  const id = str(r.id, 60), name = str(r.name, 40);
  const w = num(r.w, 100, 5000), h = num(r.h, 100, 5000);
  if (!id || !name || w === null || h === null) return null;
  const scene = normalizeScene({ stage: { h }, elements: r.elements, groups: r.groups } as unknown as Scene);
  if (!scene || !scene.elements.length || scene.elements.length > 200) return null;
  const assets: Record<string, Asset> = {};
  for (const [key, value] of Object.entries((r.assets as Record<string, Asset>) ?? {})) {
    if (!value || typeof value.data !== "string" || value.data.length > MAX_ASSET_CHARS) continue;
    if (value.format === "svg") {
      const prepared = prepareSvg(value.data); // sanitise again: stored data is not trusted
      if (prepared) assets[key] = { format: "svg", data: prepared.markup, aspect: prepared.aspect };
    } else if (value.format === "png" && /^data:image\/(png|jpeg|webp);base64,/.test(value.data)) {
      assets[key] = { format: "png", data: value.data, aspect: num(value.aspect, 0.05, 20, 1)! };
    }
  }
  // Overlays whose picture did not survive the checks cannot be drawn
  const elements = scene.elements.filter((el) => el.type !== "image" || assets[el.asset]);
  return elements.length ? { v: 1, kind: "snapshot", id, name, w, h, elements, assets, groups: scene.groups } : null;
}

/** A saved snapshot fitted to another stage: positions follow the new proportions, sizes follow its width. */
export function buildSaved(saved: SavedTemplate, W: number, H: number): Built {
  const kx = W / saved.w, ky = H / saved.h;
  const at = (p: Vec): Vec => ({ x: p.x * kx, y: p.y * ky });
  const elements = saved.elements.map((el): El => {
    const fresh = { ...el, id: "", group: undefined };
    switch (fresh.type) {
      case "line": return { ...fresh, a: at(fresh.a), b: at(fresh.b), aRef: undefined, bRef: undefined };
      case "polygon": case "path": return { ...fresh, points: fresh.points.map(at) };
      case "point": return { ...fresh, ...at(fresh) };
      default: {
        // Keep the overlay's own size, move its centre
        const c = at({ x: fresh.x + fresh.w / 2, y: fresh.y + fresh.h / 2 });
        return { ...fresh, x: c.x - fresh.w / 2, y: c.y - fresh.h / 2 };
      }
    }
  });
  const sets = saved.elements.map((el) => (el.group ? { key: el.group, name: saved.groups?.[el.group]?.name ?? "" } : null));
  return { elements, assets: saved.assets, sets };
}
