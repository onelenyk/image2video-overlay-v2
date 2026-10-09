import { codeBitmap } from "./codeFrames";
import { IDENTITY, poseAt, type Pose } from "./animations";
import { DEG, boundsOf, existsAt, lineEnds, presenceAt, revealByFraction, revealByTimes, sliceByFraction } from "./geometry";
import type { Anim, Asset, BoxEl, El, ImageEl, Label, PointEl, Scene, Vec } from "./types";

// The one and only renderer: the editor canvas, timeline tiles, PNG and video
// export all call drawScene(), so the export always matches what is on screen.

const TAU = Math.PI * 2;
const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export interface RenderEnv {
  width: number;
  height: number;
  image?: CanvasImageSource | null; // plan photo (may be a pre-scaled canvas)
  assets: Record<string, Asset>;
  /** Timeline time in seconds; null = "show everything" view (no animation, all strokes complete). */
  time: number | null;
  /** true = the frames of code overlays were prepared for exactly this moment (export); do not ask for others. */
  exact?: boolean;
  /**
   * false = a still frame for editing: elements and strokes appear according to
   * `time`, but looping animations are frozen so handles sit on the element.
   */
  animate?: boolean;
}

// ---------- colour ----------
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [239, 68, 68];
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0")).join("");
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, a))})`;
}
function rotateHue(hex: string, deg: number): string {
  let [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  if (s < 0.15) s = 0.75; // greys have no hue to rotate
  h = (h + deg) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

// ---------- assets ----------
/** Sanitised SVG markup with explicit dimensions, or null if `content` is not an SVG. */
export function prepareSvg(content: string): { markup: string; aspect: number } | null {
  const doc = new DOMParser().parseFromString(content.trim(), "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return null;
  doc.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((n) => {
    [...n.attributes].forEach((a) => {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
    });
  });
  let vw: number, vh: number;
  const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) [, , vw, vh] = vb;
  else {
    vw = parseFloat(svg.getAttribute("width") || "") || 24;
    vh = parseFloat(svg.getAttribute("height") || "") || 24;
    svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
  }
  // Explicit, generous pixel size so every browser rasterises it crisply.
  const k = 1024 / Math.max(vw, vh);
  svg.setAttribute("width", String(Math.round(vw * k)));
  svg.setAttribute("height", String(Math.round(vh * k)));
  svg.removeAttribute("class");
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return { markup: new XMLSerializer().serializeToString(svg), aspect: vw / vh };
}

interface Loaded { img: HTMLImageElement; loaded: boolean; ready: Promise<void> }
const imageCache = new Map<string, Loaded>();

function assetImage(asset: Asset): Loaded {
  let entry = imageCache.get(asset.data);
  if (!entry) {
    const img = new Image();
    const created: Loaded = { img, loaded: false, ready: Promise.resolve() };
    created.ready = new Promise<void>((resolve) => {
      img.onload = () => { created.loaded = true; resolve(); };
      img.onerror = () => resolve();
    });
    img.src = asset.format === "svg" ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(asset.data) : asset.data;
    imageCache.set(asset.data, created);
    entry = created;
  }
  return entry;
}

/** Resolves once every asset is decoded (needed before exporting). */
export const preloadAssets = (assets: Record<string, Asset>) => Promise.all(Object.values(assets).map((a) => assetImage(a).ready));

/** Where the photo lands in the frame: 'contain' letterboxes, 'cover' crops. */
export function fitRect(iw: number, ih: number, width: number, height: number, fit: "contain" | "cover") {
  const k = fit === "cover" ? Math.max(width / iw, height / ih) : Math.min(width / iw, height / ih);
  return { x: (width - iw * k) / 2, y: (height - ih * k) / 2, w: iw * k, h: ih * k };
}

const sourceSize = (image: CanvasImageSource) => {
  const i = image as HTMLImageElement & HTMLCanvasElement;
  return { w: i.naturalWidth || i.width, h: i.naturalHeight || i.height };
};

/** Pre-scale the photo once so per-frame drawing is a cheap blit. */
export function prescale(image: CanvasImageSource, width: number, height: number, fit: "contain" | "cover"): HTMLCanvasElement {
  const { w, h } = sourceSize(image);
  const r = fitRect(w, h, width, height, fit);
  const k = Math.min(1, 8192 / Math.max(r.w, r.h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(r.w * k));
  c.height = Math.max(1, Math.round(r.h * k));
  const cx = c.getContext("2d")!;
  cx.imageSmoothingQuality = "high";
  cx.drawImage(image, 0, 0, c.width, c.height);
  return c;
}

// ---------- paths ----------
function tracePolyline(ctx: CanvasRenderingContext2D | Path2D, pts: Vec[], closed: boolean, smooth: boolean) {
  if (!pts.length) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  if (smooth && pts.length > 2) {
    // Catmull-Rom spline through the points
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
    }
  } else {
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }
  if (closed) ctx.closePath();
}

function roundRect(path: Path2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  path.moveTo(x + r, y);
  path.arcTo(x + w, y, x + w, y + h, r);
  path.arcTo(x + w, y + h, x, y + h, r);
  path.arcTo(x, y + h, x, y, r);
  path.arcTo(x, y, x + w, y, r);
  path.closePath();
}

function boxPerimeter(el: BoxEl): number {
  if (el.shape === "ellipse") {
    const a = el.w / 2, b = el.h / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  }
  const r = Math.max(0, Math.min(el.radius, el.w / 2, el.h / 2));
  return 2 * (el.w + el.h) - 8 * r + TAU * r;
}

// A soft diagonal highlight band travelling left to right.
function paintSweep(ctx: CanvasRenderingContext2D, x0: number, w: number, h: number, p: number, alpha: number) {
  const band = Math.max(w * 0.35, 30);
  const x = x0 - band + (w + band * 2) * p;
  const g = ctx.createLinearGradient(x - band / 2, 0, x + band / 2, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.save();
  ctx.transform(1, 0, -0.35, 1, 0, 0);
  ctx.fillRect(x - band / 2 - h, -h * 2, band + h * 2, h * 4);
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, label: Label, y = 0, shadow = false) {
  if (!label.show || !label.text) return;
  const lines = label.text.split("\n");
  ctx.font = `700 ${label.size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = label.color;
  // shadowBlur is in device pixels, so scale it like everything else
  if (shadow) { ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = label.size * 0.25 * Math.abs(ctx.getTransform().a); }
  lines.forEach((line, i) => ctx.fillText(line, 0, y + (i - (lines.length - 1) / 2) * label.size * 1.2));
  ctx.shadowBlur = 0;
}

