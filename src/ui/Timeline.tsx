import { useEffect, useRef, useState } from "react";
import { drawScene, preloadAssets, prescale } from "../engine/renderer";
import { videoLength } from "../engine/scene";
import { useEditor } from "../editor/store";
import { Tracks } from "./Tracks";

const TILE_HEIGHT = window.matchMedia("(min-width: 1024px)").matches ? 60 : 44;

/** Timeline zone: a filmstrip of the whole video to scrub through, and one track per element. */
export function Timeline() {
  const scene = useEditor((s) => s.scene);
  const assets = useEditor((s) => s.assets);
  const image = useEditor((s) => s.image);
  const narration = useEditor((s) => s.narration);
  const time = useEditor((s) => s.time);
  const preview = useEditor((s) => s.preview);
  const sketching = useEditor((s) => s.mode === "sketch");
  const fps = useEditor((s) => s.exportSettings.fps);
  const seek = useEditor((s) => s.seek);

  const duration = videoLength(scene, narration?.duration).seconds;
  const stripRef = useRef<HTMLDivElement>(null);
  const tiles = useRef<(HTMLCanvasElement | null)[]>([]);
  const [stripWidth, setStripWidth] = useState(320);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const observer = new ResizeObserver(([entry]) => setStripWidth(entry.contentRect.width));
    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  // As many tiles as fit while each shows the whole frame
  const aspect = scene.stage.w / scene.stage.h;
  const tileCount = Math.min(30, Math.max(4, Math.round(stripWidth / (TILE_HEIGHT * aspect))));

  // Thumbnails come from the same renderer as the export; refreshed shortly after edits settle
  useEffect(() => {
    if (sketching) return;
    const timer = setTimeout(async () => {
      await preloadAssets(assets);
      const height = TILE_HEIGHT * 2;
      const width = Math.max(2, Math.round(height * aspect));
      const photo = image ? prescale(image, width, height, scene.stage.fit) : null;
      tiles.current.slice(0, tileCount).forEach((tile, index) => {
        const ctx = tile?.getContext("2d");
        if (!tile || !ctx) return;
        tile.width = width;
        tile.height = height;
        drawScene(ctx, scene, { width, height, assets, image: photo, time: ((index + 0.5) / tileCount) * duration });
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [scene, assets, image, duration, tileCount, aspect, sketching]);

  const scrubTo = (clientX: number) => {
    const rect = stripRef.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    seek(Math.round(ratio * duration * fps) / fps);
  };
  const shown = Math.min(time, duration);
  const step = (frames: number) => seek((preview ? shown : 0) + frames / fps);

  return (
    <section aria-label="Timeline" className="relative px-3 pt-1 pb-2 lg:pt-3">
      <span className="hidden lg:block absolute left-3 w-[104px] text-right text-[11px] text-fg-subtle" style={{ lineHeight: `${TILE_HEIGHT}px` }} aria-hidden>Frames</span>
      <div
        ref={stripRef}
        className={`relative flex rounded-md overflow-hidden ring-2 ring-brand select-none lg:ml-[116px] ${sketching ? "opacity-60" : "cursor-ew-resize"}`}
        style={{ height: TILE_HEIGHT, touchAction: "none" }}
        onPointerDown={(e) => { if (!sketching) { e.currentTarget.setPointerCapture(e.pointerId); scrubTo(e.clientX); } }}
        onPointerMove={(e) => { if (!sketching && e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX); }}
        role="slider"
        aria-label="Video timeline"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={shown}
        tabIndex={0}
        onKeyDown={(e) => { if (sketching) return; if (e.key === "ArrowLeft") { e.stopPropagation(); step(-1); } else if (e.key === "ArrowRight") { e.stopPropagation(); step(1); } }}
      >
        {Array.from({ length: tileCount }, (_, index) => (
          <canvas key={index} ref={(node) => { tiles.current[index] = node; }} className="flex-1 min-w-0 h-full object-cover pointer-events-none border-r border-line last:border-r-0" />
        ))}
        {preview && (
          <div className="absolute top-0 bottom-0 w-[3px] rounded-full bg-white shadow-[0_0_4px_rgba(0,0,0,0.9)] pointer-events-none" style={{ left: `calc(${Math.min(1, shown / duration) * 100}% - 1px)` }}>
            
          </div>
        )}
      </div>
      <Tracks duration={duration} width={stripWidth} playhead={preview ? shown : null} />
    </section>
  );
}
