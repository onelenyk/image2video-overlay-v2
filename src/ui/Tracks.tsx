import { useState } from "react";
import { ANIMATIONS } from "../engine/animations";
import { hexToRgb } from "../engine/renderer";
import type { El, PathEl } from "../engine/types";
import { useEditor } from "../editor/store";

// One row per overlay under the filmstrip: a bar shows when the element is on
// screen. Drag the bar to move it in time, drag its ends to change when it
// appears and disappears. Sketched strokes share one row.

const round1 = (v: number) => Math.round(v * 10) / 10;
type Sketched = PathEl & { sketch: NonNullable<PathEl["sketch"]> };
const isSketch = (el: El): el is Sketched => el.type === "path" && !!el.sketch;

/** Follows a pointer drag and reports the horizontal distance in seconds. */
function dragSeconds(e: React.PointerEvent<HTMLElement>, secondsPerPx: number, onMove: (seconds: number) => void, onEnd: (moved: boolean) => void) {
  e.stopPropagation();
  const target = e.currentTarget;
  const startX = e.clientX;
  let moved = false;
  try { target.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    if (!moved && Math.abs(dx) < 3) return;
    moved = true;
    onMove(dx * secondsPerPx);
  };
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    target.removeEventListener("pointercancel", up);
    onEnd(moved);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
}

function Ruler({ duration }: { duration: number }) {
  const step = [0.5, 1, 2, 5, 10, 15, 30].find((s) => duration / s <= 10) ?? 60;
  const marks = [];
  for (let t = 0; t <= duration + 1e-6; t += step) marks.push(t);
  return (
    <div className="relative h-4 text-[10px] font-mono text-fg-subtle select-none" aria-hidden>
      {marks.map((t) => (
        <span key={t} className="absolute top-0 bottom-0 border-l border-line pl-1" style={{ left: `${(t / duration) * 100}%` }}>
          {Number.isInteger(t) ? `${t}s` : t.toFixed(1)}
        </span>
      ))}
    </div>
  );
}

function ElementRow({ el, duration, width }: { el: El; duration: number; width: number }) {
  const selected = useEditor((s) => s.selectedId === el.id);
  const { patch, commit, select } = useEditor();
  const start = el.time?.start ?? 0;
  const end = el.time?.end ?? duration;
  const left = Math.min(1, start / duration);
  const right = Math.min(1, Math.max(start, end) / duration);

  const drag = (e: React.PointerEvent<HTMLElement>, part: "body" | "start" | "end") => {
    select(el.id);
    const origin = { start, end, fade: el.time?.fade ?? 0.2, open: !el.time || el.time.end === null, bound: !!el.time };
    const length = duration; // frozen for the drag: the video length may change while dragging
    dragSeconds(e, length / Math.max(1, width), (dt) => {
      if (part === "body") {
        if (!origin.bound) return; // "whole video" has nowhere to move
        const s = Math.max(0, round1(origin.start + dt));
        patch(el.id, { time: { start: s, end: origin.open ? null : round1(s + (origin.end - origin.start)), fade: origin.fade } });
      } else if (part === "start") {
        const s = Math.min(Math.max(0, round1(origin.start + dt)), origin.end - 0.1);
        patch(el.id, { time: { start: s, end: origin.open ? null : origin.end, fade: origin.fade } });
      } else {
        patch(el.id, { time: { start: origin.start, end: Math.max(round1(origin.start + 0.1), round1(origin.end + dt)), fade: origin.fade } });
      }
    }, (moved) => { if (moved) commit(); });
  };

  // Marks where each animation cycle starts
  const cycles: number[] = [];
  if (el.anim.enabled && el.anim.duration > 0) {
    for (let t = start + el.anim.duration; t < end - 0.01 && cycles.length < 60; t += el.anim.duration) cycles.push((t - start) / Math.max(0.01, end - start));
  }

  // Near-black overlays would vanish on the dark track: show those bars in grey
  const [r, g, b] = hexToRgb(el.color);
  const tone = 0.299 * r + 0.587 * g + 0.114 * b < 60 ? "#48484a" : el.color;

  return (
    <div className="relative h-7">
      <div className="absolute inset-x-0 top-0.5 bottom-0.5 rounded bg-chip/60" />
      <div
        className={`absolute top-0.5 bottom-0.5 rounded overflow-hidden cursor-grab active:cursor-grabbing ${selected ? "ring-2 ring-brand" : "ring-1 ring-line"} ${el.visible ? "" : "opacity-40"}`}
        style={{ left: `${left * 100}%`, width: `max(14px, ${(right - left) * 100}%)`, background: tone, touchAction: "none" }}
        onPointerDown={(e) => drag(e, "body")}
        title={`${el.name}: ${start.toFixed(1)}s – ${el.time?.end == null ? "end" : end.toFixed(1) + "s"}`}
      >
        <div className={`absolute inset-0 ${el.time ? "bg-black/25" : "bg-black/55"}`} />
        {cycles.map((p, i) => <span key={i} className="absolute top-0 bottom-0 w-px bg-white/50" style={{ left: `${p * 100}%` }} />)}
        <span className="absolute inset-y-0 left-3 right-3 flex items-center gap-1.5 text-[11px] font-semibold text-white whitespace-nowrap overflow-hidden pointer-events-none [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
          <span className="truncate">{el.name}</span>
          {el.anim.enabled && <span className="shrink-0 px-1 rounded bg-black/50 text-[10px] uppercase tracking-wide">{ANIMATIONS[el.anim.type].label}</span>}
          {!el.time && <span className="shrink-0 text-[10px] font-normal text-white/70">whole video</span>}
        </span>
        <span className="absolute inset-y-0 left-0 w-2.5 bg-white/70 cursor-ew-resize" onPointerDown={(e) => drag(e, "start")} aria-label={`Start of ${el.name}`} />
        <span className="absolute inset-y-0 right-0 w-2.5 bg-white/70 cursor-ew-resize" onPointerDown={(e) => drag(e, "end")} aria-label={`End of ${el.name}`} />
      </div>
    </div>
  );
}

