import { useMemo, type ReactNode } from "react";
import { prepareSvg } from "../../engine/renderer";
import { makePreset, type Preset } from "../../engine/scene";
import type { Anim, AnimType, Asset, BoxEl, El, LineEl } from "../../engine/types";
import { useEditor, type Mode } from "../../editor/store";
import { MiniPreview } from "../MiniPreview";
import { TemplateGallery, type GalleryItem } from "../TemplateGallery";
import { MARKERS } from "../markers";
import { buildSaved, buildTemplate, type Built } from "../../engine/template";
import { LIBRARY, PREVIEW_H, PREVIEW_W } from "../templateLibrary";
import { IconSearch } from "./IconSearch";
import { pickFile } from "../util";

// Add overlay: ready-made overlays, grouped into sections. Anything drawn by
// hand lives in the Draw tool instead.
// On a phone one section is shown at a time (tabs on top); in the desktop side
// column there are two views: the template gallery, or all single overlays
// listed under their headings.

type SectionId = "templates" | "zones" | "arrows" | "text" | "icons" | "animated" | "images";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "templates", label: "Templates" },
  { id: "zones", label: "Zones" },
  { id: "arrows", label: "Arrows" },
  { id: "text", label: "Text" },
  { id: "icons", label: "Icons" },
  { id: "animated", label: "Animated" },
  { id: "images", label: "Images" },
];

const YELLOW = "#ffd60a";
const anim = (type: AnimType, duration = 1.5): Anim => ({ enabled: true, type, duration, delay: 0, intensity: 1 });

/** Small drawing on a tile: outlines in the text colour, fills in highlighter yellow. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 24" className="w-9 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

/** The same overlay, trimmed so it reads at thumbnail size: shorter lines, no stray caption. */
function forTile(el: El): El {
  if (el.type === "line") return { ...el, a: { x: 0, y: 0 }, b: { x: Math.max(150, el.width * 9), y: 0 }, width: Math.max(el.width, 14) };
  if (el.type === "point") return { ...el, r: 34, label: { ...el.label, show: false } };
  if (el.type === "box" && el.opacity === 0 && el.borderWidth === 0) return { ...el, w: Math.max(120, el.label.text.length * el.label.size * 0.62), h: el.label.size * 1.5 };
  return el;
}

const tileClass = "shrink-0 w-[84px] lg:w-auto h-[78px] rounded-card bg-chip hover:bg-chip-hover active:bg-chip-active flex flex-col items-center justify-end overflow-hidden text-fg transition-colors";
const tileLabel = "w-full px-1.5 pb-1.5 pt-0.5 truncate text-center text-[11.5px] font-medium text-fg-muted";

/** A tile with a hand-made glyph: tools and things that have no overlay to preview yet. */
function Tile({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={tileClass}>
      <span className="flex-1 grid place-items-center">{children}</span>
      <span className={tileLabel}>{label}</span>
    </button>
  );
}

/** A tile that shows the overlay itself, drawn (and animated) by the real renderer. */
function OverlayTile({ label, el, onClick }: { label: string; el: El; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={tileClass}>
      <MiniPreview el={el} animate={el.anim.enabled} className="block w-full flex-1 min-h-0" />
      <span className={tileLabel}>{label}</span>
    </button>
  );
}

const fill = { fill: YELLOW, fillOpacity: 0.45 } as const;

