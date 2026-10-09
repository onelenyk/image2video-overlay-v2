import { useEditor, type Mode, type SketchStyle } from "../../editor/store";
import { Button, Chip, ColorRow, ConfirmButton, Row, Slider } from "../kit";
import { VoiceRecorder } from "../VoiceRecorder";
import { pickFile } from "../util";
import { m, t, type Msg } from "../../i18n";

const STYLES: { value: SketchStyle; label: Msg }[] = [
  { value: "pen", label: m("Pen") },
  { value: "marker", label: m("Marker") },
  { value: "neon", label: m("Neon") },
];
const HOLDS: { value: number | null; label: Msg }[] = [
  { value: null, label: m("Stays") },
  { value: 1, label: m("Fades 1s") },
  { value: 2, label: m("Fades 2s") },
  { value: 4, label: m("Fades 4s") },
];

const HAND_TOOLS: { mode: Mode; label: Msg; hint: Msg }[] = [
  { mode: "draw", label: m("Freehand"), hint: m("Draw a line with your finger") },
  { mode: "line", label: m("Straight"), hint: m("Drag from start to end") },
  { mode: "polygon", label: m("Polygon"), hint: m("Tap to place corners") },
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
          <Chip key={tool.mode} active={mode === tool.mode} title={t(tool.hint)} disabled={recording} onClick={() => { setMode(mode === tool.mode ? "select" : tool.mode); if (!wide) setTool(null); }}>
            {t(tool.label)}
          </Chip>
        ))}
      </Row>

      {/* Pen: used by every drawing tool */}
      <ColorRow value={sketch.color} onChange={(color) => setSketch({ color })} />
      <Slider label={t("Thickness")} value={sketch.width} min={2} max={30} onChange={(width) => setSketch({ width })} />
      <Row>
        {STYLES.map((s) => <Chip key={s.value} active={sketch.style === s.value} onClick={() => setSketch({ style: s.value })}>{t(s.label)}</Chip>)}
      </Row>

      {/* Sketch while you talk */}
      <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">{t("Sketch while you talk")}</h3>
      <div className="flex flex-wrap gap-2">
        {/* The main action takes the whole line; the audio buttons share the next one */}
        <button
          type="button"
          onClick={recording ? stopSketch : startSketch}
          className={`w-full h-12 rounded-control text-[14px] font-bold flex items-center justify-center gap-2 whitespace-nowrap ${recording ? "bg-chip-active text-fg" : "bg-accent hover:brightness-110 text-white"}`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${recording ? "bg-accent animate-pulse" : "bg-white"}`} />
          {recording ? t("Stop · {time}s", { time: time.toFixed(1) }) : strokes ? t("Continue sketching") : t("Start sketching")}
        </button>
        {narration
          ? <ConfirmButton label={t("Remove audio")} confirmLabel={t("Remove?")} onConfirm={() => setNarration(null)} className="flex-1" />
          : <>
            <Button onClick={pickAudio} className="flex-1 whitespace-nowrap">{t("Add audio")}</Button>
            <VoiceRecorder onDone={(file) => setNarration(file)} className="flex-1 !h-11" />
          </>}
      </div>
      <p className="text-[12px] text-fg-muted">
        {recording
          ? t("Circle and underline things on the photo while you talk.")
          : narration
            ? t("Audio: {name} ({duration}s). It plays while you sketch and goes into the video.", { name: narration.name, duration: narration.duration.toFixed(1) })
            : t("Press start, then draw on the photo while you talk. Each stroke replays with the same timing.")}
      </p>
      <Row>
        {HOLDS.map((h) => <Chip key={String(h.value)} active={sketch.hold === h.value} onClick={() => setSketch({ hold: h.value })}>{t(h.label)}</Chip>)}
        {strokes > 0 && !recording && <ConfirmButton label={t("Clear {n}", { n: strokes })} confirmLabel={t("Clear all?")} onConfirm={clear} className="shrink-0 !h-10 !rounded-full" />}
      </Row>
    </div>
  );
}