let scratch: HTMLCanvasElement | null = null;

function drawImageEl(ctx: CanvasRenderingContext2D, el: ImageEl, color: string, pose: Pose, s: number, env: RenderEnv) {
  const asset = env.assets[el.asset];
  if (!asset) return;
  const entry = assetImage(asset);
  if (!entry.loaded) return;
  ctx.globalAlpha = pose.alpha * el.opacity;
  ctx.imageSmoothingQuality = "high";
  if (asset.format !== "svg" || !el.tint) {
    ctx.drawImage(entry.img, -el.w / 2, -el.h / 2, el.w, el.h);
    return;
  }
  // Rasterise at output resolution and tint through the alpha channel.
  const pw = Math.max(1, Math.min(2048, Math.ceil(el.w * s * Math.abs(pose.sx))));
  const ph = Math.max(1, Math.min(2048, Math.ceil(el.h * s * Math.abs(pose.sy))));
  scratch ??= document.createElement("canvas");
  if (scratch.width !== pw || scratch.height !== ph) { scratch.width = pw; scratch.height = ph; }
  const sc = scratch.getContext("2d")!;
  sc.globalCompositeOperation = "source-over";
  sc.clearRect(0, 0, pw, ph);
  sc.drawImage(entry.img, 0, 0, pw, ph);
  sc.globalCompositeOperation = "source-in";
  sc.fillStyle = color;
  sc.fillRect(0, 0, pw, ph);
  ctx.drawImage(scratch, -el.w / 2, -el.h / 2, el.w, el.h);
}

