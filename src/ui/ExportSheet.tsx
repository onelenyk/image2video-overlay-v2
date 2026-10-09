import { useEffect, useRef, useState } from "react";
import { canExportOffline, exportPng, exportVideo, pickSize, type ExportResult, type Quality } from "../engine/exporter";
import { videoLength } from "../engine/scene";
import { narrationData, useEditor } from "../editor/store";
import { Button, Chip, Icon, IconButton, Row } from "./kit";
import { t } from "../i18n";

const QUALITIES: { value: Quality; label: string }[] = [
  { value: "720", label: "720p" },
  { value: "1080", label: "1080p" },
  { value: "1440", label: "1440p" },
  { value: "4k", label: "4K" },
  { value: "native", label: "Photo size" },
];

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function ExportSheet({ onClose }: { onClose: () => void }) {
  const { scene, assets, image, narration, exportSettings, setExportSettings, projectName, preview, time, notify } = useEditor();
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<(ExportResult & { url: string; seconds: number }) | null>(null);
  const [fast, setFast] = useState(true);
  const abort = useRef<AbortController | null>(null);

  const { width, height } = pickSize(exportSettings.quality, scene.stage, image);
  const length = videoLength(scene, narration?.duration);
  const fileBase = (projectName || "plan").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "plan";

  useEffect(() => {
    let alive = true;
    canExportOffline(width, height, exportSettings.fps).then((ok) => { if (alive) setFast(ok); });
    return () => { alive = false; };
  }, [width, height, exportSettings.fps]);

  useEffect(() => () => { abort.current?.abort(); }, []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const run = async () => {
    abort.current = new AbortController();
    setResult(null);
    setProgress(0);
    const started = performance.now();
    try {
      const output = await exportVideo({
        scene, assets, image, narration: narrationData.buffer, width, height, fps: exportSettings.fps, duration: length.seconds,
        onProgress: setProgress, signal: abort.current.signal,
      });
      setResult({ ...output, url: URL.createObjectURL(output.blob), seconds: (performance.now() - started) / 1000 });
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        console.error(error);
        notify(t("Export failed: {error}", { error: String((error as Error)?.message ?? error) }), "error");
      }
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const savePng = async () => {
    const blob = await exportPng(scene, assets, image, width, height, preview ? time : null);
    if (blob) saveBlob(blob, `${fileBase}.png`);
    else notify(t("Could not create the image."), "error");
  };

  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], `${fileBase}.${result.ext}`, { type: result.blob.type });
    try {
      await navigator.share({ files: [file], title: projectName });
    } catch { /* the share sheet was dismissed */ }
  };
  const canShare = !!result && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([result.blob], `a.${result.ext}`, { type: result.blob.type })] });
  const busy = progress !== null;

  // The finished video gets a screen of its own: watch it, keep it, send it
  if (result) {
    return (
      <div role="dialog" aria-modal="true" aria-label={t("Video ready")} className="fixed inset-0 z-50 flex flex-col bg-ink text-fg pt-[env(safe-area-inset-top)]">
        <header className="shrink-0 h-12 flex items-center gap-1 px-2 border-b border-line">
          <IconButton icon="back" label={t("Back to export settings")} onClick={() => setResult(null)} />
          <h2 className="flex-1 text-[15px] font-semibold">{t("Video ready")}</h2>
          <button type="button" onClick={onClose} className="h-10 px-3 rounded-control text-[14px] font-semibold text-fg-muted hover:bg-chip-hover hover:text-fg">{t("Done")}</button>
        </header>
        <div className="flex-1 min-h-0 w-full max-w-lg mx-auto flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <video src={result.url} controls loop autoPlay muted={!result.hasAudio} playsInline className="flex-1 min-h-0 w-full rounded-card bg-black object-contain" />
          <p className="text-center text-[12px] text-fg-subtle font-mono">
            {result.hasAudio
              ? t("{width}×{height} · {seconds}s · {size} MB · {ext} · with audio", { width, height, seconds: length.seconds.toFixed(1), size: (result.blob.size / 1048576).toFixed(1), ext: result.ext.toUpperCase() })
              : t("{width}×{height} · {seconds}s · {size} MB · {ext}", { width, height, seconds: length.seconds.toFixed(1), size: (result.blob.size / 1048576).toFixed(1), ext: result.ext.toUpperCase() })}
          </p>
          <Button primary className="w-full !h-12 !text-[15px]" onClick={() => saveBlob(result.blob, `${fileBase}.${result.ext}`)}>{t("Save video")}</Button>
          {canShare && <Button className="w-full" onClick={share}>{t("Share")}</Button>}
          <button type="button" onClick={() => setResult(null)} className="h-10 text-[13px] font-semibold text-fg-muted hover:text-fg">{t("Change settings and export again")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={t("Export")} className="w-full sm:max-w-md bg-raised rounded-t-sheet sm:rounded-sheet p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{busy ? t("Rendering…") : t("Export")}</h2>
          <button type="button" onClick={() => { abort.current?.abort(); onClose(); }} aria-label={t("Close")} className="w-10 h-10 grid place-items-center rounded-full hover:bg-chip-hover"><Icon name="close" /></button>
        </div>

        {busy ? (
          <>
            <div className="h-1.5 rounded-full bg-chip-active overflow-hidden">
              <div className="h-full bg-brand transition-[width] duration-100" style={{ width: `${(progress ?? 0) * 100}%` }} />
            </div>
            <p className="text-[13px] text-fg-muted font-mono">{Math.round((progress ?? 0) * 100)}% · {width}×{height} · {length.seconds.toFixed(1)}s</p>
            <Button className="w-full" onClick={() => abort.current?.abort()}>{t("Cancel")}</Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-[13px] text-fg-muted">{t("Quality")}</p>
              <Row>{QUALITIES.map((q) => <Chip key={q.value} active={exportSettings.quality === q.value} disabled={q.value === "native" && !image} onClick={() => setExportSettings({ quality: q.value })}>{q.value === "native" ? t("Photo size") : q.label}</Chip>)}</Row>
              <p className="text-[13px] text-fg-muted pt-1">{t("Frames per second")}</p>
              <Row>{[24, 30, 60].map((fps) => <Chip key={fps} active={exportSettings.fps === fps} onClick={() => setExportSettings({ fps })}>{fps}</Chip>)}</Row>
            </div>
            <p className="text-[12px] text-fg-muted font-mono">
              {t("{width}×{height} · {seconds}s · {kind}", { width, height, seconds: length.seconds.toFixed(1), kind: { custom: t("fixed length"), story: t("sketch timeline"), loop: length.seamless ? t("seamless loop") : t("loop"), still: t("still image") }[length.kind] })}
              {narration ? ` · ${t("with audio")}` : ""}{fast ? "" : ` · ${t("real-time capture (slower, no audio)")}`}
            </p>
            <Button primary className="w-full !h-12 !text-[15px]" onClick={run}>{t("Export video")}</Button>
            <Button className="w-full" onClick={savePng}>{t("Save as image (PNG)")}</Button>
          </>
        )}
      </div>
    </div>
  );
}
