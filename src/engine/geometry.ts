import type { Anchor, El, LineEl, Scene, Vec } from "./types";

export const DEG = Math.PI / 180;

export interface Box {
  x: number; y: number; w: number; h: number; rot: number;
}

/** 0..1 visibility of an element at timeline time `t` (fades at both ends of its time range). */
export function presenceAt(el: El, t: number): number {
  const range = el.time;
  if (!range) return 1;
  if (t < range.start || (range.end !== null && t > range.end)) return 0;
  if (range.fade <= 0) return 1;
  const fadeIn = (t - range.start) / range.fade;
  const fadeOut = range.end === null ? 1 : (range.end - t) / range.fade;
  return Math.max(0, Math.min(1, fadeIn, fadeOut));
}

/**
 * Is the element part of the picture at time `t` at all? Unlike presenceAt this
 * ignores fades (an element exists from its very first frame) and also knows
 * about sketched strokes, which carry their own timing.
 */
export function existsAt(el: El, t: number): boolean {
  if (el.type === "path" && el.sketch) {
    const s = el.sketch, elapsed = t - s.start;
    if (elapsed < 0) return false;
    return s.hold === null || elapsed <= (s.times[s.times.length - 1] ?? 0) + s.hold + s.fade;
  }
  return !el.time || (t >= el.time.start && (el.time.end === null || t <= el.time.end));
}

/** Position an anchor points at, or null when its target is gone. */
function resolveAnchor(ref: Anchor, scene: Scene, seen: Set<string>): Vec | null {
  const target = scene.elements.find((el) => el.id === ref.id);
  if (!target || seen.has(target.id)) return null; // missing, or lines attached in a loop
  switch (target.type) {
    case "point":
      return { x: target.x, y: target.y };
    case "line": {
      const ends = lineEnds(target, scene, new Set(seen).add(target.id));
      return ref.at === "b" ? ends.b : ends.a;
    }
    case "polygon":
      return typeof ref.at === "number" ? target.points[ref.at] ?? null : null;
    case "box":
    case "image":
    case "code":
      return { x: target.x + target.w / 2, y: target.y + target.h / 2 };
    default:
      return null;
  }
}

/** Actual end points of a line, following attachments. */
export function lineEnds(line: LineEl, scene: Scene, seen: Set<string> = new Set([line.id])): { a: Vec; b: Vec } {
  return {
    a: (line.aRef && resolveAnchor(line.aRef, scene, seen)) || line.a,
    b: (line.bRef && resolveAnchor(line.bRef, scene, seen)) || line.b,
  };
}

/** Points of stroke-like elements (line, polygon, path). */
export function strokePoints(el: El, scene: Scene): Vec[] {
  if (el.type === "line") { const { a, b } = lineEnds(el, scene); return [a, b]; }
  if (el.type === "polygon" || el.type === "path") return el.points;
  return [];
}

/** Unrotated bounding box plus rotation. */
export function boundsOf(el: El, scene: Scene): Box {
  if (el.type === "box" || el.type === "image" || el.type === "code") return { x: el.x, y: el.y, w: el.w, h: el.h, rot: el.rot };
  if (el.type === "point") return { x: el.x - el.r, y: el.y - el.r, w: el.r * 2, h: el.r * 2, rot: 0 };
  const pts = strokePoints(el, scene);
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0, rot: 0 };
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, rot: 0 };
}

export function centerOf(el: El, scene: Scene): Vec {
  const b = boundsOf(el, scene);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Point `p` in the unrotated, centred frame of a box. */
export function toLocal(box: Box, p: Vec): Vec {
  const a = -box.rot * DEG, dx = p.x - (box.x + box.w / 2), dy = p.y - (box.y + box.h / 2);
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function insidePolygon(p: Vec, pts: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Is stage point `p` on the element? `tol` widens thin targets (fingers). */
export function hitTest(el: El, scene: Scene, p: Vec, tol: number): boolean {
  if (el.type === "box" || el.type === "image" || el.type === "code") {
    const l = toLocal(el, p), pad = Math.max(0, tol - Math.min(el.w, el.h) / 2);
    return Math.abs(l.x) <= el.w / 2 + pad && Math.abs(l.y) <= el.h / 2 + pad;
  }
  if (el.type === "point") return Math.hypot(p.x - el.x, p.y - el.y) <= el.r + tol;
  const pts = strokePoints(el, scene);
  if (el.type === "polygon" && el.closed && el.fill && pts.length >= 3 && insidePolygon(p, pts)) return true;
  const reach = el.width / 2 + tol;
  for (let i = 0; i < pts.length - 1; i++) if (distToSegment(p, pts[i], pts[i + 1]) <= reach) return true;
  if (el.type === "polygon" && el.closed && pts.length >= 3) return distToSegment(p, pts[pts.length - 1], pts[0]) <= reach;
  return false;
}

/** Copy of the element moved by (dx, dy). Attached line ends stay attached. */
export function moved<T extends El>(el: T, dx: number, dy: number): T {
  const shift = (p: Vec): Vec => ({ x: p.x + dx, y: p.y + dy });
  switch (el.type) {
    case "line":
      return { ...el, a: el.aRef ? el.a : shift(el.a), b: el.bRef ? el.b : shift(el.b) };
    case "polygon":
    case "path":
      return { ...el, points: el.points.map(shift) };
    default:
      return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

/** First `fraction` of a polyline by length; the last point is interpolated. */
export function revealByFraction(points: Vec[], fraction: number): Vec[] {
  if (points.length < 2 || fraction >= 1) return points;
  if (fraction <= 0) return [];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return points;
  const target = total * fraction;
  const out: Vec[] = [points[0]];
  let done = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (done + lengths[i] >= target) {
      const t = lengths[i] === 0 ? 0 : (target - done) / lengths[i];
      out.push({ x: points[i].x + (points[i + 1].x - points[i].x) * t, y: points[i].y + (points[i + 1].y - points[i].y) * t });
      return out;
    }
    done += lengths[i];
    out.push(points[i + 1]);
  }
  return out;
}

/** Slice of a polyline between two fractions of its length. */
export function sliceByFraction(points: Vec[], from: number, to: number): Vec[] {
  const head = revealByFraction(points, to);
  if (from <= 0 || head.length < 2) return head;
  // Cut the start by reversing, revealing the tail part, and reversing back.
  let total = 0, upTo = 0;
  for (let i = 0; i < points.length - 1; i++) total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  for (let i = 0; i < head.length - 1; i++) upTo += Math.hypot(head[i + 1].x - head[i].x, head[i + 1].y - head[i].y);
  if (upTo === 0 || total === 0) return [];
  const keep = 1 - Math.min(1, (from * total) / upTo);
  return revealByFraction([...head].reverse(), keep).reverse();
}

/** Part of a recorded stroke drawn `elapsed` seconds after it started. */
export function revealByTimes(points: Vec[], times: number[], elapsed: number): Vec[] {
  if (elapsed < 0 || !points.length) return [];
  const last = times[Math.min(times.length, points.length) - 1] ?? 0;
  if (elapsed >= last) return points;
  const out: Vec[] = [];
  for (let i = 0; i < points.length; i++) {
    const time = times[i] ?? last;
    if (time <= elapsed) { out.push(points[i]); continue; }
    if (i > 0) {
      const prev = times[i - 1] ?? 0;
      const t = time === prev ? 1 : (elapsed - prev) / (time - prev);
      out.push({ x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t });
    }
    break;
  }
  return out;
}
