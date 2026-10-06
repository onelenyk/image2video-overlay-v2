import type { ReactNode } from "react";
import { Sheet } from "./kit";

const STEPS: { title: string; text: string }[] = [
  { title: "Start with a photo or plan", text: "Pick an image from your device, or start on a blank canvas in the shape you need." },
  { title: "Add overlays", text: "Tap Add for zones, arrows, text and icons, or Draw to draw by hand. Drag to move them; use the handles to resize and rotate." },
  { title: "Style and animate", text: "Select an overlay, then use Style for its look and Animate for how it moves. Timing sets when it is on screen." },
  { title: "Sketch while you talk", text: "Optional. Open Sketch and draw on the picture: strokes replay in the video with the timing you drew them. You can add a narration audio file to draw along to." },
  { title: "Export", text: "Tap Export, choose a quality, then download or share the video." },
];

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Space"], action: "Play or pause" },
  { keys: ["Delete"], action: "Remove the selected overlay" },
  { keys: ["Arrows"], action: "Nudge the selection (hold Shift for 10×)" },
  { keys: [mod, "Wheel"], action: "Zoom the photo (or pinch); the wheel alone pans when zoomed in" },
  { keys: [mod, "Z"], action: "Undo" },
  { keys: [mod, "Shift", "Z"], action: "Redo" },
  { keys: [mod, "D"], action: "Duplicate the selection" },
  { keys: ["Enter"], action: "Finish a polygon as an open shape" },
  { keys: ["Esc"], action: "Cancel the tool, leave preview, or deselect" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 py-5 border-t border-line first:border-t-0 first:pt-2">
      <h3 className="text-heading font-bold">{title}</h3>
      {children}
    </section>
  );
}

/**
 * About / Help. Self-contained: render it while open and pass onClose.
 *   const [help, setHelp] = useState(false);
 *   {help && <HelpSheet onClose={() => setHelp(false)} />}
 */
export function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Help" onClose={onClose}>
      <Section title="How to use it">
        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 grid place-items-center rounded-full bg-brand text-on-brand text-label font-bold tabular-nums">{index + 1}</span>
              <div>
                <p className="text-body font-semibold">{step.title}</p>
                <p className="text-label text-fg-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Keyboard shortcuts">
        <dl className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.action} className="flex items-center justify-between gap-4">
              <dd className="text-label text-fg-muted">{shortcut.action}</dd>
              <dt className="shrink-0 flex gap-1">
                {shortcut.keys.map((key) => <kbd key={key} className="min-w-7 h-7 px-2 grid place-items-center rounded-md bg-chip border border-line font-mono text-caption text-fg">{key}</kbd>)}
              </dt>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Video export">
        <p className="text-label text-fg-muted">
          Export produces an MP4 (H.264). It needs a browser with WebCodecs, which current Chrome, Edge and Safari have. The video is rendered frame by frame, so it does not depend on how fast your device plays the preview.
        </p>
        <p className="text-label text-fg-muted">
          Where WebCodecs is missing, the app records the picture in real time instead. That takes as long as the video itself, leaves out narration audio, and in some browsers gives a WebM file. The export sheet says so before you start.
        </p>
      </Section>

      <Section title="Privacy">
        <p className="text-label text-fg-muted">
          Everything stays in this browser. Projects, photos and narration are saved on this device (IndexedDB), and videos are rendered here too. Nothing is uploaded and there is no account. The one exception is the online icon search: the words you type there go to iconify.design, and the icon you pick is downloaded from it.
        </p>
        <p className="text-label text-fg-muted">
          That also means projects do not sync between devices, and clearing this site's data in the browser deletes them.
        </p>
      </Section>

      <Section title="About">
        <p className="text-label text-fg-muted">
          Plan Highlighter is open source under the MIT license.
        </p>
        <a href="https://github.com/onelenyk/image2video-overlay" target="_blank" rel="noreferrer" className="h-11 w-fit flex items-center text-label font-semibold text-brand underline underline-offset-4">Source on GitHub</a>
      </Section>
    </Sheet>
  );
}