// Line, polygon outline and freehand path share one stroke routine.
function drawStroke(
  ctx: CanvasRenderingContext2D, pts: Vec[], o: { closed: boolean; smooth: boolean; width: number; dashed: boolean; color: string; alpha: number },
  pose: Pose, intensity: number, train?: Anim["train"]
) {
  if (pts.length < 2 || o.width <= 0) return;
  const loop = o.closed ? [...pts, pts[0]] : pts;
  const shown = pose.trace != null ? revealByFraction(loop, pose.trace) : loop;
  const wholeLoop = o.closed && pose.trace == null;
  ctx.lineCap = o.dashed ? "butt" : "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = o.width;
  ctx.strokeStyle = o.color;

  if (shown.length >= 2) {
    ctx.globalAlpha = pose.alpha * o.alpha * (pose.train != null ? 0.3 : 1);
    if (o.dashed) ctx.setLineDash([o.width * 3, o.width * 2]);
    ctx.beginPath();
    tracePolyline(ctx, wholeLoop ? pts : shown, wholeLoop, o.smooth);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.shadowBlur = 0;

  if (pose.dash != null) {
    // Marching dashes: whole cycles per loop keep it seamless
    ctx.globalAlpha = pose.alpha * 0.85;
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "butt";
    const unit = Math.max(10, o.width * 3);
    ctx.setLineDash([unit, unit]);
    ctx.lineDashOffset = -pose.dash * unit * 2 * 3;
    ctx.beginPath();
    tracePolyline(ctx, pts, o.closed, o.smooth);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  if (pose.train != null) {
    // The light enters from before the start and leaves past the end, so it is never cut at the seam
    const half = (train?.length ?? 0.18) / 2;
    const light = train?.color ?? o.color;
    const at = -half + pose.train * (1 + half * 2);
    const seg = sliceByFraction(loop, Math.max(0, at - half), Math.min(1, at + half));
    if (seg.length >= 2) {
      ctx.lineCap = "round";
      ctx.globalAlpha = pose.alpha;
      ctx.shadowColor = light;
      ctx.shadowBlur = 0; // set per pass below (device px, ignores the transform)
      const pass = (color: string, width: number, alpha: number, blur: number) => {
        ctx.globalAlpha = pose.alpha * alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.shadowBlur = blur;
        ctx.beginPath();
        tracePolyline(ctx, seg, false, false);
        ctx.stroke();
      };
      const blur = 14 * intensity * (train?.glow ?? 1) * ctx.getTransform().a;
      pass(light, o.width * 1.8, 0.9, blur);
      pass("#ffffff", o.width, 0.95, blur / 2);
      pass(light, Math.max(1, o.width * 0.5), 1, 0);
      ctx.shadowBlur = 0;
    }
  }
}

function arrowHead(ctx: CanvasRenderingContext2D, tip: Vec, from: Vec, width: number) {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(width * 1.2, 0);
  ctx.lineTo(-width * 3.2, -width * 2.2);
  ctx.lineTo(-width * 3.2, width * 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawElement(ctx: CanvasRenderingContext2D, el: El, scene: Scene, s: number, env: RenderEnv) {
  let pose = IDENTITY;
  if (env.time !== null) {
    // A still frame for editing shows the element fully from its first frame, so
    // something just added "here" is visible; playback and export apply the fade.
    const presence = env.animate === false ? (existsAt(el, env.time) ? 1 : 0) : presenceAt(el, env.time);
    if (presence <= 0) return;
    // An element's animation starts when the element appears
    if (env.animate !== false) pose = poseAt(el.anim, env.time - (el.time?.start ?? 0));
    if (presence < 1) pose = { ...pose, alpha: pose.alpha * presence };
  }
  if (pose.alpha <= 0 || !pose.sx || !pose.sy) return;

  // Sketched strokes follow the timeline: only the part drawn so far is shown.
  let sketchAlpha = 1;
  let pathPoints: Vec[] | null = null;
  if (el.type === "path") {
    pathPoints = el.points;
    if (el.sketch && env.time !== null) {
      const elapsed = env.time - el.sketch.start;
      pathPoints = revealByTimes(el.points, el.sketch.times, elapsed);
      if (pathPoints.length < 2) return;
      if (el.sketch.hold !== null) {
        const over = elapsed - (el.sketch.times[el.sketch.times.length - 1] ?? 0) - el.sketch.hold;
        if (over > 0) {
          if (el.sketch.fade <= 0 || over >= el.sketch.fade) return;
          sketchAlpha = 1 - over / el.sketch.fade;
        }
      }
    }
  }

  const b = boundsOf(el, scene);
  const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const local = (p: Vec): Vec => ({ x: p.x - c.x, y: p.y - c.y });
  const color = pose.hue ? rotateHue(el.color, pose.hue) : el.color;
  const k = el.anim.intensity ?? 1;

  ctx.save();
  ctx.translate((c.x + pose.tx) * s, (c.y + pose.ty) * s);
  ctx.rotate(b.rot * DEG + pose.rot);
  ctx.scale(s * pose.sx, s * pose.sy);
  // From here on, coordinates are stage units relative to the element centre.

  // Closed outline, used by ripple / spotlight / shine
  const outline = new Path2D();
  if (el.type === "box") {
    if (el.shape === "ellipse") outline.ellipse(0, 0, el.w / 2, el.h / 2, 0, 0, TAU);
    else roundRect(outline, -el.w / 2, -el.h / 2, el.w, el.h, el.radius);
  } else if (el.type === "point") outline.arc(0, 0, el.r, 0, TAU);
  else if (el.type === "polygon") tracePolyline(outline, el.points.map(local), el.closed, false);
  else roundRect(outline, -b.w / 2, -b.h / 2, b.w, b.h, Math.min(b.w, b.h) * 0.08);

  if (pose.dim) {
    const hole = new Path2D();
    hole.rect(-1e5, -1e5, 2e5, 2e5);
    hole.addPath(outline);
    ctx.save();
    ctx.globalAlpha = pose.dim * pose.alpha; // the spotlight fades in and out with its element
    ctx.fillStyle = "#000";
    ctx.fill(hole, "evenodd");
    ctx.restore();
  }
  if (pose.rings) {
    ctx.strokeStyle = color;
    for (const ring of pose.rings) {
      ctx.save();
      ctx.scale(ring.scale, ring.scale);
      ctx.globalAlpha = pose.alpha * ring.alpha;
      ctx.lineWidth = 5 / ring.scale;
      ctx.stroke(outline);
      ctx.restore();
    }
  }

  ctx.globalAlpha = pose.alpha;
  const glow = Math.max(pose.glow ?? 0, el.type === "path" ? el.glow / 20 : 0);
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow * 70 * s; // shadowBlur ignores the transform
  }

  if (el.type === "box") {
    if (pose.glow) {
      ctx.save();
      ctx.globalAlpha = pose.alpha * Math.min(1, pose.glow);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(el.borderWidth, 4);
      ctx.stroke(outline);
      ctx.restore();
    }
    ctx.fillStyle = rgba(color, el.opacity * pose.fill);
    ctx.fill(outline);
    ctx.shadowBlur = 0;
    const effect = pose.dash != null || pose.trace != null;
    const lw = el.borderWidth > 0 ? el.borderWidth : effect ? 5 : 0;
    if (lw > 0 && pose.trace !== 0) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      if (pose.dash != null) { ctx.setLineDash([28, 18]); ctx.lineDashOffset = -pose.dash * 46 * 3; }
      else if (pose.trace != null) { const len = boxPerimeter(el); ctx.setLineDash([len * pose.trace, len]); }
      else if (el.dashed) ctx.setLineDash([lw * 3, lw * 2]);
      ctx.stroke(outline);
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
    if (pose.sweep != null) {
      ctx.save();
      ctx.clip(outline);
      paintSweep(ctx, -el.w / 2, el.w, el.h, pose.sweep, pose.sweepAlpha ?? 0.5);
      ctx.restore();
    }
    ctx.globalAlpha = pose.alpha * pose.fill;
    drawLabel(ctx, el.label);
  } else if (el.type === "point") {
    drawPoint(ctx, el, color, pose, outline);
  } else if (el.type === "image") {
    if (pose.trace != null) { ctx.beginPath(); ctx.rect(-el.w / 2, -el.h / 2, el.w * pose.trace, el.h); ctx.clip(); }
    drawImageEl(ctx, el, color, pose, s, env);
    ctx.shadowBlur = 0;
    if (pose.dash != null) {
      ctx.globalAlpha = pose.alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 14]);
      ctx.lineDashOffset = -pose.dash * 34 * 3;
      ctx.stroke(outline);
      ctx.setLineDash([]);
    }
  } else if (el.type === "code") {
    // Drawn by the overlay's own code, in the sandbox; here only its latest picture is placed
    const bitmap = codeBitmap(el, env.time, s, !!env.exact);
    ctx.globalAlpha = pose.alpha * el.opacity;
    if (pose.trace != null) { ctx.beginPath(); ctx.rect(-el.w / 2, -el.h / 2, el.w * pose.trace, el.h); ctx.clip(); }
    if (bitmap) {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, -el.w / 2, -el.h / 2, el.w, el.h);
    } else if (!env.exact) {
      // Nothing to show yet (still loading, or the code has an error): mark where it is
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.stroke(outline);
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.min(el.h * 0.4, el.w * 0.25, 64)}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("</>", 0, 0);
    }
    ctx.shadowBlur = 0;
  } else if (el.type === "line") {
    const ends = lineEnds(el, scene);
    const a = local(ends.a), bEnd = local(ends.b);
    const shown = pose.trace != null ? revealByFraction([a, bEnd], pose.trace) : [a, bEnd];
    drawStroke(ctx, [a, bEnd], { closed: false, smooth: false, width: el.width, dashed: el.dashed, color, alpha: el.opacity }, pose, k, el.anim.train);
    if (shown.length >= 2) {
      ctx.globalAlpha = pose.alpha * el.opacity * (pose.train != null ? 0.3 : 1); // dimmed with the line under a train
      ctx.fillStyle = color;
      if (el.arrowB) arrowHead(ctx, shown[1], shown[0], el.width);
      if (el.arrowA) arrowHead(ctx, shown[0], shown[1], el.width);
    }
  } else if (el.type === "polygon") {
    const pts = el.points.map(local);
    if (el.closed && el.fill && pts.length >= 3) {
      ctx.fillStyle = rgba(color, el.opacity * pose.fill);
      ctx.fill(outline);
      ctx.shadowBlur = 0;
    }
    if (pose.sweep != null && el.closed) {
      ctx.save();
      ctx.clip(outline);
      paintSweep(ctx, -b.w / 2, b.w, b.h, pose.sweep, pose.sweepAlpha ?? 0.5);
      ctx.restore();
    }
    drawStroke(ctx, pts, { closed: el.closed && pts.length >= 3, smooth: false, width: el.width, dashed: el.dashed, color, alpha: 1 }, pose, k, el.anim.train);
  } else if (pathPoints) {
    drawStroke(ctx, pathPoints.map(local), { closed: false, smooth: el.smooth, width: el.width, dashed: false, color, alpha: el.opacity * sketchAlpha }, pose, k, el.anim.train);
  }
  ctx.restore();
}

