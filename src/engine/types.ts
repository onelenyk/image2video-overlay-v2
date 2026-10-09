// Scene model. All geometry is in stage units: the stage is always STAGE_W
// units wide and its height follows the chosen aspect ratio, so a project
// looks the same on any screen and at any export resolution.

export const STAGE_W = 1000;

export interface Vec {
  x: number;
  y: number;
}

export type ElType = "box" | "point" | "line" | "polygon" | "image" | "path" | "code";

export type AnimType =
  | "pulse" | "bounce" | "fade" | "shake" | "flash" | "spin" | "zoom" | "float"
  | "heartbeat" | "wobble" | "swing" | "jelly"
  | "blink" | "glow" | "ripple" | "ants" | "spotlight"
  | "draw" | "pop" | "slide"
  | "train" | "trainLoop"
  | "sweep" | "rainbow";

export interface Anim {
  enabled: boolean;
  type: AnimType;
  duration: number;  // seconds per cycle
  delay: number;     // phase offset in seconds
  intensity: number; // 1 = default strength
  /** Look of the running light (Train animations). Anything left out uses the default. */
  train?: { length?: number; glow?: number; color?: string };
}

export interface Label {
  text: string;
  show: boolean;
  color: string;
  size: number;
}

/** When an element is on screen. Absent = for the whole video. */
export interface Timing {
  start: number;      // seconds on the timeline
  end: number | null; // null = until the end of the video
  fade: number;       // fade in / out length in seconds
}

interface Base {
  id: string;
  name: string;
  color: string;
  opacity: number;
  visible: boolean;
  anim: Anim;
  time?: Timing;
  /** Overlays that share a group id are selected and moved together. */
  group?: string;
}

/** Rectangle, ellipse or plain text (a box with no fill and no border). */
export interface BoxEl extends Base {
  type: "box";
  x: number; y: number; w: number; h: number; rot: number;
  shape: "rect" | "ellipse";
  radius: number;
  borderWidth: number;
  dashed: boolean;
  label: Label;
}

export interface PointEl extends Base {
  type: "point";
  x: number; y: number; // centre
  r: number;
  label: Label;
}

/** A line end can be attached to another element and then follows it. */
export interface Anchor {
  id: string;
  at: "center" | "a" | "b" | number; // number = polygon vertex index
}

export interface LineEl extends Base {
  type: "line";
  a: Vec; b: Vec;
  aRef?: Anchor; bRef?: Anchor;
  width: number;
  arrowA: boolean; arrowB: boolean;
  dashed: boolean;
}

export interface PolygonEl extends Base {
  type: "polygon";
  points: Vec[];
  closed: boolean;
  fill: boolean;
  width: number;
  dashed: boolean;
}

export interface ImageEl extends Base {
  type: "image";
  x: number; y: number; w: number; h: number; rot: number;
  asset: string; // key into Project.assets
  tint: boolean; // SVGs: recolor with `color`
}

/** Timing of a stroke sketched live: it replays exactly as it was drawn. */
export interface SketchTiming {
  start: number;       // seconds on the timeline
  times: number[];     // seconds since `start`, one per point
  hold: number | null; // seconds visible after it is finished (null = stays)
  fade: number;
}

export interface PathEl extends Base {
  type: "path";
  points: Vec[];
  width: number;
  smooth: boolean; // freehand strokes are drawn as a curve
  glow: number;
  sketch?: SketchTiming;
}

/** Drawn by the user's own code, frame by frame, in a sandbox (see codeRunner.ts). */
export interface CodeEl extends Base {
  type: "code";
  x: number; y: number; w: number; h: number; rot: number;
  /** JavaScript defining `function draw(ctx, t, w, h, p)`; `t` is seconds since the overlay appeared. */
  code: string;
  /** Values of the settings the code declares. */
  params: Record<string, number | string | boolean>;
}

export type El = BoxEl | PointEl | LineEl | PolygonEl | ImageEl | PathEl | CodeEl;

export interface Stage {
  w: number;
  h: number;
  bg: string;
  dim: number; // 0..0.9 darkening of the photo
  fit: "contain" | "cover";
  aspect: "image" | "9:16" | "4:5" | "1:1" | "16:9";
}

export interface Scene {
  stage: Stage;
  elements: El[]; // bottom to top
  duration: { mode: "auto" | "custom"; seconds: number };
  nextId: number;
  /** Names of the groups referred to by El.group. */
  groups?: Record<string, { name: string }>;
}

export interface Asset {
  format: "svg" | "png";
  data: string; // sanitised SVG markup, or a data: URL for raster images
  aspect: number;
}

export const ASPECTS: Record<Exclude<Stage["aspect"], "image">, number> = {
  "9:16": 16 / 9,
  "4:5": 5 / 4,
  "1:1": 1,
  "16:9": 9 / 16,
}; // height / width
