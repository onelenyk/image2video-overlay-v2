import type { Anim, AnimType, ElType } from "./types";

// Animations are pure functions of loop phase: the canvas, the timeline tiles
// and the exported video all call the same code, so they cannot disagree, and
// every animation loops seamlessly.

export interface Pose {
  sx: number; sy: number;
  tx: number; ty: number; // stage units
  rot: number;            // radians
  alpha: number;
  fill: number;           // fill-alpha multiplier
  glow?: number;
  rings?: { scale: number; alpha: number }[];
  dash?: number;   // marching-dash phase 0..1
  trace?: number;  // visible fraction of the outline 0..1
  train?: number;  // position of the light running along the path 0..1
  sweep?: number;
  sweepAlpha?: number;
  hue?: number;
  dim?: number;
}

export const IDENTITY: Pose = { sx: 1, sy: 1, tx: 0, ty: 0, rot: 0, alpha: 1, fill: 1 };

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const wave = (p: number) => 0.5 - 0.5 * Math.cos(TAU * p); // 0 -> 1 -> 0
const bump = (p: number, c: number, w: number) => Math.exp(-(((p - c) / w) ** 2));
const easeInOut = (q: number) => (q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2);
const easeOutCubic = (q: number) => 1 - (1 - q) ** 3;
const easeOutBack = (q: number) => 1 + 2.70158 * (q - 1) ** 3 + 1.70158 * (q - 1) ** 2;

// Enter during [0, a), hold, exit during [b, 1).
function phases(p: number, a: number, b: number): { stage: "in" | "hold" | "out"; q: number } {
  if (p < a) return { stage: "in", q: p / a };
  if (p < b) return { stage: "hold", q: 1 };
  return { stage: "out", q: (p - b) / (1 - b) };
}

export interface AnimDef {
  label: string;
  group: "Motion" | "Attention" | "Reveal" | "Path" | "Effects";
  only?: ElType[]; // element types it applies to (all when omitted)
  fn: (p: number, k: number) => Partial<Pose>;
}

const STROKES: ElType[] = ["line", "polygon", "path"];
const SHAPES: ElType[] = ["box", "point", "polygon"];