export function AddPanel() {
  const { scene, assets, addElement, addAssetImage, addGroup, setMode, setTool, patch, commit, notify, play, seek, savedTemplates, saveTemplate, deleteTemplate } = useEditor();
  // Kept in the store so reopening the panel returns to the section used last
  const section = (useEditor((state) => state.addSection) as SectionId | null) ?? "zones";
  const setSection = useEditor((state) => state.setAddSection);

  /** A preset element with some fields changed; `then` picks which tool opens next. */
  const add = (kind: Preset, changes: Partial<BoxEl> | Partial<LineEl> | Partial<El> = {}, then: "style" | "animate" = "style") => {
    addElement({ ...makePreset(scene, kind), ...changes } as El);
    setTool(then);
    if (then === "animate") play();
  };
  /** Tile for a preset overlay: what you see on the tile is what gets added. */
  const overlay = (label: string, kind: Preset, changes: Partial<BoxEl> | Partial<LineEl> | Partial<El> = {}, then: "style" | "animate" = "style") => (
    <OverlayTile key={label} label={label} el={forTile({ ...makePreset(scene, kind), ...changes } as El)} onClick={() => add(kind, changes, then)} />
  );
  const box = (changes: Partial<BoxEl> = {}, label?: Partial<BoxEl["label"]>): Partial<BoxEl> => {
    const base = makePreset(scene, "rect") as BoxEl;
    return { ...changes, label: { ...base.label, ...label } };
  };
  const tool = (mode: Mode) => {
    setMode(mode);
    setTool(null); // free the screen for drawing
  };

  const addAsset = (asset: Asset, animation?: Anim) => {
    addAssetImage(asset);
    const id = useEditor.getState().selectedId;
    if (animation && id) { patch(id, { anim: animation }); commit(); }
    setTool(animation ? "animate" : "style");
    if (animation) play();
  };
  const addMarker = (svg: string, animation?: Anim) => {
    const prepared = prepareSvg(svg);
    if (prepared) addAsset({ format: "svg", data: prepared.markup, aspect: prepared.aspect }, animation);
  };
  const upload = async () => {
    const file = await pickFile("image/png,image/jpeg,image/webp,image/svg+xml,.svg");
    if (!file) return;
    if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
      const prepared = prepareSvg(await file.text());
      if (!prepared) { notify("That SVG could not be read.", "error"); return; }
      addAsset({ format: "svg", data: prepared.markup, aspect: prepared.aspect });
      return;
    }
    const data = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.readAsDataURL(file); });
    const img = new Image();
    await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = data; });
    if (!img.naturalWidth) { notify("That image could not be read.", "error"); return; }
    addAsset({ format: "png", data, aspect: img.naturalWidth / img.naturalHeight });
  };

  // Next free number for badges: 1, 2, 3…
  const badgeNumber = () => {
    const used = new Set(scene.elements.map((el) => (el.type === "box" ? el.label.text : "")));
    let n = 1;
    while (used.has(String(n))) n++;
    return String(n);
  };
  const pin = MARKERS.find((m) => m.name === "Pin")!;
  const used = Object.entries(assets);

  // A template lands spread over the photo as one group and plays straight away
  const applyBuilt = (name: string, built: Built) => {
    addGroup(name, built.elements, built.assets);
    if (!window.matchMedia("(min-width: 1024px)").matches) setTool(null);
    seek(0);
    play();
    notify(`${name} added as a group. Drag it into place; tap a piece again to edit it.`);
  };
  // Previews are built once per template; the real thing is built for the actual stage on tap
  const library = useMemo(() => LIBRARY.map((spec) => ({ spec, preview: buildTemplate(spec, PREVIEW_W, PREVIEW_H) })), []);
  const mine = useMemo(() => savedTemplates.map((saved) => ({ saved, preview: buildSaved(saved, saved.w, saved.h) })), [savedTemplates]);
  const gallery: GalleryItem[] = [
    ...mine.map(({ saved, preview }) => ({ id: saved.id, name: saved.name, hint: `${saved.elements.length} overlays, saved by you`, group: "Mine", built: preview, width: saved.w, height: saved.h, onPick: () => applyBuilt(saved.name, buildSaved(saved, scene.stage.w, scene.stage.h)), onDelete: () => void deleteTemplate(saved.id) })),
    ...library.map(({ spec, preview }) => ({ id: spec.id, name: spec.name, hint: spec.hint, group: spec.group, sample: spec.sample, built: preview, width: PREVIEW_W, height: PREVIEW_H, onPick: () => applyBuilt(spec.name, buildTemplate(spec, scene.stage.w, scene.stage.h)) })),
  ];
  const saveAll = () => {
    if (!scene.elements.length) { notify("Add some overlays first, then save them as a template."); return; }
    void saveTemplate(`My template ${savedTemplates.length + 1}`, null);
  };

  const content: Record<SectionId, ReactNode> = {
    templates: null, // the gallery, rendered separately below
    zones: (
      <>
        {overlay("Zone", "rect")}
        {overlay("Rounded", "rect", { radius: 36 })}
        {overlay("Ellipse", "ellipse")}
        {overlay("Outline", "rect", box({ opacity: 0, borderWidth: 8 }, { show: false }))}
        {overlay("Dashed", "rect", box({ opacity: 0.12, borderWidth: 6, dashed: true }, { show: false }))}
        {overlay("Circle", "ellipse", box({ w: 220, h: 220, opacity: 0, borderWidth: 8 }, { show: false }))}
        <Tile label="Polygon" onClick={() => tool("polygon")}><Glyph><path d="M16 3l10 7-4 11H10L6 10z" {...fill} /></Glyph></Tile>
      </>
    ),
    arrows: (
      <>
        {overlay("Arrow", "arrow")}
        {overlay("Double", "arrow", { arrowA: true })}
        {overlay("Dashed", "arrow", { dashed: true })}
        {overlay("Thick", "arrow", { width: 22 })}
        {overlay("Line", "line")}
        {overlay("Dashed line", "line", { dashed: true })}
        {overlay("Point", "point")}
      </>
    ),
    text: (
      <>
        {overlay("Text", "text")}
        {overlay("Title", "text", box({ w: 620, h: 150 }, { text: "Title", size: 110 }))}
        {overlay("Label", "rect", box({ w: 300, h: 90, radius: 45, opacity: 1, borderWidth: 0, color: "#111827" }, { text: "Label", size: 40 }))}
        {overlay("Caption", "rect", box({ w: 640, h: 120, radius: 16, opacity: 0.75, borderWidth: 0, color: "#000000" }, { text: "Caption", size: 44 }))}
        {overlay("Number", "ellipse", box({ w: 96, h: 96, opacity: 1, borderWidth: 0, color: YELLOW }, { text: badgeNumber(), size: 52, color: "#000000" }))}
        {overlay("Sticky", "rect", box({ w: 300, h: 220, radius: 10, opacity: 1, borderWidth: 0, color: YELLOW }, { text: "Note", size: 44, color: "#000000" }))}
      </>
    ),
    icons: (
      <>
        {MARKERS.map((marker) => (
          <Tile key={marker.name} label={marker.name} onClick={() => addMarker(marker.svg)}>
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden><path d={marker.path} /></svg>
          </Tile>
        ))}
      </>
    ),
    animated: (
      <>
        {overlay("Pulsing zone", "rect", { anim: anim("pulse") }, "animate")}
        {overlay("Spotlight", "ellipse", { ...box({ w: 320, h: 320, opacity: 0, borderWidth: 6 }, { show: false }), anim: anim("spotlight", 2) }, "animate")}
        {overlay("Marching", "rect", { ...box({ opacity: 0.1, borderWidth: 6 }, { show: false }), anim: anim("ants", 2) }, "animate")}
        {overlay("Drawn arrow", "arrow", { anim: anim("draw", 2.5) }, "animate")}
        {overlay("Train line", "line", { anim: anim("train", 2) }, "animate")}
        {overlay("Ripple point", "point", { anim: anim("ripple", 2) }, "animate")}
        <Tile label="Bouncing pin" onClick={() => addMarker(pin.svg, anim("bounce", 1))}>
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden><path d={pin.path} /></svg>
        </Tile>
        {overlay("Pop label", "rect", { ...box({ w: 300, h: 90, radius: 45, opacity: 1, borderWidth: 0, color: YELLOW }, { text: "Look here", size: 40, color: "#000000" }), anim: anim("pop", 3) }, "animate")}
      </>
    ),
    images: (
      <>
        <Tile label="Upload" onClick={upload}><Glyph><path d="M16 16V5M11 10l5-5 5 5M6 16v4h20v-4" /></Glyph></Tile>
        {used.map(([key, asset]) => (
          <Tile key={key} label="Reuse" onClick={() => addAsset(asset)}>
            <img
              src={asset.format === "svg" ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(asset.data)}` : asset.data}
              alt=""
              className={`w-9 h-7 object-contain ${asset.format === "svg" ? "invert" : ""}`}
            />
          </Tile>
        ))}
      </>
    ),
  };

  return (
    <div className="space-y-2 lg:space-y-4">
      {/* Section tabs: phone only */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:hidden" role="tablist" aria-label="Kinds of overlay">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            onClick={() => setSection(item.id)}
            className={`shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap ${section === item.id ? "bg-fg text-ink" : "text-fg-muted hover:text-fg"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Wide: ready-made sets or single overlays */}
      <div className="hidden lg:grid grid-cols-2 gap-1 p-1 rounded-control bg-chip" role="tablist" aria-label="What to add">
        {([["templates", "Templates"], ["zones", "Shapes & text"]] as const).map(([id, label]) => {
          const on = (section === "templates") === (id === "templates");
          return <button key={id} type="button" role="tab" aria-selected={on} onClick={() => { if (!on) setSection(id); }} className={`h-8 rounded-[7px] text-[13px] font-semibold transition-colors ${on ? "bg-chip-active text-fg" : "text-fg-muted hover:text-fg"}`}>{label}</button>;
        })}
      </div>

      {section === "templates" && (
        <section aria-label="Templates">
          <TemplateGallery items={gallery} />
          <button type="button" onClick={saveAll} className="mt-3 w-full h-10 rounded-control bg-chip hover:bg-chip-hover text-[13px] font-semibold text-fg">Save current overlays as a template</button>
        </section>
      )}
      {SECTIONS.filter((item) => item.id !== "templates").map((item) => (
        <section key={item.id} aria-label={item.label} className={section === item.id ? "" : section === "templates" ? "hidden" : "hidden lg:block"}>
          <h3 className="hidden lg:block mb-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">{item.label}</h3>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {content[item.id]}
          </div>
          {item.id === "icons" && <div className="mt-3"><IconSearch onPick={(svg) => addMarker(svg)} /></div>}
        </section>
      ))}
    </div>
  );
}
