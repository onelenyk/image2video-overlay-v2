import { useEffect, useRef } from "react";
import { boundsOf, moved } from "../engine/geometry";
import { drawScene, preloadAssets } from "../engine/renderer";
import type { Asset, El, Scene } from "../engine/types";

// A tiny live picture of one overlay, drawn by the real renderer, so a tile
// shows exactly what tapping it will put on the photo (and how it moves).

// One shared clock for every animated preview on screen
const listeners = new Set<(seconds: number) => void>();
let raf = 0;
function tick(now: number) {
  listeners.forEach((listener) => listener(now / 1000));
  raf = listeners.size ? requestAnimationFrame(tick) : 0;
}
function subscribe(listener: (seconds: number) => void) {
  listeners.add(listener);
  if (!raf) raf = requestAnimationFrame(tick);
  return () => { listeners.delete(listener); };
}

const NO_ASSETS: Record<string, Asset> = {};

export function MiniPreview({ el, assets = NO_ASSETS, animate = false, className = "" }: { el: El; assets?: Record<string, Asset>; animate?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const signature = JSON.stringify(el); // repaint when the overlay itself changes, not on every render

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const overlay = JSON.parse(signature) as El;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || 64, ch = canvas.clientHeight || 44;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);

    // Frame the overlay with some room around it for its motion
    const base = { w: 1000, h: 1000, bg: "rgba(0,0,0,0)", dim: 0, fit: "contain" as const, aspect: "1:1" as const };
    const probe: Scene = { stage: base, elements: [overlay], duration: { mode: "auto", seconds: 3 }, nextId: 1 };
    const b = boundsOf(overlay, probe);
    const pad = Math.max(b.w, b.h) * (animate ? 0.42 : 0.07) + 8;
    let w = b.w + pad * 2, h = b.h + pad * 2;
    if (w / h < cw / ch) w = h * (cw / ch); else h = w / (cw / ch);
    const placed = moved(overlay, w / 2 - (b.x + b.w / 2), h / 2 - (b.y + b.h / 2));
    const scene: Scene = { ...probe, stage: { ...base, w, h }, elements: [placed] };

    const paint = (time: number | null) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawScene(ctx, scene, { width: canvas.width, height: canvas.height, assets, time });
    };
    if (!animate) { paint(null); return; }
    return subscribe(paint);
  }, [signature, assets, animate]);

  return <canvas ref={ref} className={className} aria-hidden />;
}

/** A looping preview of several overlays together on a W x H stage (used for templates). */
export function ScenePreview({ elements, assets, width, height, seconds, startAt = 0, className = "" }: { elements: El[]; assets: Record<string, Asset>; width: number; height: number; seconds: number; /** Where in the loop the preview opens, e.g. on the finished picture. */ startAt?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const signature = JSON.stringify(elements);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round((canvas.clientWidth || 120) * dpr);
    canvas.height = Math.round((canvas.clientHeight || 90) * dpr);
    const scene: Scene = {
      stage: { w: width, h: height, bg: "rgba(0,0,0,0)", dim: 0, fit: "contain", aspect: "1:1" },
      elements: JSON.parse(signature) as El[],
      duration: { mode: "auto", seconds: 3 },
      nextId: 1,
    };
    // Letterbox the stage inside the tile
    const k = Math.min(canvas.width / width, canvas.height / height);
    const w = Math.round(width * k), h = Math.round(height * k);
    const buffer = document.createElement("canvas");
    buffer.width = w;
    buffer.height = h;
    const bufferCtx = buffer.getContext("2d")!;
    let disposed = false;
    let first: number | null = null;
    void preloadAssets(assets).then(() => { if (!disposed) paint(first ?? 0); });
    const paint = (now: number) => {
      first ??= now;
      bufferCtx.setTransform(1, 0, 0, 1, 0, 0);
      bufferCtx.clearRect(0, 0, w, h);
      drawScene(bufferCtx, scene, { width: w, height: h, assets, time: (now - first + startAt) % seconds });
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(buffer, (canvas.width - w) / 2, (canvas.height - h) / 2);
    };
    const stop = subscribe(paint);
    return () => { disposed = true; stop(); };
  }, [signature, assets, width, height, seconds, startAt]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
