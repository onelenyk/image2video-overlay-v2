import { useMemo, useState } from "react";
import type { Built, SampleKind } from "../engine/template";
import { ScenePreview } from "./MiniPreview";
import { SAMPLES } from "./templateSamples";
import { t, type Msg } from "../i18n";

/** One template as the gallery shows it. */
export interface GalleryItem {
  id: string;
  name: string;
  hint: string;
  group: string;
  sample?: SampleKind;
  built: Built;
  width: number;
  height: number;
  onPick: () => void;
  onDelete?: () => void;
}

const ALL = "All";
const POPOVER_W = 340;

/** When the whole set has appeared: the tile shows this moment, the large preview replays up to it. */
const storyOf = (built: Built) => Math.max(0.5, ...built.elements.map((el) => (el.type === "path" && el.sketch ? el.sketch.start + (el.sketch.times.at(-1) ?? 0) : el.time?.start ?? 0)));

function Picture({ item, playing, className }: { item: GalleryItem; playing: boolean; className: string }) {
  const story = storyOf(item.built);
  return (
    <span className={`block bg-[#5c5c61] bg-cover bg-center ${className}`} style={{ backgroundImage: item.sample ? SAMPLES[item.sample] : undefined }}>
      <ScenePreview elements={item.built.elements} assets={item.built.assets} width={item.width} height={item.height} seconds={story + 2.5} startAt={playing ? 0 : story + 0.5} playing={playing} className="block w-full aspect-[4/3]" />
    </span>
  );
}

/**
 * Templates as still tiles under a row of category chips. Tiles do not move;
 * with a mouse, pointing at one plays it large next to the tile.
 */
export function TemplateGallery({ items, layout = "grid", className = "" }: { items: GalleryItem[]; /** A grid that scrolls with its panel, or one row that scrolls sideways. */ layout?: "grid" | "row"; className?: string }) {
  const groups = useMemo(() => [ALL, ...new Set(items.map((item) => item.group))], [items]);
  const [picked, setPicked] = useState(ALL);
  const group = groups.includes(picked) ? picked : ALL;
  const shown = group === ALL ? items : items.filter((item) => item.group === group);
  const [hover, setHover] = useState<{ id: string; left: number; top: number } | null>(null);
  const hovered = hover && shown.find((item) => item.id === hover.id);

  // The large preview never covers other tiles: beside the whole grid, or under (above) a row
  const point = (id: string, tile: HTMLElement) => {
    const rect = tile.getBoundingClientRect();
    const height = POPOVER_W * 0.75 + 76;
    const fit = (value: number, size: number, room: number) => Math.min(Math.max(8, value), room - size - 8);
    if (layout === "row") {
      const below = rect.bottom + 8;
      setHover({ id, left: fit(rect.left + rect.width / 2 - POPOVER_W / 2, POPOVER_W, window.innerWidth), top: below + height <= window.innerHeight - 8 ? below : Math.max(8, rect.top - 8 - height) });
      return;
    }
    const list = (tile.closest("ul") ?? tile).getBoundingClientRect();
    const right = list.right + 20;
    setHover({ id, left: right + POPOVER_W <= window.innerWidth - 8 ? right : Math.max(8, list.left - 20 - POPOVER_W), top: fit(rect.top + rect.height / 2 - height / 2, height, window.innerHeight) });
  };

  return (
    <div className={className}>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2.5" role="tablist" aria-label={t("Kinds of template")}>
        {groups.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={group === name} onClick={() => setPicked(name)} className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${group === name ? "bg-fg text-ink" : "bg-chip text-fg-muted hover:text-fg hover:bg-chip-hover"}`}>
            {t(name as Msg)}
          </button>
        ))}
      </div>
      <ul className={layout === "row" ? "flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4" : "grid grid-cols-2 gap-2"}>
        {shown.map((item) => (
          <li key={item.id} className={`relative ${layout === "row" ? "shrink-0 w-[168px] sm:w-[208px]" : ""}`}>
            <button
              type="button"
              onClick={() => { setHover(null); item.onPick(); }}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") point(item.id, e.currentTarget); }}
              onPointerLeave={() => setHover(null)}
              className="block w-full rounded-card bg-chip hover:bg-chip-hover active:bg-chip-active overflow-hidden text-left transition-colors"
            >
              <Picture item={item} playing={false} className="" />
              <span className="block px-2.5 py-1.5 text-[12px] font-semibold text-fg truncate">{item.name}</span>
            </button>
            {item.onDelete && (
              <button type="button" onClick={item.onDelete} aria-label={t("Delete template {name}", { name: item.name })} title={t("Delete this template")} className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-full bg-black/70 text-fg hover:text-danger">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </li>
        ))}
      </ul>
      {hover && hovered && (
        <div className="fixed z-50 pointer-events-none rounded-card bg-raised overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.7)]" style={{ left: hover.left, top: hover.top, width: POPOVER_W }} aria-hidden>
          <Picture key={hovered.id} item={hovered} playing className="" />
          <div className="px-3 py-2.5">
            <div className="text-[14px] font-semibold text-fg">{hovered.name}</div>
            <div className="text-[12px] leading-snug text-fg-muted">{hovered.hint}</div>
          </div>
        </div>
      )}
    </div>
  );
}
