import { useEffect, useRef, useState } from "react";
import { DEG, boundsOf, existsAt, hitTest, lineEnds, moved, toLocal, type Box } from "../engine/geometry";
import { drawScene, preloadAssets, prescale } from "../engine/renderer";
import { makePolygon } from "../engine/scene";
import type { Anchor, El, LineEl, PolygonEl, Scene, Vec } from "../engine/types";
import { sketchLook, useEditor, type Mode } from "./store";
import { t, type Msg } from "../i18n";
import { GRIDS, gridLines, useHelpers } from "./helpers";

// The stage: draws the scene with the shared renderer and turns pointer input
// (mouse, pen or finger) into edits. Selection handles are painted on top and
// never reach the export.

const CORNERS: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]];
const ROTATE_OFFSET = 30; // css px above the top edge
const MIN_SIZE = 12;
const MAX_ZOOM = 16;
const RULER = 18; // css px
const LOUPE = 136, LOUPE_ZOOM = 3;
const GRID_NAMES: Record<(typeof GRIDS)[number], Msg> = { off: "Off", thirds: "Thirds", squares: "Squares", fine: "Fine" };
const MAX_PIXELS = 8_000_000; // backing store of the editing canvas, however far it is zoomed

type Drag =
  | { kind: "move"; id: string; start: Vec; origin: El; moved: boolean }
  | { kind: "group"; id: string; group: string; start: Vec; origins: El[]; moved: boolean; enter: boolean }
  | { kind: "resize"; id: string; start: Vec; origin: El & Box; hx: number; hy: number; moved: boolean }
  | { kind: "rotate"; id: string; origin: El & Box; moved: boolean }
  | { kind: "vertex"; id: string; index: number; moved: boolean; start: Vec; crowded: boolean }
  | { kind: "mid"; id: string; after: number; start: Vec; moved: boolean }
  | { kind: "end"; id: string; end: "a" | "b"; moved: boolean; snap: { anchor: Anchor; at: Vec } | null }
  | { kind: "stroke"; mode: Mode; points: Vec[]; times: number[]; start: number };

interface Guide { x?: number; y?: number }
/** A line something can snap to; quiet ones (the grid) pull without drawing a guide. */
interface SnapLine { at: number; quiet?: boolean }

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Local y of the rotate handle: above the element, or below when "above" would fall off the stage. */
function rotateHandleY(el: Box, k: number): number {
  const reach = el.h / 2 + ROTATE_OFFSET * k;
  return el.y + el.h / 2 - reach < 0 ? reach : -reach;
}

/** Things a line end can attach to. `time` limits them to what is on screen in frame view. */
function snapTargets(scene: Scene, excludeId: string, time: number | null): { anchor: Anchor; at: Vec }[] {
  const out: { anchor: Anchor; at: Vec }[] = [];
  for (const el of scene.elements) {
    if (el.id === excludeId || !el.visible || (time !== null && !existsAt(el, time))) continue;
    if (el.type === "point") out.push({ anchor: { id: el.id, at: "center" }, at: { x: el.x, y: el.y } });
    else if (el.type === "polygon") el.points.forEach((p, i) => out.push({ anchor: { id: el.id, at: i }, at: p }));
    else if (el.type === "line") {
      const ends = lineEnds(el, scene);
      out.push({ anchor: { id: el.id, at: "a" }, at: ends.a }, { anchor: { id: el.id, at: "b" }, at: ends.b });
    }
  }
  return out;
}

/** Remove a polygon vertex and keep attached lines pointing at the right vertices. */
function removeVertex(scene: Scene, polygon: PolygonEl, index: number): Scene {
  const points = polygon.points.filter((_, i) => i !== index);
  const elements = scene.elements.map((el): El => {
    if (el.id === polygon.id) return { ...polygon, points, closed: polygon.closed && points.length >= 3, fill: polygon.fill && points.length >= 3 };
    if (el.type !== "line") return el;
    const fix = (ref: Anchor | undefined, at: Vec): [Anchor | undefined, Vec] => {
      if (!ref || ref.id !== polygon.id || typeof ref.at !== "number") return [ref, at];
      if (ref.at === index) return [undefined, polygon.points[index]]; // detach, stay where the vertex was
      return [{ ...ref, at: ref.at > index ? ref.at - 1 : ref.at }, at];
    };
    const [aRef, a] = fix(el.aRef, el.a);
    const [bRef, b] = fix(el.bRef, el.b);
    return { ...el, aRef, a, bRef, b };
  });
  return { ...scene, elements };
}