function drawPoint(ctx: CanvasRenderingContext2D, el: PointEl, color: string, pose: Pose, outline: Path2D) {
  ctx.fillStyle = rgba(color, el.opacity * pose.fill);
  ctx.fill(outline);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, el.r * 0.22);
  ctx.stroke(outline);
  if (pose.sweep != null) {
    ctx.save();
    ctx.clip(outline);
    paintSweep(ctx, -el.r, el.r * 2, el.r * 2, pose.sweep, pose.sweepAlpha ?? 0.5);
    ctx.restore();
  }
  drawLabel(ctx, el.label, el.r + el.label.size * 0.85, true);
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, env: RenderEnv) {
  const { width, height } = env;
  const s = width / scene.stage.w;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.setLineDash([]);
  ctx.fillStyle = scene.stage.bg;
  ctx.fillRect(0, 0, width, height);
  if (env.image) {
    const { w, h } = sourceSize(env.image);
    const r = fitRect(w, h, width, height, scene.stage.fit);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(env.image, r.x, r.y, r.w, r.h);
  }
  if (scene.stage.dim > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${scene.stage.dim})`;
    ctx.fillRect(0, 0, width, height);
  }
  for (const el of scene.elements) {
    if (el.visible) drawElement(ctx, el, scene, s, env);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
}