export const ANIMATIONS: Record<AnimType, AnimDef> = {
  pulse: { label: "Pulse", group: "Motion", fn: (p, k) => ({ sx: 1 + 0.1 * k * wave(p), sy: 1 + 0.1 * k * wave(p), alpha: 0.55 + 0.45 * wave(p) }) },
  bounce: { label: "Bounce", group: "Motion", fn: (p, k) => ({ ty: -40 * k * Math.abs(Math.sin(Math.PI * p)) }) },
  shake: { label: "Shake", group: "Motion", fn: (p, k) => ({ tx: 13 * k * Math.sin(TAU * 3 * p) }) },
  spin: { label: "Spin", group: "Motion", fn: (p) => ({ rot: TAU * p }) },
  zoom: { label: "Zoom", group: "Motion", fn: (p, k) => { const s = 1 + k * (-0.1 + 0.3 * wave(p)); return { sx: s, sy: s }; } },
  float: { label: "Float", group: "Motion", fn: (p, k) => ({ tx: 13 * k * Math.sin(TAU * p), ty: -20 * k * wave(p) }) },
  heartbeat: { label: "Heartbeat", group: "Motion", fn: (p, k) => { const s = 1 + 0.18 * k * (bump(p, 0.2, 0.06) + 0.7 * bump(p, 0.42, 0.06)); return { sx: s, sy: s }; } },
  wobble: { label: "Wobble", group: "Motion", fn: (p, k) => ({ rot: 0.12 * k * Math.sin(TAU * p), tx: 20 * k * Math.sin(TAU * p) }) },
  swing: { label: "Swing", group: "Motion", fn: (p, k) => ({ rot: 0.26 * k * Math.sin(TAU * p) }) },
  jelly: { label: "Jelly", group: "Motion", fn: (p, k) => ({ sx: 1 + 0.12 * k * Math.sin(TAU * 2 * p), sy: 1 - 0.12 * k * Math.sin(TAU * 2 * p) }) },

  fade: { label: "Fade", group: "Attention", fn: (p) => ({ alpha: 0.1 + 0.8 * wave(p) }) },
  flash: { label: "Flash", group: "Attention", fn: (p) => ({ alpha: 0.1 + 0.7 * (0.5 + 0.5 * Math.cos(TAU * 2 * p)) }) },
  blink: { label: "Blink", group: "Attention", fn: (p) => ({ alpha: p < 0.5 ? 1 : 0 }) },
  glow: { label: "Glow", group: "Attention", fn: (p, k) => ({ glow: k * wave(p) }) },
  ripple: {
    label: "Ripple", group: "Attention", only: SHAPES,
    fn: (p, k) => ({ rings: [0, 1, 2].map((i) => { const q = (p + i / 3) % 1; return { scale: 1 + 0.6 * k * q, alpha: 1 - q }; }) }),
  },
  spotlight: { label: "Spotlight", group: "Attention", only: SHAPES, fn: (p, k) => ({ dim: clamp01(k * (0.35 + 0.3 * wave(p))) }) },

  draw: {
    label: "Draw", group: "Reveal",
    fn: (p) => {
      const { stage, q } = phases(p, 0.55, 0.85);
      if (stage === "in") { const t = easeInOut(q); return { trace: t, fill: t }; }
      if (stage === "hold") return {};
      return { alpha: 1 - q };
    },
  },
  pop: {
    label: "Pop", group: "Reveal",
    fn: (p, k) => {
      const { stage, q } = phases(p, 0.25, 0.8);
      if (stage === "in") { const s = Math.max(0, 1 + k * (easeOutBack(q) - 1) + (1 - k) * (easeOutCubic(q) - 1)); return { sx: s, sy: s, alpha: clamp01(q * 3) }; }
      if (stage === "hold") return {};
      const s = 1 - q ** 3;
      return { sx: s, sy: s, alpha: 1 - q };
    },
  },
  slide: {
    label: "Slide", group: "Reveal",
    fn: (p, k) => {
      const { stage, q } = phases(p, 0.25, 0.8);
      if (stage === "in") return { tx: -150 * k * (1 - easeOutCubic(q)), alpha: clamp01(q * 2) };
      if (stage === "hold") return {};
      return { tx: 150 * k * q ** 3, alpha: 1 - q };
    },
  },

  train: { label: "Train", group: "Path", only: STROKES, fn: (p) => ({ train: p }) },
  trainLoop: { label: "Train ↔", group: "Path", only: STROKES, fn: (p) => ({ train: p < 0.5 ? p * 2 : 2 - p * 2 }) },
  ants: { label: "Marching", group: "Path", fn: (p) => ({ dash: p }) },

  sweep: { label: "Shine", group: "Effects", only: SHAPES, fn: (p, k) => ({ sweep: p, sweepAlpha: clamp01(0.6 * k) }) },
  rainbow: { label: "Rainbow", group: "Effects", fn: (p) => ({ hue: 360 * p }) },
};

export const animationsFor = (type: ElType): AnimType[] =>
  (Object.keys(ANIMATIONS) as AnimType[]).filter((key) => !ANIMATIONS[key].only || ANIMATIONS[key].only!.includes(type));

/** Pose of an element at time `t` seconds. `delay` is a phase offset, so loops stay seamless. */
export function poseAt(anim: Anim, t: number): Pose {
  if (!anim.enabled) return { ...IDENTITY };
  const def = ANIMATIONS[anim.type];
  if (!def) return { ...IDENTITY };
  const duration = Math.max(0.05, anim.duration || 1);
  let p = ((t - (anim.delay || 0)) / duration) % 1;
  if (p < 0) p += 1;
  return { ...IDENTITY, ...def.fn(p, anim.intensity ?? 1) };
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * Shortest length after which every duration has completed whole cycles.
 * Falls back to the longest duration when the exact answer exceeds `cap`.
 */
export function loopLength(durations: number[], cap = 30): { seconds: number; seamless: boolean } {
  const tenths = durations.map((d) => Math.max(1, Math.round(d * 10)));
  if (!tenths.length) return { seconds: 0, seamless: true };
  const lcm = tenths.reduce((a, b) => (a * b) / gcd(a, b));
  if (lcm / 10 <= cap) return { seconds: lcm / 10, seamless: true };
  return { seconds: Math.max(...tenths) / 10, seamless: false };
}