export function EditorCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rulersRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  // Zoom is a way of looking at the stage while editing. It never reaches the scene or the export.
  const [zoom, setZoom] = useState(1);
  const viewRef = useRef<{ zoomBy: (factor: number) => void; reset: () => void } | null>(null);

  useEffect(() => {
    const host = hostRef.current!, canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const store = useEditor;
    let drag: Drag | null = null;
    let guides: Guide[] = [];
    const rulers = rulersRef.current!, loupe = loupeRef.current!;
    let pointer: { x: number; y: number } | null = null; // client px, while the pointer is over the stage area
    let aidsDirty = true; // rulers and magnifier follow the pointer without repainting the scene
    const unsubscribeHelpers = useHelpers.subscribe(() => { dirty = true; });
    let hoverSnap: Vec | null = null;
    let background: { key: string; canvas: HTMLCanvasElement } | null = null;
    let lastKey: unknown[] = [];
    let raf = 0;
    let dirty = true;

    // ---------- layout and view ----------
    const view = { zoom: 1, x: 0, y: 0 }; // x, y: pan in css px from the centred position
    let settleTimer = 0;
    const fitSize = () => {
      const { stage } = store.getState().scene;
      const box = host.getBoundingClientRect();
      const aspect = stage.w / stage.h;
      const cw = Math.floor(Math.min(box.width, box.height * aspect));
      return { box, cw, ch: Math.floor(cw / aspect) };
    };
    /** Position and CSS size only: cheap enough to run on every step of a pinch. */
    const place = () => {
      const { box, cw, ch } = fitSize();
      if (box.width < 10 || box.height < 10) return null;
      const w = cw * view.zoom, h = ch * view.zoom;
      // The stage can be panned only as far as it sticks out of its area
      const mx = Math.max(0, (w - box.width) / 2), my = Math.max(0, (h - box.height) / 2);
      view.x = Math.min(mx, Math.max(-mx, view.x));
      view.y = Math.min(my, Math.max(-my, view.y));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.transform = `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`;
      aidsDirty = true;
      return { w, h };
    };
    const layout = () => {
      const size = place();
      if (!size) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (size.w * size.h)));
      const pw = Math.max(1, Math.round(size.w * dpr)), ph = Math.max(1, Math.round(size.h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      dirty = true;
    };
    /** Zoom so that the stage point under (clientX, clientY) stays under it. */
    const zoomAt = (target: number, clientX: number, clientY: number) => {
      const next = Math.min(MAX_ZOOM, Math.max(1, target));
      const box = host.getBoundingClientRect();
      const dx = clientX - (box.left + box.width / 2 + view.x), dy = clientY - (box.top + box.height / 2 + view.y);
      const ratio = next / view.zoom;
      view.x += dx - dx * ratio;
      view.y += dy - dy * ratio;
      view.zoom = next;
      if (next === 1) view.x = view.y = 0;
      place();
      setZoom(next);
      // Sharpen once the gesture pauses; until then the picture is only stretched
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(layout, 140);
    };
    const hostCentre = () => { const box = host.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2] as const; };
    viewRef.current = {
      zoomBy: (factor) => zoomAt(Math.round(view.zoom * factor * 4) / 4, ...hostCentre()),
      reset: () => zoomAt(1, ...hostCentre()),
    };
    // Where the pointer is, for the rulers and the magnifier
    const onHover = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; aidsDirty = true; };
    const onLeave = () => { pointer = null; aidsDirty = true; };
    const onRelease = (e: PointerEvent) => { if (e.pointerType !== "mouse") pointer = null; aidsDirty = true; };
    host.addEventListener("pointermove", onHover);
    host.addEventListener("pointerdown", onHover);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerup", onRelease);
    host.addEventListener("pointercancel", onRelease);
    const observer = new ResizeObserver(layout);
    observer.observe(host);

    // ---------- drawing ----------
    /** Rulers along the top and left of the stage area, in stage units, with a mark at the pointer. */
    const drawRulers = () => {
      const on = useHelpers.getState().rulers;
      rulers.style.display = on ? "block" : "none";
      if (!on) return;
      const box = host.getBoundingClientRect(), stageBox = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(box.width * dpr), ph = Math.round(box.height * dpr);
      if (rulers.width !== pw || rulers.height !== ph) { rulers.width = pw; rulers.height = ph; }
      const o = rulers.getContext("2d")!;
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.clearRect(0, 0, box.width, box.height);
      const { stage } = store.getState().scene;
      const scale = stageBox.width / stage.w; // css px per stage unit
      const ox = stageBox.left - box.left, oy = stageBox.top - box.top;
      const major = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((step) => step * scale >= 56) ?? 500;
      const minor = major / 5;
      o.fillStyle = "rgba(14,14,15,0.88)";
      o.fillRect(0, 0, box.width, RULER);
      o.fillRect(0, RULER, RULER, box.height - RULER);
      o.strokeStyle = "#8e8e93";
      o.fillStyle = "#aeaeb2";
      o.lineWidth = 1;
      o.font = "9px ui-monospace, Menlo, monospace";
      o.textBaseline = "top";
      o.beginPath();
      for (let i = 0; i * minor <= stage.w + 0.01; i++) {
        const x = Math.round(ox + i * minor * scale) + 0.5;
        if (x < RULER || x > box.width) continue;
        const big = i % 5 === 0;
        o.moveTo(x, RULER); o.lineTo(x, RULER - (big ? 9 : 4));
        if (big) o.fillText(String(Math.round(i * minor)), x + 3, 2);
      }
      for (let i = 0; i * minor <= stage.h + 0.01; i++) {
        const y = Math.round(oy + i * minor * scale) + 0.5;
        if (y < RULER || y > box.height) continue;
        const big = i % 5 === 0;
        o.moveTo(RULER, y); o.lineTo(RULER - (big ? 9 : 4), y);
        if (big) { o.save(); o.translate(2, y + 3); o.rotate(Math.PI / 2); o.fillText(String(Math.round(i * minor)), 0, -8); o.restore(); }
      }
      o.stroke();
      if (pointer) {
        o.strokeStyle = "#ffd60a";
        o.lineWidth = 1.5;
        o.beginPath();
        const px = pointer.x - box.left, py = pointer.y - box.top;
        if (px > RULER) { o.moveTo(px, 0); o.lineTo(px, RULER); }
        if (py > RULER) { o.moveTo(0, py); o.lineTo(RULER, py); }
        o.stroke();
      }
    };

    /** The magnifier: what is under the pointer, three times larger, shown clear of the finger. */
    const drawLoupe = () => {
      const state = store.getState();
      const on = useHelpers.getState().loupe && !!pointer && !state.playing && (!!drag || state.mode !== "select");
      loupe.style.display = on ? "block" : "none";
      if (!on || !pointer) return;
      const box = host.getBoundingClientRect(), stageBox = canvas.getBoundingClientRect();
      const size = LOUPE * 2;
      if (loupe.width !== size) { loupe.width = size; loupe.height = size; }
      const o = loupe.getContext("2d")!;
      const dpr = canvas.width / stageBox.width;
      const span = (LOUPE / LOUPE_ZOOM) * dpr; // canvas px shown across the magnifier
      o.imageSmoothingEnabled = false;
      o.fillStyle = "#000";
      o.fillRect(0, 0, size, size);
      o.drawImage(canvas, (pointer.x - stageBox.left) * dpr - span / 2, (pointer.y - stageBox.top) * dpr - span / 2, span, span, 0, 0, size, size);
      for (const [color, width] of [["rgba(0,0,0,0.7)", 4], ["#ffffff", 1.5]] as const) {
        o.strokeStyle = color;
        o.lineWidth = width;
        o.beginPath();
        o.moveTo(size / 2, size / 2 - 22); o.lineTo(size / 2, size / 2 - 5); o.moveTo(size / 2, size / 2 + 5); o.lineTo(size / 2, size / 2 + 22);
        o.moveTo(size / 2 - 22, size / 2); o.lineTo(size / 2 - 5, size / 2); o.moveTo(size / 2 + 5, size / 2); o.lineTo(size / 2 + 22, size / 2);
        o.stroke();
      }
      const above = pointer.y - box.top - LOUPE - 36;
      loupe.style.left = `${Math.min(box.width - LOUPE - 4, Math.max(4, pointer.x - box.left - LOUPE / 2))}px`;
      loupe.style.top = `${above >= 4 ? above : pointer.y - box.top + 36}px`;
    };
    const drawAids = () => { aidsDirty = false; drawRulers(); drawLoupe(); };

    const paint = () => { paintScene(); drawAids(); };
    const paintScene = () => {
      const state = store.getState();
      const { scene, image, assets } = state;
      const W = canvas.width, H = canvas.height;
      const v = W / scene.stage.w; // device px per stage unit
      const dpr = W / (canvas.clientWidth || W);

      let photo: HTMLCanvasElement | null = null;
      if (image) {
        const key = `${image.src}|${W}x${H}|${scene.stage.fit}`;
        if (background?.key !== key) background = { key, canvas: prescale(image, W, H, scene.stage.fit) };
        photo = background.canvas;
      }
      // Playing shows the real video; parked on a frame shows what exists at that moment, ready to edit
      const editable = !state.playing || state.mode === "sketch";
      drawScene(ctx, scene, { width: W, height: H, assets, image: photo, time: state.preview ? state.time : null, animate: !editable || state.mode === "sketch" });

      const dot = (p: Vec, r: number, fill: string, stroke = "#0f172a") => {
        ctx.beginPath();
        ctx.arc(p.x * v, p.y * v, r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = stroke;
        ctx.stroke();
      };

      // Stroke being drawn right now
      if (drag?.kind === "stroke" && drag.points.length > 1) {
        const look = { color: state.sketch.color, ...sketchLook(state.sketch) };
        ctx.save();
        ctx.globalAlpha = look.opacity;
        ctx.strokeStyle = look.color;
        ctx.lineWidth = look.width * v;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.beginPath();
        const pts = state.mode === "line" ? [drag.points[0], drag.points[drag.points.length - 1]] : drag.points;
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x * v, p.y * v) : ctx.moveTo(p.x * v, p.y * v)));
        ctx.stroke();
        ctx.restore();
      }

      // Polygon being placed
      if (state.mode === "polygon" && state.draft.length) {
        ctx.save();
        ctx.strokeStyle = "#a78bfa";
        ctx.lineWidth = 2.5 * dpr;
        ctx.setLineDash([8 * dpr, 5 * dpr]);
        ctx.beginPath();
        state.draft.forEach((p, i) => (i ? ctx.lineTo(p.x * v, p.y * v) : ctx.moveTo(p.x * v, p.y * v)));
        ctx.stroke();
        ctx.setLineDash([]);
        state.draft.forEach((p, i) => dot(p, i === 0 && state.draft.length >= 3 ? 9 : 6, i === 0 && state.draft.length >= 3 ? "#34d399" : "#a78bfa", "#ffffff"));
        ctx.restore();
      }

      if (state.playing) return;

      // Grid: a dark line under a light one, so it shows on any photo
      const grid = useHelpers.getState().grid;
      if (grid !== "off") {
        const { xs, ys } = gridLines(grid, scene.stage.w, scene.stage.h);
        const strong = (at: number, size: number) => grid !== "thirds" && Math.abs(at - size / 2) < 0.01;
        for (const [color, width] of [["rgba(0,0,0,0.28)", 2], ["rgba(255,255,255,0.5)", 1]] as const) {
          for (const middle of [false, true]) {
            ctx.beginPath();
            xs.forEach((x) => { if (strong(x, scene.stage.w) === middle) { const px = Math.round(x * v) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H); } });
            ys.forEach((y) => { if (strong(y, scene.stage.h) === middle) { const py = Math.round(y * v) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W, py); } });
            ctx.strokeStyle = color;
            ctx.lineWidth = width * dpr * (middle ? 1.6 : grid === "fine" ? 0.6 : 1);
            ctx.stroke();
          }
        }
      }

      for (const g of guides) {
        ctx.save();
        ctx.strokeStyle = "#818cf8";
        ctx.lineWidth = dpr;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.beginPath();
        if (g.x != null) { ctx.moveTo(g.x * v, 0); ctx.lineTo(g.x * v, H); } else if (g.y != null) { ctx.moveTo(0, g.y * v); ctx.lineTo(W, g.y * v); }
        ctx.stroke();
        ctx.restore();
      }

      // A selected group: one frame around all of its overlays
      if (state.groupSel) {
        const members = scene.elements.filter((e) => e.group === state.groupSel && e.visible);
        if (members.length) {
          const boxes = members.map((e) => boundsOf(e, scene));
          const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
          const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
          const pad = 10 * dpr;
          ctx.save();
          ctx.lineWidth = 1.5 * dpr;
          ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
          ctx.strokeRect(x0 * v - pad, y0 * v - pad, (x1 - x0) * v + pad * 2, (y1 - y0) * v + pad * 2);
          ctx.setLineDash([8 * dpr, 5 * dpr]);
          ctx.strokeStyle = "#ffd60a";
          ctx.strokeRect(x0 * v - pad, y0 * v - pad, (x1 - x0) * v + pad * 2, (y1 - y0) * v + pad * 2);
          ctx.restore();
        }
        return;
      }

      const el = scene.elements.find((e) => e.id === state.selectedId);
      if (!el) return;
      const onScreen = !state.preview || existsAt(el, state.time);
      const b = boundsOf(el, scene);
      ctx.save();
      ctx.translate((b.x + b.w / 2) * v, (b.y + b.h / 2) * v);
      ctx.rotate(b.rot * DEG);
      const w = b.w * v, h = b.h * v;
      // Outline of the selection
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.setLineDash([]);
      if (onScreen && (el.type === "box" || el.type === "image")) {
        const ry = rotateHandleY(el, 1 / (v / dpr)) * v;
        ctx.beginPath(); ctx.moveTo(0, Math.sign(ry) * (h / 2)); ctx.lineTo(0, ry); ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#0f172a";
        ctx.beginPath(); ctx.arc(0, ry, 7 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const hs = 5.5 * dpr;
        for (const [hx, hy] of CORNERS) {
          ctx.fillRect((hx * w) / 2 - hs, (hy * h) / 2 - hs, hs * 2, hs * 2);
          ctx.strokeRect((hx * w) / 2 - hs, (hy * h) / 2 - hs, hs * 2, hs * 2);
        }
      }
      ctx.restore();
      if (!onScreen) return; // not part of this frame: outline only, nothing to grab

      if (el.type === "line") {
        const ends = lineEnds(el, scene);
        dot(ends.a, 8, el.aRef ? "#34d399" : "#ffffff");
        dot(ends.b, 8, el.bRef ? "#34d399" : "#ffffff");
      } else if (el.type === "polygon") {
        const n = el.points.length;
        for (let i = 0; i < (el.closed ? n : n - 1); i++) {
          const a = el.points[i], c = el.points[(i + 1) % n];
          dot({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }, 5, "rgba(148,163,184,0.9)", "#ffffff");
        }
        el.points.forEach((p) => dot(p, 8, "#ffffff", el.color));
      }
      if (hoverSnap) {
        ctx.beginPath();
        ctx.arc(hoverSnap.x * v, hoverSnap.y * v, 14 * dpr, 0, Math.PI * 2);
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 3 * dpr;
        ctx.stroke();
      }
    };

    const loop = () => {
      const state = store.getState();
      state.frame();
      const now = store.getState();
      const key = [now.scene, now.selectedId, now.groupSel, now.preview, now.playing, now.time, now.image, now.assets, now.draft, now.mode, now.sketch];
      if (dirty || key.some((value, i) => value !== lastKey[i])) {
        if (now.scene.stage !== (lastKey[0] as Scene | undefined)?.stage) layout();
        lastKey = key;
        dirty = false;
        paint();
      } else if (aidsDirty) drawAids();
      raf = requestAnimationFrame(loop);
    };
    layout();
    raf = requestAnimationFrame(loop);
    // Images decode asynchronously: repaint when the ones in use are ready
    const unsubscribeAssets = store.subscribe((state, previous) => {
      if (state.assets !== previous.assets || state.projectId !== previous.projectId) void preloadAssets(state.assets).then(() => { dirty = true; });
    });
    void preloadAssets(store.getState().assets).then(() => { dirty = true; });

    // ---------- input ----------
    const toStage = (e: PointerEvent): Vec & { k: number } => {
      const r = canvas.getBoundingClientRect();
      const k = store.getState().scene.stage.w / r.width; // stage units per css px
      return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
    };
    // Keep receiving moves when the pointer leaves the canvas; harmless if the browser refuses
    const capture = (e: PointerEvent) => {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* not a capturable pointer */ }
    };
    const reach = (e: PointerEvent, k: number) => (e.pointerType === "mouse" ? 9 : 20) * k;

    const findHandle = (el: El, scene: Scene, p: Vec & { k: number }, e: PointerEvent): Drag | null => {
      const r = reach(e, p.k);
      if (el.type === "box" || el.type === "image") {
        const l = toLocal(el, p);
        if (Math.hypot(l.x, l.y - rotateHandleY(el, p.k)) <= r * 1.2) return { kind: "rotate", id: el.id, origin: el, moved: false };
        // The nearest handle wins, but only when the press is nearer to it than to the
        // centre: otherwise a small element could never be moved, only resized.
        const toCentre = Math.hypot(l.x, l.y);
        let best: { hx: number; hy: number; d: number } | null = null;
        for (const [hx, hy] of CORNERS) {
          const dx = l.x - (hx * el.w) / 2, dy = l.y - (hy * el.h) / 2, d = Math.hypot(dx, dy);
          if (Math.abs(dx) <= r && Math.abs(dy) <= r && d < toCentre && (!best || d < best.d)) best = { hx, hy, d };
        }
        if (best) return { kind: "resize", id: el.id, start: p, origin: el, hx: best.hx, hy: best.hy, moved: false };
      } else if (el.type === "line") {
        const ends = lineEnds(el, scene);
        const da = Math.hypot(p.x - ends.a.x, p.y - ends.a.y), db = Math.hypot(p.x - ends.b.x, p.y - ends.b.y);
        if (Math.min(da, db) <= r) return { kind: "end", id: el.id, end: db <= da ? "b" : "a", moved: false, snap: null };
      } else if (el.type === "polygon") {
        const n = el.points.length;
        let index = -1, nearest = r;
        el.points.forEach((v, i) => { const d = Math.hypot(p.x - v.x, p.y - v.y); if (d <= nearest) { nearest = d; index = i; } });
        if (index >= 0) {
          // Corners that already sit close together must not delete each other on a small drag
          const near = 14 * p.k, v = el.points[index];
          const crowded = el.points.some((o, i) => i !== index && Math.hypot(o.x - v.x, o.y - v.y) < near * 1.5);
          return { kind: "vertex", id: el.id, index, moved: false, start: p, crowded };
        }
        // Midpoint handle: dragging it inserts a corner there (a plain tap does nothing)
        for (let i = 0; i < (el.closed ? n : n - 1); i++) {
          const a = el.points[i], c = el.points[(i + 1) % n];
          if (Math.hypot(p.x - (a.x + c.x) / 2, p.y - (a.y + c.y) / 2) <= r * 0.8) return { kind: "mid", id: el.id, after: i, start: p, moved: false };
        }
      }
      return null;
    };

    /** Insert a corner after index `after`; attached lines keep pointing at the same corners. */
    const insertVertex = (scene: Scene, polygon: PolygonEl, after: number, at: Vec): Scene => {
      const points = [...polygon.points];
      points.splice(after + 1, 0, at);
      const elements = scene.elements.map((other): El => {
        if (other.id === polygon.id) return { ...polygon, points };
        if (other.type !== "line") return other;
        const bump = (ref?: Anchor) => (ref && ref.id === polygon.id && typeof ref.at === "number" && ref.at > after ? { ...ref, at: ref.at + 1 } : ref);
        return { ...other, aRef: bump(other.aRef), bRef: bump(other.bRef) };
      });
      return { ...scene, elements };
    };

    // ---------- zoom and pan ----------
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + wheel, and a trackpad pinch (which browsers report the same way)
        e.preventDefault();
        zoomAt(view.zoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.01)), e.clientX, e.clientY);
      } else if (view.zoom > 1) {
        e.preventDefault();
        const unit = e.deltaMode ? 30 : 1;
        view.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
        view.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit;
        place();
      }
    };
    /** Give up the edit in progress, putting things back where they were. */
    const abortDrag = () => {
      if (!drag) return;
      const state = store.getState();
      const undone = drag;
      drag = null;
      guides = [];
      hoverSnap = null;
      dirty = true;
      if (undone.kind === "stroke" || !undone.moved) return;
      if (undone.kind === "group") {
        const back = new Map(undone.origins.map((el) => [el.id, el]));
        state.setScene({ ...state.scene, elements: state.scene.elements.map((el) => back.get(el.id) ?? el) });
      } else if ("origin" in undone) state.patch(undone.id, undone.origin);
      else state.commit(); // corners and line ends have no saved origin: keep the edit as its own undo step
    };
    // Two fingers zoom and pan; whatever the first finger had started is put back
    const fingers = new Map<number, Vec>();
    let pinch: { distance: number; zoom: number; cx: number; cy: number } | null = null;
    const pinchState = () => {
      const [a, b] = [...fingers.values()];
      return { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    };
    const onFingerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || (e.target !== canvas && e.target !== host)) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size !== 2) return;
      abortDrag();
      pinch = { ...pinchState(), zoom: view.zoom };
      e.stopPropagation();
      e.preventDefault();
    };
    const onFingerMove = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinch || fingers.size < 2) return;
      e.stopPropagation();
      const now = pinchState();
      view.x += now.cx - pinch.cx;
      view.y += now.cy - pinch.cy;
      pinch.cx = now.cx;
      pinch.cy = now.cy;
      zoomAt((pinch.zoom * now.distance) / pinch.distance, now.cx, now.cy);
    };
    const onFingerUp = (e: PointerEvent) => {
      if (!fingers.delete(e.pointerId)) return;
      if (!pinch) return;
      e.stopPropagation(); // the finger that stays down does not start editing
      if (fingers.size === 0) pinch = null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const state = store.getState();
      const p = toStage(e);
      e.preventDefault();

      if (state.mode === "draw" || state.mode === "line" || state.mode === "sketch") {
        capture(e);
        drag = { kind: "stroke", mode: state.mode, points: [{ x: p.x, y: p.y }], times: [0], start: state.time };
        dirty = true;
        return;
      }
      if (state.mode === "polygon") {
        const first = state.draft[0];
        if (state.draft.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) <= reach(e, p.k) * 1.2) {
          state.addElement(makePolygon(state.scene, state.draft, true));
          state.setMode("select");
        } else state.setDraft([...state.draft, { x: round1(p.x), y: round1(p.y) }]);
        return;
      }
      if (state.playing) { state.pause(); return; }

      const { scene } = state;
      // On a frame, only what is on screen at that moment can be picked or grabbed
      const shown = (el: El) => el.visible && (!state.preview || existsAt(el, state.time));
      const current = scene.elements.find((el) => el.id === state.selectedId);
      drag = current && shown(current) ? findHandle(current, scene, p, e) : null;
      if (!drag) {
        const tol = (e.pointerType === "mouse" ? 5 : 16) * p.k;
        const target = [...scene.elements].reverse().find((el) => shown(el) && hitTest(el, scene, p, tol));
        if (!target) { state.select(null); return; }
        // Working inside a group already (one of its overlays is selected): pick siblings directly.
        // Otherwise a grouped overlay selects its whole group; tapping again without dragging goes inside.
        const inside = !!target.group && current?.group === target.group;
        if (target.group && !inside) {
          const enter = state.groupSel === target.group;
          if (!enter) state.selectGroup(target.group);
          drag = { kind: "group", id: target.id, group: target.group, start: p, origins: scene.elements.filter((el) => el.group === target.group), moved: false, enter };
        } else {
          state.select(target.id);
          drag = { kind: "move", id: target.id, start: p, origin: target, moved: false };
        }
      }
      capture(e);
      dirty = true;
    };

    /** Lines a moving box can align to: the stage's edges and middle, other overlays' edges and middles, the grid. */
    const snapLines = (scene: Scene, moving: Set<string>, time: number | null): { x: SnapLine[]; y: SnapLine[] } => {
      const { w, h } = scene.stage;
      const x: SnapLine[] = [{ at: 0 }, { at: w / 2 }, { at: w }], y: SnapLine[] = [{ at: 0 }, { at: h / 2 }, { at: h }];
      for (const other of scene.elements) {
        if (moving.has(other.id) || !other.visible || (time !== null && !existsAt(other, time))) continue;
        const o = boundsOf(other, scene);
        x.push({ at: o.x }, { at: o.x + o.w / 2 }, { at: o.x + o.w });
        y.push({ at: o.y }, { at: o.y + o.h / 2 }, { at: o.y + o.h });
      }
      const grid = gridLines(useHelpers.getState().grid, w, h);
      grid.xs.forEach((at) => x.push({ at, quiet: true }));
      grid.ys.forEach((at) => y.push({ at, quiet: true }));
      return { x, y };
    };
    /** Pulls a box's start, middle or end onto the nearest line within reach, and shows which. */
    const snapAxis = (value: number, size: number, threshold: number, axis: "x" | "y", lines: SnapLine[]) => {
      let best: { d: number; line: SnapLine } | null = null;
      for (const line of lines) {
        for (const offset of [0, size / 2, size]) {
          const d = line.at - (value + offset);
          // A real edge wins over a grid line at the same distance
          if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d) - 0.01 || (Math.abs(d) <= Math.abs(best.d) && best.line.quiet && !line.quiet))) best = { d, line };
        }
      }
      if (!best) return value;
      if (!best.line.quiet) guides.push({ [axis]: best.line.at });
      return value + best.d;
    };

    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const state = store.getState();
      const { scene } = state;
      const p = toStage(e);
      dirty = true;

      if (drag.kind === "stroke") {
        // getCoalescedEvents keeps fast finger strokes smooth
        const events = e.getCoalescedEvents?.() ?? [e];
        for (const ev of events.length ? events : [e]) {
          const q = toStage(ev);
          drag.points.push({ x: round1(q.x), y: round1(q.y) });
          drag.times.push(Math.max(0, store.getState().time - drag.start));
        }
        return;
      }

      const dragId = drag.id;
      const el = scene.elements.find((item) => item.id === dragId);
      if (!el) return;
      guides = [];
      hoverSnap = null;

      if (drag.kind === "group") {
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) < 3 * p.k) return;
        drag.moved = true;
        let gx = dx, gy = dy;
        if (!e.altKey && useHelpers.getState().snap) {
          // The group aligns as one box
          const boxes = drag.origins.filter((origin) => origin.visible).map((origin) => boundsOf(origin, scene));
          if (boxes.length) {
            const x0 = Math.min(...boxes.map((box) => box.x)), y0 = Math.min(...boxes.map((box) => box.y));
            const gw = Math.max(...boxes.map((box) => box.x + box.w)) - x0, gh = Math.max(...boxes.map((box) => box.y + box.h)) - y0;
            const lines = snapLines(scene, new Set(drag.origins.map((origin) => origin.id)), state.preview ? state.time : null);
            gx = snapAxis(x0 + dx, gw, 6 * p.k, "x", lines.x) - x0;
            gy = snapAxis(y0 + dy, gh, 6 * p.k, "y", lines.y) - y0;
          }
        }
        const shifted = new Map(drag.origins.map((origin) => [origin.id, moved(origin, round1(gx), round1(gy))]));
        state.setScene({ ...scene, elements: scene.elements.map((item) => shifted.get(item.id) ?? item) });
      } else if (drag.kind === "move") {
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy) < 3 * p.k) return;
        drag.moved = true;
        const b = boundsOf(drag.origin, scene);
        let nx = b.x + dx, ny = b.y + dy;
        if (!e.altKey && !b.rot && useHelpers.getState().snap) {
          const lines = snapLines(scene, new Set([el.id]), state.preview ? state.time : null);
          nx = snapAxis(nx, b.w, 6 * p.k, "x", lines.x);
          ny = snapAxis(ny, b.h, 6 * p.k, "y", lines.y);
        }
        state.patch(el.id, moved(drag.origin, round1(nx - b.x), round1(ny - b.y)));
      } else if (drag.kind === "resize") {
        drag.moved = true;
        const o = drag.origin;
        const a = o.rot * DEG, cos = Math.cos(a), sin = Math.sin(a);
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
        let nw = drag.hx ? Math.max(MIN_SIZE, o.w + drag.hx * lx) : o.w;
        let nh = drag.hy ? Math.max(MIN_SIZE, o.h + drag.hy * ly) : o.h;
        // Images keep their proportions on corner handles; Shift does the same for boxes
        const ratio = o.w / o.h;
        if (drag.hx && drag.hy && (o.type === "image" || e.shiftKey)) {
          if (nw / nh > ratio) nh = nw / ratio; else nw = nh * ratio;
        } else if (o.type === "image") {
          if (drag.hx) nh = nw / ratio; else nw = nh * ratio; // edge handles scale the other side too
        }
        // The opposite edge stays put, even when rotated
        const sx = ((nw - o.w) / 2) * drag.hx, sy = ((nh - o.h) / 2) * drag.hy;
        const cx = o.x + o.w / 2 + sx * cos - sy * sin, cy = o.y + o.h / 2 + sx * sin + sy * cos;
        state.patch(el.id, { x: round1(cx - nw / 2), y: round1(cy - nh / 2), w: round1(nw), h: round1(nh) });
      } else if (drag.kind === "rotate") {
        drag.moved = true;
        const o = drag.origin;
        let angle = Math.atan2(p.y - (o.y + o.h / 2), p.x - (o.x + o.w / 2)) / DEG + 90;
        const snapped = Math.round(angle / 45) * 45;
        if (e.shiftKey) angle = Math.round(angle / 15) * 15;
        else if (Math.abs(angle - snapped) < 4) angle = snapped;
        state.patch(el.id, { rot: ((Math.round(angle) % 360) + 360) % 360 });
      } else if (drag.kind === "mid" && el.type === "polygon") {
        if (Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 4 * p.k) return;
        state.setScene(insertVertex(scene, el, drag.after, { x: round1(p.x), y: round1(p.y) }));
        drag = { kind: "vertex", id: el.id, index: drag.after + 1, moved: true, start: p, crowded: true };
      } else if (drag.kind === "vertex" && el.type === "polygon") {
        if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 3 * p.k) return;
        drag.moved = true;
        const points = el.points.map((v, i) => (i === (drag as { index: number }).index ? { x: round1(p.x), y: round1(p.y) } : v));
        state.patch(el.id, { points });
      } else if (drag.kind === "end" && el.type === "line") {
        drag.moved = true;
        const within = reach(e, p.k) * 1.3;
        const near = snapTargets(scene, el.id, state.preview ? state.time : null)
          .map((t) => ({ t, d: Math.hypot(p.x - t.at.x, p.y - t.at.y) }))
          .filter((c) => c.d <= within)
          .sort((a, b) => a.d - b.d)[0]?.t ?? null; // the nearest target, not the first in the list
        drag.snap = near;
        hoverSnap = near?.at ?? null;
        const at = near?.at ?? { x: round1(p.x), y: round1(p.y) };
        // Dragging an attached end detaches it
        state.patch(el.id, drag.end === "a" ? { a: at, aRef: undefined } : { b: at, bRef: undefined });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!drag) return;
      const cancelled = e.type === "pointercancel";
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      const state = store.getState();
      const finished = drag;
      drag = null;
      guides = [];
      hoverSnap = null;
      dirty = true;

      if (finished.kind === "stroke") {
        const { points, times, start } = finished;
        // A cancelled stroke, or one whose tool was switched off meanwhile, is dropped
        if (cancelled || state.mode !== finished.mode || points.length < 2) return;
        if (state.mode === "sketch") state.addStroke(points, times, start);
        else {
          state.addStroke(state.mode === "line" ? [points[0], points[points.length - 1]] : points, null, 0);
          state.setMode("select");
        }
        return;
      }
      // A tap (no drag) on an already selected group goes inside it: that overlay becomes the selection
      if (finished.kind === "group" && !finished.moved) { if (finished.enter) state.select(finished.id); return; }
      if (finished.kind === "mid" || !finished.moved) return;
      // Nothing may be dropped where it cannot be reached again: pull it back so a part stays on the stage
      if (finished.kind === "move" || finished.kind === "group") {
        const now = state.scene;
        const members = now.elements.filter((item) => (finished.kind === "group" ? item.group === finished.group : item.id === finished.id));
        const boxes = members.map((item) => boundsOf(item, now));
        if (boxes.length) {
          const keep = 40; // stage units that must remain inside
          const x0 = Math.min(...boxes.map((b) => b.x)), x1 = Math.max(...boxes.map((b) => b.x + b.w));
          const y0 = Math.min(...boxes.map((b) => b.y)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
          const dx = x1 < keep ? keep - x1 : x0 > now.stage.w - keep ? now.stage.w - keep - x0 : 0;
          const dy = y1 < keep ? keep - y1 : y0 > now.stage.h - keep ? now.stage.h - keep - y0 : 0;
          if (dx || dy) {
            const ids = new Set(members.map((item) => item.id));
            state.setScene({ ...now, elements: now.elements.map((item) => (ids.has(item.id) ? moved(item, dx, dy) : item)) });
          }
        }
      }
      const scene = store.getState().scene;
      const el = scene.elements.find((item) => item.id === finished.id);
      if (finished.kind === "end" && finished.snap && el?.type === "line") {
        state.patch(el.id, (finished.end === "a" ? { aRef: finished.snap.anchor } : { bRef: finished.snap.anchor }) as Partial<LineEl>);
      }
      if (finished.kind === "vertex" && el?.type === "polygon") {
        // Dropping a vertex onto its neighbour removes it (works with a finger too)
        const n = el.points.length, v = el.points[finished.index];
        const neighbours = [finished.index - 1, finished.index + 1].map((i) => (el.closed ? (i + n) % n : i)).filter((i) => i >= 0 && i < n && i !== finished.index);
        const k = scene.stage.w / canvas.getBoundingClientRect().width;
        if (n > 2 && !finished.crowded && neighbours.some((i) => Math.hypot(el.points[i].x - v.x, el.points[i].y - v.y) < 14 * k)) {
          state.setScene(removeVertex(scene, el, finished.index));
        }
      }
      state.commit();
    };

    const onDoubleClick = (e: MouseEvent) => {
      const state = store.getState();
      if (state.mode !== "select" || state.playing) return;
      const el = state.scene.elements.find((item) => item.id === state.selectedId);
      if (el?.type !== "polygon" || el.points.length <= 2) return;
      const r = canvas.getBoundingClientRect(), k = state.scene.stage.w / r.width;
      const p = { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
      const index = el.points.findIndex((v) => Math.hypot(p.x - v.x, p.y - v.y) <= 10 * k);
      if (index >= 0) { state.setScene(removeVertex(state.scene, el, index)); state.commit(); }
    };

    // ---------- keyboard ----------
    let nudgeTimer = 0;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return; // a sheet is open: the canvas behind it is off limits
      const target = e.target as HTMLElement | null;
      const typing = !!target?.matches?.("input, textarea, select, [contenteditable]");
      const state = store.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        // Fields with text keep their own undo; sliders, colours and checkboxes do not have one
        if (typing && target!.matches('textarea, input:not([type="range"]):not([type="color"]):not([type="checkbox"])')) return;
        e.preventDefault();
        if (e.shiftKey) state.redo(); else state.undo();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "d" && state.selectedId) { e.preventDefault(); state.duplicate(state.selectedId); return; }
      if (mod || e.altKey) return;
      if (e.key === " " && target?.tagName !== "BUTTON") {
        e.preventDefault();
        if (e.repeat || state.mode === "sketch") return; // sketching ends with Stop, not with Space
        if (state.playing) state.pause(); else state.play();
      } else if (e.key === "Escape") {
        if (state.mode !== "select") state.setMode("select");
        else if (state.preview) state.exitPreview();
        else if (state.selectedId && state.scene.elements.find((item) => item.id === state.selectedId)?.group) state.selectGroup(state.scene.elements.find((item) => item.id === state.selectedId)!.group!); // step out to the group
        else state.select(null);
      } else if (e.key === "Enter" && state.mode === "polygon" && state.draft.length >= 2) {
        state.addElement(makePolygon(state.scene, state.draft, false));
        state.setMode("select");
      } else if (state.groupSel && !state.playing) {
        const group = state.groupSel;
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); state.removeGroup(group); }
        else if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          state.setScene({ ...state.scene, elements: state.scene.elements.map((item) => (item.group === group ? moved(item, dx, dy) : item)) });
          clearTimeout(nudgeTimer);
          nudgeTimer = window.setTimeout(() => store.getState().commit(), 400);
        }
      } else if (state.selectedId && !state.playing) {
        const el = state.scene.elements.find((item) => item.id === state.selectedId);
        if (!el) return;
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); state.remove(el.id); }
        else if (e.key.startsWith("Arrow")) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          state.patch(el.id, moved(el, dx, dy));
          clearTimeout(nudgeTimer);
          nudgeTimer = window.setTimeout(() => store.getState().commit(), 400); // one undo step per burst
        }
      }
    };

    host.addEventListener("wheel", onWheel, { passive: false });
    host.addEventListener("pointerdown", onFingerDown, true);
    host.addEventListener("pointermove", onFingerMove, true);
    host.addEventListener("pointerup", onFingerUp, true);
    host.addEventListener("pointercancel", onFingerUp, true);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribeAssets();
      clearTimeout(nudgeTimer);
      clearTimeout(settleTimer);
      observer.disconnect();
      unsubscribeHelpers();
      host.removeEventListener("pointermove", onHover);
      host.removeEventListener("pointerdown", onHover);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerup", onRelease);
      host.removeEventListener("pointercancel", onRelease);
      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("pointerdown", onFingerDown, true);
      host.removeEventListener("pointermove", onFingerMove, true);
      host.removeEventListener("pointerup", onFingerUp, true);
      host.removeEventListener("pointercancel", onFingerUp, true);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const mode = useEditor((s) => s.mode);
  const grid = useHelpers((s) => s.grid);
  const rulersOn = useHelpers((s) => s.rulers);
  const change = useHelpers((s) => s.change);
  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute left-1/2 top-1/2 block select-none ${mode === "select" ? "" : "cursor-crosshair"}`}
        style={{ touchAction: "none" }}
      />
      <canvas ref={rulersRef} className="absolute inset-0 w-full h-full pointer-events-none hidden" aria-hidden />
      <canvas ref={loupeRef} className="absolute pointer-events-none hidden rounded-full ring-2 ring-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.6)]" style={{ width: LOUPE, height: LOUPE }} aria-hidden />
      {/* Grid and rulers: quick switches; the rest is in Canvas */}
      <div className="absolute left-2 bottom-2 hidden lg:flex items-center rounded-full bg-raised text-fg" role="group" aria-label={t("Helpers")}>
        <button type="button" onClick={() => change({ grid: GRIDS[(GRIDS.indexOf(grid) + 1) % GRIDS.length] })} title={t("Grid: {kind}", { kind: t(GRID_NAMES[grid]) })} aria-label={t("Grid: {kind}", { kind: t(GRID_NAMES[grid]) })} className={`w-9 h-9 grid place-items-center ${grid === "off" ? "text-fg-muted" : "text-brand"}`}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden><path d="M4 4h16v16H4zM9.3 4v16M14.7 4v16M4 9.3h16M4 14.7h16" /></svg>
        </button>
        <button type="button" onClick={() => change({ rulers: !rulersOn })} title={t("Rulers")} aria-label={t("Rulers")} aria-pressed={rulersOn} className={`w-9 h-9 grid place-items-center ${rulersOn ? "text-brand" : "text-fg-muted"}`}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden><path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4" /></svg>
        </button>
      </div>
      {/* Zoom: pinch or Ctrl + wheel does the same */}
      {/* On a phone you pinch, so only the way back to 100% is shown, and only when zoomed in */}
      <div className={`absolute right-2 bottom-2 items-center rounded-full bg-raised text-fg ${zoom > 1 ? "flex" : "hidden lg:flex"}`} role="group" aria-label={t("Zoom")}>
        <button type="button" onClick={() => viewRef.current?.zoomBy(1 / 1.5)} disabled={zoom <= 1} aria-label={t("Zoom out")} className="hidden lg:grid w-9 h-9 place-items-center text-[18px] leading-none disabled:text-fg-subtle/50">−</button>
        <button type="button" onClick={() => viewRef.current?.reset()} title={t("Back to 100%")} className={`h-9 min-w-12 px-2 text-[12px] font-mono tabular-nums ${zoom > 1 ? "text-brand" : "text-fg-muted"}`}>{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => viewRef.current?.zoomBy(1.5)} disabled={zoom >= MAX_ZOOM} aria-label={t("Zoom in")}className="hidden lg:grid w-9 h-9 place-items-center text-[18px] leading-none disabled:text-fg-subtle/50">+</button>
      </div>
    </div>
  );
}

