import { useEffect, useRef } from "react";
import { drawScene } from "../engine/renderer";
import { videoLength } from "../engine/scene";
import { useEditor } from "../editor/store";
import { IconButton } from "./kit";
import { t } from "../i18n";

/** The video on a black screen with nothing around it: what the export will look like. Tap to pause. */
export function FullPreview({ onClose }: { onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    const host = hostRef.current!, canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const store = useEditor;

    const fit = () => {
      const { stage } = store.getState().scene;
      const box = host.getBoundingClientRect();
      const width = Math.min(box.width, (box.height * stage.w) / stage.h), height = (width * stage.h) / stage.w;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    fit();

    // The editor's own loop behind this screen advances the time; here it is only drawn
    let raf = 0;
    const loop = () => {
      const { scene, assets, image, time, narration } = store.getState();
      drawScene(ctx, scene, { width: canvas.width, height: canvas.height, assets, image, time });
      const seconds = videoLength(scene, narration?.duration).seconds;
      if (barRef.current) barRef.current.style.width = `${seconds > 0 ? Math.min(1, time / seconds) * 100 : 0}%`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") close.current();
      else if (e.key === " ") { e.preventDefault(); toggle(); }
    };
    window.addEventListener("resize", fit);
    window.addEventListener("keydown", onKey, true); // capture: before the editor's shortcuts
    store.getState().seek(0);
    store.getState().play();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      window.removeEventListener("keydown", onKey, true);
      store.getState().pause();
    };
  }, []);

  return (
    <div ref={hostRef} role="dialog" aria-modal="true" aria-label={t("Full-screen preview")} className="fixed inset-0 z-50 bg-black grid place-items-center">
      <canvas ref={canvasRef} onClick={toggle} className="block" />
      <IconButton icon="close" label={t("Close preview")}onClick={onClose} className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] bg-black/60 !rounded-full" />
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15" aria-hidden>
        <div ref={barRef} className="h-full bg-brand" style={{ width: 0 }} />
      </div>
    </div>
  );
}

function toggle() {
  const state = useEditor.getState();
  if (state.playing) state.pause(); else state.play();
}
