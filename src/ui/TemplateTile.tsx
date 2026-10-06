import type { Built } from "../engine/template";
import { ScenePreview } from "./MiniPreview";
import { PREVIEW_H, PREVIEW_W } from "./templateLibrary";

// What a template sits on in its tile: a hint of a plan or a map, in neutral grey
const backdrop = (lines: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 120' fill='none' stroke='#77777c' stroke-width='1.6' stroke-linecap='round'>${lines}</svg>`)}")`;
const BACKDROPS: Record<string, string> = {
  Interiors: backdrop("<path d='M14 12h132v96H14zM78 12v34M78 62v46M14 62h28M56 62h56M126 62h20'/>"),
  Maps: backdrop("<path d='M-4 34h168M-4 84h168M44-4v128M112-4v128M-4 118L60 60l50-28 58-40' stroke-width='5' stroke='#6c6c71'/>"),
};

/** A template tile: the whole set playing on a small stage, with its name. */
export function TemplateTile({ name, note, built, group, width = PREVIEW_W, height = PREVIEW_H, onClick, onDelete }: { name: string; note: string; built: Built; group?: string; width?: number; height?: number; onClick: () => void; onDelete?: () => void }) {
  // The tile opens on the finished picture, holds it, then replays how it builds up
  const story = Math.max(0.5, ...built.elements.map((el) => (el.type === "path" && el.sketch ? el.sketch.start + (el.sketch.times.at(-1) ?? 0) : el.time?.start ?? 0)));
  return (
    <div className="relative shrink-0 w-[150px] lg:w-auto">
      <button type="button" onClick={onClick} title={note} className="block w-full rounded-card bg-chip hover:bg-chip-hover active:bg-chip-active overflow-hidden text-left transition-colors">
        <span className="block m-1.5 rounded-lg bg-[#5c5c61] bg-cover bg-center overflow-hidden" style={{ backgroundImage: group ? BACKDROPS[group] : undefined }}>
          <ScenePreview elements={built.elements} assets={built.assets} width={width} height={height} seconds={story + 3} startAt={story + 0.5} className="block w-full aspect-[4/3]" />
        </span>
        <span className="block px-2.5 pb-2">
          <span className="block text-[13px] font-semibold text-fg truncate">{name}</span>
          <span className="block text-[11px] text-fg-subtle truncate">{note}</span>
        </span>
      </button>
      {onDelete && (
        <button type="button" onClick={onDelete} aria-label={`Delete template ${name}`} title="Delete this template" className="absolute top-2.5 right-2.5 w-7 h-7 grid place-items-center rounded-full bg-black/70 text-fg hover:text-danger">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </div>
  );
}
