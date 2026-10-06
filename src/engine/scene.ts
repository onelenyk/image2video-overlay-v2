import { ANIMATIONS, loopLength } from "./animations";
import { ASPECTS, STAGE_W, type Anim, type Asset, type El, type ElType, type Label, type Scene, type SketchTiming, type Vec } from "./types";

export const defaultAnim = (): Anim => ({ enabled: false, type: "pulse", duration: 1.5, delay: 0, intensity: 1 });
const label = (text: string, size = 37): Label => ({ text, show: true, color: "#ffffff", size });

export function newScene(heightRatio: number = ASPECTS["9:16"], aspect: Scene["stage"]["aspect"] = "9:16"): Scene {
  return {
    stage: { w: STAGE_W, h: Math.round(STAGE_W * heightRatio), bg: "#2c2c2e", dim: 0, fit: "contain", aspect },
    elements: [],
    duration: { mode: "auto", seconds: 5 },
    nextId: 1,
  };
}

export type Preset = "rect" | "ellipse" | "text" | "point" | "line" | "arrow";

const PRESET_NAMES: Record<Preset | "polygon" | "image" | "path" | "sketch", string> = {
  rect: "Zone", ellipse: "Ellipse", text: "Text", point: "Point", line: "Line", arrow: "Arrow",
  polygon: "Polygon", image: "Image", path: "Drawing", sketch: "Stroke",
};

