import { BUDGET, codeFrame, type ParamValue } from "./codeRunner";
import { existsAt } from "./geometry";
import type { CodeEl, Scene } from "./types";

// Pictures of code overlays, ready for the renderer. Drawing a scene is
// immediate and the sandbox is not, so frames are fetched here and the renderer
// paints whichever one it has:
//   - while editing or playing: the latest frame that arrived (a frame or two late);
//   - when exporting: prepareCodeFrames() is awaited first, so every frame is exact.

/** What `t` a code overlay shows in the "everything at once" view, where there is no time. */
const POSTER_SECONDS = 2;
const MAX_SIDE = 2048;
const MAX_KEPT = 48;

interface Kept { bitmap: ImageBitmap; t: number }
const kept = new Map<string, Kept>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

/** Called when a new frame has arrived and views should repaint. */
export function onCodeFrame(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Seconds since the overlay appeared, at timeline time `time` (null = the everything-at-once view). */
export const codeTime = (el: CodeEl, time: number | null) => (time === null ? POSTER_SECONDS : Math.max(0, time - (el.time?.start ?? 0)));

function ask(el: CodeEl, pxPerUnit: number) {
  const scale = Math.min(pxPerUnit, MAX_SIDE / Math.max(el.w, el.h));
  const pw = Math.max(1, Math.round(el.w * scale)), ph = Math.max(1, Math.round(el.h * scale));
  const params: Record<string, ParamValue> = el.params ?? {};
  return { key: `${pw}x${ph}|${JSON.stringify(params)}|${el.code}`, pw, ph, params };
}

function keep(key: string, frame: Kept) {
  kept.get(key)?.bitmap.close();
  kept.delete(key);
  kept.set(key, frame); // most recent last
  if (kept.size > MAX_KEPT) {
    const [oldest, old] = kept.entries().next().value!;
    old.bitmap.close();
    kept.delete(oldest);
  }
}

/**
 * The frame to paint for a code overlay right now, or null if none has arrived yet.
 * Unless `exact`, a fresher one is requested in the background when this one is for another moment.
 */
export function codeBitmap(el: CodeEl, time: number | null, pxPerUnit: number, exact: boolean): ImageBitmap | null {
  const { key, pw, ph, params } = ask(el, pxPerUnit);
  const have = kept.get(key);
  const t = codeTime(el, time);
  if (!exact && have?.t !== t && !pending.has(key)) {
    pending.add(key);
    void codeFrame({ code: el.code, t, w: el.w, h: el.h, pw, ph, params }, BUDGET.live).then((bitmap) => {
      pending.delete(key);
      if (!bitmap) return;
      keep(key, { bitmap, t });
      listeners.forEach((listener) => listener());
    });
  }
  return have?.bitmap ?? null;
}

/** Fetches the exact frame of every code overlay on screen at `time`. Await it before drawing a frame that must be right. */
export async function prepareCodeFrames(scene: Scene, time: number | null, pxPerUnit: number): Promise<void> {
  const jobs: Promise<void>[] = [];
  for (const el of scene.elements) {
    if (el.type !== "code" || !el.visible || (time !== null && !existsAt(el, time))) continue;
    const { key, pw, ph, params } = ask(el, pxPerUnit);
    const t = codeTime(el, time);
    if (kept.get(key)?.t === t) continue;
    jobs.push(codeFrame({ code: el.code, t, w: el.w, h: el.h, pw, ph, params }, BUDGET.exact).then((bitmap) => { if (bitmap) keep(key, { bitmap, t }); }));
  }
  await Promise.all(jobs);
}

export const hasCode = (scene: Scene) => scene.elements.some((el) => el.type === "code" && el.visible);
