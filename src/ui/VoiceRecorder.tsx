import { useEffect, useRef, useState } from "react";
import { useEditor } from "../editor/store";
import { formatTime } from "./util";
import { t } from "../i18n";

const MAX_SECONDS = 10 * 60;
const TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"];

/** One button that records the microphone and hands back the recording as a file. */
export function VoiceRecorder({ onDone, className = "" }: { onDone: (file: File) => void; className?: string }) {
  const notify = useEditor((s) => s.notify);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const session = useRef<{ recorder: MediaRecorder; stream: MediaStream; timer: number; keep: boolean } | null>(null);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  /** Ends the recording. The file is built in `onstop`, once the recorder has handed over its last data. */
  const stop = (keep: boolean) => {
    const current = session.current;
    if (!current) return;
    current.keep = keep;
    clearInterval(current.timer);
    if (current.recorder.state !== "inactive") current.recorder.stop();
    current.stream.getTracks().forEach((track) => track.stop()); // the browser's microphone indicator goes away
  };

  const start = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      notify(t("Microphone is not available. Allow it in the browser, or add an audio file instead."), "error");
      return;
    }
    const mimeType = TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    const startedAt = performance.now();
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const keep = session.current?.keep;
      session.current = null;
      if (!keep) return; // the panel was closed mid-recording
      setRecording(false);
      if (!chunks.length) return;
      const type = recorder.mimeType || "audio/webm";
      const stamp = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace("T", " ").replace(":", ".");
      done.current(new File(chunks, `${t("Voice {stamp}", { stamp })}.${type.includes("mp4") ? "m4a" : "webm"}`, { type }));
    };
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) stop(true);
    }, 250);
    session.current = { recorder, stream, timer, keep: true };
    recorder.start();
    setSeconds(0);
    setRecording(true);
  };

  useEffect(() => () => stop(false), []);

  return (
    <button
      type="button"
      onClick={() => (recording ? stop(true) : void start())}
      aria-pressed={recording}
      className={`shrink-0 h-10 px-4 rounded-control text-[13px] font-semibold whitespace-nowrap flex items-center justify-center gap-2 transition-colors ${recording ? "bg-danger text-white" : "bg-chip text-fg hover:bg-chip-hover"} ${className}`}
    >
      <span className={`w-2.5 h-2.5 rounded-full ${recording ? "bg-white" : "bg-danger"}`} aria-hidden />
      {recording ? t("Stop · {time}", { time: formatTime(seconds) }) : t("Record voice")}
    </button>
  );
}