function uniqueName(scene: Scene, base: string): string {
  const names = new Set(scene.elements.map((el) => el.name));
  let n = 1;
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Common fields for a new element; the caller bumps scene.nextId. */
function base(scene: Scene, kind: keyof typeof PRESET_NAMES, color = "#ef4444") {
  return { id: `e${scene.nextId}`, name: uniqueName(scene, PRESET_NAMES[kind]), color, opacity: 1, visible: true, anim: defaultAnim() };
}

/** A ready-made element placed in the middle of the stage. */
export function makePreset(scene: Scene, kind: Preset): El {
  const { w: W, h: H } = scene.stage;
  const step = (scene.elements.length % 6) * 24;
  const at = (w: number, h: number) => ({ x: Math.round(W / 2 - w / 2 + step), y: Math.round(H / 2 - h / 2 + step) });
  switch (kind) {
    case "rect":
    case "ellipse": {
      const b = base(scene, kind);
      return { ...b, type: "box", ...at(260, 260), w: 260, h: 260, rot: 0, opacity: 0.4, shape: kind === "ellipse" ? "ellipse" : "rect", radius: 0, borderWidth: 5, dashed: false, label: label(b.name) };
    }
    case "text":
      return { ...base(scene, kind), type: "box", ...at(360, 110), w: 360, h: 110, rot: 0, opacity: 0, shape: "rect", radius: 0, borderWidth: 0, dashed: false, label: label("Text", 64) };
    case "point": {
      const b = base(scene, kind, "#3b82f6");
      return { ...b, type: "point", x: W / 2 + step, y: H / 2 + step, r: 22, label: label(b.name, 28) };
    }
    default: {
      const y = H / 2 + step;
      return { ...base(scene, kind, kind === "arrow" ? "#ef4444" : "#10b981"), type: "line", a: { x: W * 0.3, y }, b: { x: W * 0.7, y }, width: kind === "arrow" ? 10 : 8, arrowA: false, arrowB: kind === "arrow", dashed: false };
    }
  }
}

export function makePolygon(scene: Scene, points: Vec[], closed: boolean): El {
  return { ...base(scene, "polygon", "#8b5cf6"), type: "polygon", points, closed, fill: closed, width: 6, dashed: false, opacity: 0.4 };
}

export function makeImage(scene: Scene, assetKey: string, asset: Asset, color = "#ef4444"): El {
  const size = 200;
  const w = asset.aspect >= 1 ? size : Math.round(size * asset.aspect);
  const h = asset.aspect >= 1 ? Math.round(size / asset.aspect) : size;
  const step = (scene.elements.length % 6) * 24;
  return { ...base(scene, "image", color), type: "image", x: scene.stage.w / 2 - w / 2 + step, y: scene.stage.h / 2 - h / 2 + step, w, h, rot: 0, asset: assetKey, tint: asset.format === "svg" };
}

export function makePath(scene: Scene, points: Vec[], o: { color: string; width: number; opacity?: number; glow?: number; smooth?: boolean; sketch?: SketchTiming }): El {
  return { ...base(scene, o.sketch ? "sketch" : "path", o.color), type: "path", points, width: o.width, smooth: o.smooth ?? true, glow: o.glow ?? 0, opacity: o.opacity ?? 1, sketch: o.sketch };
}

// ---------- timing ----------
const STORY_TAIL = 1; // seconds kept after the last stroke

/** Length of the live-sketch story (0 when nothing was sketched). */
export function storyLength(scene: Scene): number {
  let end = 0;
  for (const el of scene.elements) {
    if (el.type !== "path" || !el.sketch || !el.visible) continue;
    const s = el.sketch;
    end = Math.max(end, s.start + (s.times[s.times.length - 1] ?? 0) + (s.hold === null ? 0 : s.hold + s.fade));
  }
  // Elements bound to a moment on the timeline extend the story as well
  for (const el of scene.elements) {
    if (el.visible && el.time) end = Math.max(end, el.time.end ?? el.time.start + 0.5);
  }
  return end;
}

export interface VideoLength {
  seconds: number;
  kind: "custom" | "story" | "loop" | "still";
  seamless: boolean;
}

/** How long the video is and why. */
export function videoLength(scene: Scene, narrationSeconds = 0): VideoLength {
  if (scene.duration.mode === "custom") return { seconds: Math.max(0.5, scene.duration.seconds), kind: "custom", seamless: false };
  const story = storyLength(scene);
  if (story > 0 || narrationSeconds > 0) {
    // Rounded up, so the last moments of a stroke or of the narration are never cut
    return { seconds: Math.ceil(Math.max(story + (story > 0 ? STORY_TAIL : 0), narrationSeconds) * 10 - 1e-6) / 10, kind: "story", seamless: false };
  }
  const durations = scene.elements.filter((el) => el.visible && el.anim.enabled).map((el) => el.anim.duration);
  const loop = loopLength(durations);
  if (loop.seconds > 0) return { seconds: loop.seconds, kind: "loop", seamless: loop.seamless };
  return { seconds: 3, kind: "still", seamless: true };
}

// ---------- loading ----------
const TYPES: ElType[] = ["box", "point", "line", "polygon", "image", "path"];
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec = (v: unknown): v is Vec => !!v && isNum((v as Vec).x) && isNum((v as Vec).y);
const isLabel = (v: unknown) => !!v && typeof (v as { text: unknown }).text === "string" && isNum((v as { size: unknown }).size);

/** Does a stored element have every field the renderer reads for its type? */
function wellFormed(el: El): boolean {
  switch (el.type) {
    case "box": return [el.x, el.y, el.w, el.h, el.rot].every(isNum) && isLabel(el.label);
    case "image": return [el.x, el.y, el.w, el.h, el.rot].every(isNum) && typeof el.asset === "string";
    case "point": return [el.x, el.y, el.r].every(isNum) && isLabel(el.label);
    case "line": return isVec(el.a) && isVec(el.b) && isNum(el.width);
    case "polygon": return Array.isArray(el.points) && el.points.every(isVec) && isNum(el.width);
    case "path": return Array.isArray(el.points) && el.points.every(isVec) && isNum(el.width) && (!el.sketch || (Array.isArray(el.sketch.times) && isNum(el.sketch.start)));
    default: return false;
  }
}

/** Rebuilds a scene from stored data, dropping anything malformed. */
export function normalizeScene(raw: unknown): Scene | null {
  const data = raw as Partial<Scene> | null;
  if (!data || typeof data !== "object" || !Array.isArray(data.elements) || !data.stage) return null;
  const fresh = newScene();
  const stage = { ...fresh.stage, ...data.stage, w: STAGE_W, h: Math.min(5000, Math.max(200, num(data.stage.h, fresh.stage.h))) };
  const ids = new Set<string>();
  const elements: El[] = [];
  for (const el of data.elements) {
    if (!el || !TYPES.includes(el.type) || typeof el.id !== "string" || ids.has(el.id) || !wellFormed(el)) continue;
    ids.add(el.id);
    const anim = { ...defaultAnim(), ...(el.anim || {}) };
    if (!Object.hasOwn(ANIMATIONS, anim.type)) anim.type = "pulse"; // own keys only: "constructor" is not an animation
    if (anim.train) {
      const t = anim.train;
      anim.train = {
        length: Math.min(0.6, Math.max(0.04, num(t.length, 0.18))),
        glow: Math.min(3, Math.max(0, num(t.glow, 1))),
        color: typeof t.color === "string" && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : undefined,
      };
    }
    elements.push({ ...el, anim, visible: el.visible !== false, opacity: Math.min(1, Math.max(0, num(el.opacity, 1))) });
  }
  const maxId = Math.max(0, ...elements.map((el) => parseInt(el.id.slice(1), 10) || 0));
  return {
    stage,
    elements,
    duration: { mode: data.duration?.mode === "custom" ? "custom" : "auto", seconds: num(data.duration?.seconds, 5) },
    nextId: Math.max(num(data.nextId, 1), maxId + 1),
    groups: Object.fromEntries(
      [...new Set(elements.map((el) => el.group).filter((g): g is string => typeof g === "string"))]
        .map((id) => [id, { name: String(data.groups?.[id]?.name ?? "Group").slice(0, 40) }])
    ),
  };
}
