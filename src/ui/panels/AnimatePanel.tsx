import { ANIMATIONS, animationsFor } from "../../engine/animations";
import type { AnimType, El } from "../../engine/types";
import { selectedElement, useEditor } from "../../editor/store";
import { MiniPreview } from "../MiniPreview";
import { Button, ColorRow, Slider, Toggle } from "../kit";

const GROUPS = ["Motion", "Attention", "Reveal", "Path", "Effects"] as const;

/** A tile that shows the animation running on a small sample shape. */
function AnimTile({ label, on, onClick, sample }: { label: string; on: boolean; onClick: () => void; sample: El }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 w-[84px] lg:w-auto rounded-control overflow-hidden text-left transition-colors ${on ? "bg-chip-active ring-2 ring-brand" : "bg-chip hover:bg-chip-hover"}`}
    >
      <MiniPreview el={sample} animate={sample.anim.enabled} className="block w-full h-12" />
      <span className={`block px-2 pb-1.5 text-[12px] font-medium truncate ${on ? "text-brand" : "text-fg-muted"}`}>{label}</span>
    </button>
  );
}

export function AnimatePanel() {
  const el = useEditor(selectedElement);
  const { patch, commit, play, scene } = useEditor();

  if (!el) return <p className="text-[13px] text-fg-muted py-3">Tap an overlay on the photo to animate it.</p>;

  const options = animationsFor(el.type);
  // The sample moves like the real thing would: a stroke for path animations, a shape otherwise
  const sample = (type: AnimType | null): El => {
    const anim = { enabled: type !== null, type: type ?? "pulse", duration: 1.6, delay: 0, intensity: 1 } as const;
    const common = { id: "sample", name: "", color: el.color, visible: true, anim };
    if (type && ANIMATIONS[type].only?.includes("line") && !ANIMATIONS[type].only?.includes("box")) {
      return { ...common, type: "line", opacity: 1, a: { x: 0, y: 0 }, b: { x: 360, y: 0 }, width: 22, arrowA: false, arrowB: false, dashed: false };
    }
    return { ...common, type: "box", opacity: 0.45, x: 0, y: 0, w: 200, h: 150, rot: 0, shape: "rect", radius: 26, borderWidth: 12, dashed: false, label: { text: "", show: false, color: "#fff", size: 30 } };
  };
  const setAnim = (changes: Partial<typeof el.anim>) => patch(el.id, { anim: { ...el.anim, ...changes } });

  const isTrain = el.anim.type === "train" || el.anim.type === "trainLoop";
  const train = el.anim.train ?? {};

  const choose = (type: AnimType | null) => {
    setAnim(type ? { type, enabled: true } : { enabled: false });
    commit();
    if (type) play(); // show it straight away
  };

  const applyToAll = () => {
    for (const other of scene.elements) {
      if (other.id !== el.id && animationsFor(other.type).includes(el.anim.type)) patch(other.id, { anim: { ...el.anim } });
    }
    commit();
    play();
  };

  return (
    <div className="space-y-2">
      {el.anim.enabled && (
        <div>
          <Slider label="Speed" value={el.anim.duration} min={0.3} max={8} step={0.1} onChange={(duration) => setAnim({ duration })} format={(v) => `${v.toFixed(1)}s`} />
          <Slider label="Delay" value={el.anim.delay} min={0} max={5} step={0.1} onChange={(delay) => setAnim({ delay })} format={(v) => `${v.toFixed(1)}s`} />
          <Slider label="Strength" value={el.anim.intensity} min={0.2} max={2.5} step={0.1} onChange={(intensity) => setAnim({ intensity })} format={(v) => `${Math.round(v * 100)}%`} />
          {isTrain && (
            <>
              <Slider label="Length" value={train.length ?? 0.18} min={0.04} max={0.6} step={0.01} onChange={(length) => setAnim({ train: { ...train, length } })} format={(v) => `${Math.round(v * 100)}%`} />
              <Slider label="Glow" value={train.glow ?? 1} min={0} max={3} step={0.1} onChange={(glow) => setAnim({ train: { ...train, glow } })} format={(v) => `${Math.round(v * 100)}%`} />
              <Toggle label="Light in its own color" checked={!!train.color} onChange={(on) => { setAnim({ train: { ...train, color: on ? "#ffffff" : undefined } }); commit(); }} />
              {train.color && <ColorRow value={train.color} onChange={(color) => setAnim({ train: { ...train, color } })} />}
            </>
          )}
          {scene.elements.length > 1 && <Button onClick={applyToAll} className="w-full">Apply to all overlays</Button>}
        </div>
      )}
      {/* Phone: one scrolling row of live tiles */}
      <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        <AnimTile label="None" on={!el.anim.enabled} onClick={() => choose(null)} sample={sample(null)} />
        {options.map((type) => <AnimTile key={type} label={ANIMATIONS[type].label} on={el.anim.enabled && el.anim.type === type} onClick={() => choose(type)} sample={sample(type)} />)}
      </div>

      {/* Wide: grouped by what the animation does */}
      <div className="hidden lg:block space-y-3">
        {GROUPS.map((group, index) => {
          const items = options.filter((type) => ANIMATIONS[type].group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <h4 className="mb-1.5 text-[12px] font-medium text-fg-muted">{group}</h4>
              <div className="grid grid-cols-3 gap-1.5">
                {index === 0 && <AnimTile label="None" on={!el.anim.enabled} onClick={() => choose(null)} sample={sample(null)} />}
                {items.map((type) => <AnimTile key={type} label={ANIMATIONS[type].label} on={el.anim.enabled && el.anim.type === type} onClick={() => choose(type)} sample={sample(type)} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