function SketchRow({ strokes, duration, width }: { strokes: Sketched[]; duration: number; width: number }) {
  const selectedId = useEditor((s) => s.selectedId);
  const { patch, commit, select } = useEditor();
  return (
    <div className="relative h-7">
      <span className="absolute inset-y-0 left-1 flex items-center text-[10px] uppercase tracking-wide text-fg-subtle pointer-events-none">Sketch</span>
      {strokes.map((el) => {
        const drawn = el.sketch.times[el.sketch.times.length - 1] ?? 0;
        const hold = el.sketch.hold === null ? duration - el.sketch.start - drawn : el.sketch.hold + el.sketch.fade;
        const pct = (seconds: number) => `${Math.min(100, Math.max(0, (seconds / duration) * 100))}%`;
        return (
          <div
            key={el.id}
            className={`absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing ${el.id === selectedId ? "ring-2 ring-brand z-10" : ""}`}
            style={{ left: pct(el.sketch.start), width: `max(8px, ${pct(drawn + Math.max(0, hold))})`, background: `${el.color}55`, touchAction: "none" }}
            title={`${el.name}: drawn ${el.sketch.start.toFixed(1)}s – ${(el.sketch.start + drawn).toFixed(1)}s`}
            onPointerDown={(e) => {
              select(el.id);
              const origin = el.sketch.start;
              dragSeconds(e, duration / Math.max(1, width), (dt) => patch(el.id, { sketch: { ...el.sketch, start: Math.max(0, round1(origin + dt)) } } as Partial<El>), (moved) => { if (moved) commit(); });
            }}
          >
            {/* Solid part = while the stroke is being drawn; the rest = while it stays */}
            <span className="absolute inset-y-0 left-0 rounded" style={{ width: `max(6px, ${(drawn / Math.max(0.01, drawn + Math.max(0, hold))) * 100}%)`, background: el.color }} />
          </div>
        );
      })}
    </div>
  );
}

export function Tracks({ duration, width, playhead }: { duration: number; width: number; playhead: number | null }) {
  const elements = useEditor((s) => s.scene.elements);
  const groups = useEditor((s) => s.scene.groups);
  const groupSel = useEditor((s) => s.groupSel);
  const selectGroup = useEditor((s) => s.selectGroup);
  // Open by default where there is room; on a phone the canvas needs the space
  const [open, setOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  // Same grouping as the Overlays list: ready-made first, then everything drawn by hand
  const strokes = elements.filter(isSketch);
  const drawn = elements.filter((el) => el.type === "path" && !isSketch(el)).reverse();
  const others = elements.filter((el) => el.type !== "path").reverse();
  // Rows of one group stay together under its name, in the order the groups first appear
  const groupIds = [...new Set(others.map((el) => el.group).filter((g): g is string => !!g))];
  const loose = others.filter((el) => !el.group);
  if (!elements.length) return null;
  const rows = others.length + drawn.length + (strokes.length ? 1 : 0);

  return (
    <div className="mt-1">
      <button type="button" onClick={() => setOpen((v) => !v)} className="h-7 text-[11px] font-semibold uppercase tracking-widest text-fg-subtle hover:text-fg-muted" aria-expanded={open}>
        {open ? "▾" : "▸"} Tracks · {rows}
      </button>
      {open && (
        // A fixed height: new tracks fill it downwards (then scroll) instead of pushing the photo smaller
        <div className="relative h-[22dvh] overflow-y-auto no-scrollbar">
          <Ruler duration={duration} />
          {groupIds.map((id) => (
            <div key={id} className={`my-0.5 rounded ${groupSel === id ? "bg-brand/10" : "bg-white/[0.04]"}`}>
              <button type="button" onClick={() => selectGroup(id)} className={`block w-full h-5 px-1.5 text-left text-[10px] font-semibold uppercase tracking-wide truncate ${groupSel === id ? "text-brand" : "text-fg-subtle hover:text-fg-muted"}`}>
                {groups?.[id]?.name ?? "Group"}
              </button>
              {others.filter((el) => el.group === id).map((el) => <ElementRow key={el.id} el={el} duration={duration} width={width} />)}
            </div>
          ))}
          {loose.map((el) => <ElementRow key={el.id} el={el} duration={duration} width={width} />)}
          {(strokes.length > 0 || drawn.length > 0) && others.length > 0 && <div className="h-px my-1 bg-line" />}
          {strokes.length > 0 && <SketchRow strokes={strokes} duration={duration} width={width} />}
          {drawn.map((el) => <ElementRow key={el.id} el={el} duration={duration} width={width} />)}
          {playhead !== null && <div className="absolute top-0 bottom-0 w-[3px] rounded-full bg-white shadow-[0_0_4px_rgba(0,0,0,0.9)] pointer-events-none z-20" style={{ left: `calc(${Math.min(1, playhead / duration) * 100}% - 1px)` }} />}
        </div>
      )}
    </div>
  );
}
