import { videoLength } from "../../engine/scene";
import type { Stage } from "../../engine/types";
import { useEditor } from "../../editor/store";
import { GRIDS, useHelpers } from "../../editor/helpers";
import { Button, Chip, ConfirmButton, Row, Slider, Toggle } from "../kit";
import { pickFile } from "../util";
import { m, t, secs, type Msg } from "../../i18n";

const RATIOS: { value: Stage["aspect"]; label: string }[] = [
  { value: "image", label: "Photo" },
  { value: "9:16", label: "9:16" },
  { value: "4:5", label: "4:5" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
];
const BACKGROUNDS = ["#2c2c2e", "#000000", "#ffffff", "#1e293b", "#f1f5f9"];

const GRID_NAMES: Record<(typeof GRIDS)[number], Msg> = { off: m("Off"), thirds: m("Thirds"), squares: m("Squares"), fine: m("Fine") };

/** Grid, rulers, snapping and the magnifier: aids for placing things precisely. They are not part of the video. */
function Helpers() {
  const { grid, rulers, snap, loupe, change } = useHelpers();
  return (
    <section className="space-y-2 pt-3" aria-label={t("Helpers")}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">{t("Helpers")}</h3>
      <Row>
        <span className="shrink-0 text-[13px] text-fg-muted w-16">{t("Grid")}</span>
        {GRIDS.map((kind) => <Chip key={kind} active={grid === kind} onClick={() => change({ grid: kind })}>{t(GRID_NAMES[kind])}</Chip>)}
      </Row>
      <Toggle label={t("Rulers")} checked={rulers} onChange={(on) => change({ rulers: on })} />
      <Toggle label={t("Align to overlays and edges")} checked={snap} onChange={(on) => change({ snap: on })} />
      <Toggle label={t("Magnifier while dragging")} checked={loupe} onChange={(on) => change({ loupe: on })} />
      <p className="text-[12px] leading-snug text-fg-subtle">{t("Helpers are not part of the video. Hold Alt while dragging to move freely.")}</p>
    </section>
  );
}

/** Photo, frame shape, background and video length. */
export function CanvasPanel() {
  const { scene, image, setStage, setPhoto, commit, setScene, narration } = useEditor();
  const { stage } = scene;
  const length = videoLength(scene, narration?.duration);
  const describe = { custom: t("fixed length"), story: t("follows the sketch and audio"), loop: length.seamless ? t("seamless loop") : t("loop"), still: t("no animation yet") }[length.kind];

  const choosePhoto = async () => {
    const file = await pickFile("image/*");
    if (file) await setPhoto(file);
  };
  const setDuration = (duration: typeof scene.duration) => setScene({ ...scene, duration });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button onClick={choosePhoto} className="flex-1">{image ? t("Replace photo") : t("Choose photo")}</Button>
        {image && <ConfirmButton label={t("Remove")} confirmLabel={t("Remove photo?")} onConfirm={() => setPhoto(null)} />}
      </div>
      <Row>
        {RATIOS.map((ratio) => (
          <Chip key={ratio.value} active={stage.aspect === ratio.value} disabled={ratio.value === "image" && !image} onClick={() => { setStage({ aspect: ratio.value }); commit(); }}>
            {ratio.value === "image" ? t("Photo") : ratio.label}
          </Chip>
        ))}
        {image && stage.aspect !== "image" && (
          <>
            <span className="shrink-0 w-px h-6 bg-chip" />
            <Chip active={stage.fit === "contain"} onClick={() => { setStage({ fit: "contain" }); commit(); }}>{t("Fit")}</Chip>
            <Chip active={stage.fit === "cover"} onClick={() => { setStage({ fit: "cover" }); commit(); }}>{t("Fill~photo")}</Chip>
          </>
        )}
      </Row>
      <Row>
        <span className="shrink-0 text-[13px] text-fg-muted w-20">{t("Background")}</span>
        {BACKGROUNDS.map((color) => (
          <button key={color} type="button" aria-label={t("Background {color}", { color })} onClick={() => { setStage({ bg: color }); commit(); }} className={`shrink-0 w-9 h-9 rounded-full border ${stage.bg === color ? "border-line" : "border-line"}`} style={{ background: color }} />
        ))}
      </Row>
      {image && <Slider label={t("Dim photo")} value={stage.dim} min={0} max={0.9} step={0.05} onChange={(dim) => setStage({ dim })} format={(v) => `${Math.round(v * 100)}%`} />}
      <Row>
        <span className="shrink-0 text-[13px] text-fg-muted w-20">{t("Length~video")}</span>
        <Chip active={scene.duration.mode === "auto"} onClick={() => { setDuration({ ...scene.duration, mode: "auto" }); commit(); }}>{t("Auto")}</Chip>
        <Chip active={scene.duration.mode === "custom"} onClick={() => { setDuration({ ...scene.duration, mode: "custom" }); commit(); }}>{t("Custom")}</Chip>
      </Row>
      <p className="text-[12px] text-fg-muted">{t("{seconds}s · {what}", { seconds: length.seconds.toFixed(1), what: describe })}</p>
      {scene.duration.mode === "custom" && <Slider label={t("Seconds")} value={scene.duration.seconds} min={1} max={60} step={0.5} onChange={(seconds) => setDuration({ mode: "custom", seconds })} format={(v) => `${secs(v, 1)}`} />}
      <Helpers />
    </div>
  );
}
