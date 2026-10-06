import { videoLength } from "../../engine/scene";
import type { El, Timing } from "../../engine/types";
import { selectedElement, useEditor } from "../../editor/store";
import { Button, Chip, Row, Slider } from "../kit";

const round2 = (v: number) => Math.round(v * 100) / 100;

/** When the selected element is on screen: bind it to moments of the video. */
export function TimingPanel() {
  const el = useEditor(selectedElement);
  const { patch, commit, scene, narration, preview, time, seek } = useEditor();

  if (!el) return <p className="text-[13px] text-fg-muted py-3">Tap an overlay on the photo to set when it appears.</p>;

  const total = Math.max(videoLength(scene, narration?.duration).seconds, 3);
  const playhead = preview ? round2(time) : 0;

  // Sketched strokes carry their own timing: they can be shifted along the timeline
  if (el.type === "path" && el.sketch) {
    const sketch = el.sketch;
    const setStart = (start: number) => patch(el.id, { sketch: { ...sketch, start: round2(start) } } as Partial<El>);
    return (
      <div className="space-y-1">
        <p className="text-[13px] text-fg-muted">This stroke is drawn starting at {sketch.start.toFixed(1)}s.</p>
        <Slider label="Starts at" value={sketch.start} min={0} max={total + 5} step={0.1} onChange={setStart} format={(v) => `${v.toFixed(1)}s`} />
        <Row>
          <Chip onClick={() => { setStart(playhead); commit(); }}>Start at playhead ({playhead.toFixed(1)}s)</Chip>
          <Chip onClick={() => seek(sketch.start)}>Go to its start</Chip>
        </Row>
      </div>
    );
  }

  const range = el.time;
  const setRange = (changes: Partial<Timing> | null) =>
    patch(el.id, { time: changes === null ? undefined : { start: 0, end: null, fade: 0.2, ...range, ...changes } });
  const apply = (changes: Partial<Timing> | null) => { setRange(changes); commit(); };

  return (
    <div className="space-y-1">
      <p className="text-[13px] text-fg-muted">
        {range
          ? `On screen from ${range.start.toFixed(1)}s ${range.end === null ? "to the end" : `to ${range.end.toFixed(1)}s`}.`
          : "On screen for the whole video."}
      </p>
      {range && (
        <>
          <Slider label="Appears" value={range.start} min={0} max={total} step={0.1} format={(v) => `${v.toFixed(1)}s`}
            onChange={(start) => setRange({ start, end: range.end !== null && range.end < start + 0.1 ? round2(start + 0.1) : range.end })} />
          {range.end !== null && (
            <Slider label="Disappears" value={range.end} min={0} max={total + 5} step={0.1} format={(v) => `${v.toFixed(1)}s`}
              onChange={(end) => setRange({ end: Math.max(round2(range.start + 0.1), end) })} />
          )}
          <Slider label="Fade" value={range.fade} min={0} max={1.5} step={0.05} format={(v) => `${v.toFixed(2)}s`} onChange={(fade) => setRange({ fade })} />
        </>
      )}
      {range && (
        <Row>
          <span className="shrink-0 text-[13px] text-fg-muted w-20">Shift</span>
          {[-0.5, -0.1, 0.1, 0.5].map((dt) => (
            <Chip key={dt} disabled={range.start + dt < 0} onClick={() => apply({ start: round2(range.start + dt), end: range.end === null ? null : round2(range.end + dt) })}>
              {dt > 0 ? "+" : "−"}{Math.abs(dt)}s
            </Chip>
          ))}
        </Row>
      )}
      <Row>
        <Chip onClick={() => apply({ start: playhead, end: range && range.end !== null && range.end <= playhead ? null : range?.end ?? null })}>Appear at {playhead.toFixed(1)}s</Chip>
        <Chip disabled={playhead <= (range?.start ?? 0)} onClick={() => apply({ end: playhead })}>Disappear at {playhead.toFixed(1)}s</Chip>
        {range && range.end !== null && <Chip onClick={() => apply({ end: null })}>Stay to the end</Chip>}
        {range && <Chip onClick={() => apply(null)}>Whole video</Chip>}
        {range && <Chip onClick={() => seek(range.start)}>Go to its start</Chip>}
      </Row>
      {!preview && <Button className="w-full" onClick={() => seek(range?.start ?? 0)}>Open frame view to pick a moment</Button>}
    </div>
  );
}
