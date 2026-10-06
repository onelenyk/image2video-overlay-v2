import { useEditor, type Mode, type SketchStyle } from "../../editor/store";
import { Button, Chip, ColorRow, ConfirmButton, Row, Slider } from "../kit";
import { VoiceRecorder } from "../VoiceRecorder";
import { pickFile } from "../util";

const STYLES: { value: SketchStyle; label: string }[] = [
  { value: "pen", label: "Pen" },
  { value: "marker", label: "Marker" },
  { value: "neon", label: "Neon" },
];
const HOLDS: { value: number | null; label: string }[] = [
  { value: null, label: "Stays" },
  { value: 1, label: "Fades 1s" },
  { value: 2, label: "Fades 2s" },
  { value: 4, label: "Fades 4s" },
];

const HAND_TOOLS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "draw", label: "Freehand", hint: "Draw a line with your finger" },
  { mode: "line", label: "Straight", hint: "Drag from start to end" },
  { mode: "polygon", label: "Polygon", hint: "Tap to place corners" },
];

/**
 * Everything drawn by hand: one-off strokes with the pen below, and live
 * sketching, where strokes replay in the video with the timing they were drawn with.
 */
export function SketchPanel() {
  const { mode, sketch, setSketch, startSketch, stopSketch, scene, setScene, commit, narration, setNarration, time, setMode, setTool } = useEditor();
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  const recording = mode === "sketch";
  const strokes = scene.elements.filter((el) => el.type === "path" && el.sketch).length;

  const clear = () => {
    setScene({ ...scene, elements: scene.elements.filter((el) => !(el.type === "path" && el.sketch)) });
    commit();
  };

  const pickAudio = async () => {
    const file = await pickFile("audio/*");
    if (file) await setNarration(file);
  };

  return (
    <div className="space-y-2">
      {/* Draw once */}
      <Row>
        {HAND_TOOLS.map((tool) => (
          <Chip key={tool.mode} active={mode === tool.mode} title={tool.hint} disabled={recording} onClick={() => { setMode(mode === tool.mode ? "select" : tool.mode); if (!wide) setTool(null); }}>
            {tool.label}
          </Chip>
        ))}
      </Row>

      {/* Pen: used by every drawing tool */}
      <ColorRow value={sketch.color} onChange={(color) => setSketch({ color })} />
      <Slider label="Thickness" value={sketch.width} min={2} max={30} onChange={(width) => setSketch({ width })} />
      <Row>
        {STYLES.map((s) => <Chip key={s.value} active={sketch.style === s.value} onClick={() => setSketch({ style: s.value })}>{s.label}</Chip>)}
      </Row>

      {/* Sketch while you talk */}
      <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">Sketch while you talk</h3>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={recording ? stopSketch : startSketch}
          className={`flex-1 h-12 rounded-control text-[14px] font-bold flex items-center justify-center gap-2 ${recording ? "bg-chip-active text-fg" : "bg-accent hover:brightness-110 text-white"}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${recording ? "bg-accent animate-pulse" : "bg-white"}`} />
          {recording ? `Stop · ${time.toFixed(1)}s` : strokes ? "Continue sketching" : "Start sketching"}
        </button>
        {narration
          ? <ConfirmButton label="Remove audio" confirmLabel="Remove?" onConfirm={() => setNarration(null)} className="!h-12" />
          : <>
            <Button onClick={pickAudio} className="!h-12">Add audio</Button>
            <VoiceRecorder onDone={(file) => setNarration(file)} className="!h-12" />
          </>}
      </div>
      <p className="text-[12px] text-fg-muted">
        {recording
          ? "Circle and underline things on the photo while you talk."
          : narration
            ? `Audio: ${narration.name} (${narration.duration.toFixed(1)}s). It plays while you sketch and goes into the video.`
            : "Press start, then draw on the photo while you talk. Each stroke replays with the same timing."}
      </p>
      <Row>
        {HOLDS.map((h) => <Chip key={String(h.value)} active={sketch.hold === h.value} onClick={() => setSketch({ hold: h.value })}>{h.label}</Chip>)}
        {strokes > 0 && !recording && <ConfirmButton label={`Clear ${strokes}`} confirmLabel="Clear all?" onConfirm={clear} className="shrink-0 !h-10 !rounded-full" />}
      </Row>
    </div>
  );
}
