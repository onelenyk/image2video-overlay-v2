import { useState } from "react";
import { videoLength } from "../engine/scene";
import { useEditor } from "../editor/store";
import { formatTime } from "./util";
import { FullPreview } from "./FullPreview";

// Playback zone: transport in the middle, the clock on the right, and on the
// left the switch between "this frame" and "everything at once".

function Glyph({ d, fill = false, className = "w-5 h-5" }: { d: string; fill?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const small = "w-9 h-10 sm:w-10 grid place-items-center rounded-full text-fg hover:bg-chip-hover disabled:opacity-30";

export function Player() {
  const [full, setFull] = useState(false);
  const time = useEditor((s) => s.time);
  const preview = useEditor((s) => s.preview);
  const playing = useEditor((s) => s.playing);
  const sketching = useEditor((s) => s.mode === "sketch");
  const fps = useEditor((s) => s.exportSettings.fps);
  const scene = useEditor((s) => s.scene);
  const narration = useEditor((s) => s.narration);
  const { play, pause, seek, exitPreview } = useEditor();

  const length = videoLength(scene, narration?.duration);
  const duration = length.seconds;
  const at = preview ? Math.min(time, duration) : 0;
  const step = (frames: number) => seek(at + frames / fps);
  const kind = { custom: "fixed length", story: "timeline", loop: length.seamless ? "seamless loop" : "loop", still: "still" }[length.kind];

  const segment = (active: boolean) =>
    `h-8 px-2.5 sm:px-3 rounded-[7px] text-[12px] font-semibold transition-colors ${active ? "bg-chip-active text-fg" : "text-fg-subtle hover:text-fg"}`;

  return (
    <section aria-label="Player" className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2 px-2 sm:px-3 h-12">
      {/* What the canvas shows */}
      <div className="justify-self-start flex p-0.5 rounded-[9px] bg-chip" role="group" aria-label="Canvas view">
        <button type="button" className={segment(preview)} disabled={sketching} onClick={() => seek(at)} title="Show the video at the playhead">Frame</button>
        <button type="button" className={segment(!preview)} disabled={sketching} onClick={exitPreview} title="Show every overlay at once, regardless of time">All</button>
      </div>

      {/* Transport */}
      <div className="flex items-center justify-center gap-0.5">
        <button type="button" className={`${small} hidden min-[420px]:grid`} onClick={() => seek(0)} disabled={sketching} aria-label="Go to start" title="Go to start">
          <Glyph d="M6 5v14M19 6l-9 6 9 6z" />
        </button>
        <button type="button" className={small} onClick={() => step(-1)} disabled={sketching} aria-label="Previous frame" title="Previous frame">
          <Glyph d="M15 6l-6 6 6 6" />
        </button>
        <button
          type="button"
          onClick={playing ? pause : play}
          disabled={sketching}
          aria-label={playing ? "Pause" : "Play"}
          title="Play / pause (Space)"
          className="w-11 h-11 sm:mx-1 grid place-items-center rounded-full text-fg hover:bg-chip disabled:opacity-40"
        >
          <Glyph fill d={playing ? "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" : "M8 5l11 7-11 7z"} className="w-6 h-6" />
        </button>
        <button type="button" className={small} onClick={() => step(1)} disabled={sketching} aria-label="Next frame" title="Next frame">
          <Glyph d="M9 6l6 6-6 6" />
        </button>
        <button type="button" className={`${small} hidden min-[420px]:grid`} onClick={() => seek(duration)} disabled={sketching} aria-label="Go to end" title="Go to end">
          <Glyph d="M18 5v14M5 6l9 6-9 6z" />
        </button>
      </div>

      {/* Clock */}
      <div className="justify-self-end flex items-center sm:gap-1">
        <button
          type="button"
          className={small}
          onClick={() => setFull(true)}
          disabled={sketching}
          aria-label="Full-screen preview"
          title="Full-screen preview"
        >
          <Glyph d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </button>
        <div className="text-right leading-tight">
          <div className="text-[11px] sm:text-[14px] font-mono font-semibold tabular-nums text-fg whitespace-nowrap">
            {formatTime(at)}<span className="hidden min-[380px]:inline text-fg-subtle"> / {formatTime(duration)}</span>
          </div>
          <div className="hidden sm:block text-[11px] text-fg-subtle">{kind}</div>
        </div>
      </div>

      {full && <FullPreview onClose={() => setFull(false)} />}
    </section>
  );
}
