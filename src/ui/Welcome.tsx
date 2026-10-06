import { useEffect, useState } from "react";
import { useEditor } from "../editor/store";
import { HelpSheet } from "./HelpSheet";
import { Logo } from "./Logo";
import { Button, Icon, IconButton } from "./kit";
import { useImageDrop } from "./useImageDrop";
import { pickFile } from "./util";

const BLOCKS: { icon: string; title: string; text: string }[] = [
  { icon: "photo", title: "Start from your picture", text: "A floor plan, a site photo, a screenshot. It fills the frame; choose portrait, square or landscape." },
  { icon: "plus", title: "Add overlays", text: "Zones, arrows, text and icons, or draw by hand. Drag to place them, then set colour, border and label." },
  { icon: "sketch", title: "Animate, or sketch while you talk", text: "Give each overlay an animation, or sketch live: strokes replay with the timing you drew them, over your narration if you add audio." },
  { icon: "export", title: "Export an MP4", text: "Up to 4K, rendered in your browser. Download it or send it straight to the share sheet." },
];

/** The product in miniature: a plan with a highlighted zone, a marker, a pen arrow and a hand-drawn circle, over a timeline. */
function HeroArt() {
  const wall = { fill: "none", stroke: "#2c2c2e", strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const thin = { fill: "none", stroke: "#8e8e93", strokeWidth: 1.5, strokeLinecap: "round" } as const;
  const pen = { fill: "none", stroke: "#ff453a", strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 320 384" className="w-full h-auto" role="img" aria-label="A floor plan with one room highlighted in yellow, a numbered marker, a hand-drawn arrow and a circled window, above a timeline.">
      <rect x="0" y="0" width="320" height="384" rx="18" fill="#f7f7f4" />

      {/* Highlighted zone, under the walls like marker ink */}
      <g className="hero-fade">
        <rect x="30" y="38" width="138" height="140" rx="3" fill="#ffd60a" fillOpacity="0.55" stroke="#2c2c2e" strokeWidth="2.5" />
        <rect x="38" y="46" width="92" height="24" rx="12" fill="#ffd60a" />
        <text x="84" y="62.5" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#2c2c2e">Living room</text>
      </g>

      {/* Plan: outer walls, partitions with door gaps, door swings, windows */}
      <path {...wall} d="M28 36h264v252H28zM170 36v70M170 142v40M28 180h36M100 180h106M242 180h50M116 180v108" />
      <path {...thin} d="M64 180a36 36 0 0136 36M206 180a36 36 0 0036 36M170 142a36 36 0 01-36-36" />
      <path {...thin} d="M70 32h64M70 40h64M288 214v52M296 214v52M196 284h60M196 292h60" />

      {/* Numbered marker */}
      <g className="hero-fade" style={{ animationDelay: "0.5s" }}>
        <circle cx="236" cy="92" r="15" fill="#ffd60a" />
        <text x="236" y="97.5" textAnchor="middle" fontSize="16" fontWeight="800" fill="#2c2c2e">1</text>
      </g>

      {/* Pen strokes: an arrow through the doorway and a circle around the window */}
      <path {...pen} pathLength={1} className="hero-draw" style={{ animationDelay: "0.9s" }} d="M228 122c-10 22-34 12-78 6" />
      <path {...pen} className="hero-fade" style={{ animationDelay: "1.5s" }} d="M163 116l-14 12 16 9" />
      <path {...pen} pathLength={1} className="hero-draw" style={{ animationDelay: "1.8s" }} d="M286 204c-17 3-25 20-24 38 1 20 12 37 30 34 15-3 22-21 20-41-2-19-11-33-28-32" />

      {/* Timeline: one bar per highlight, and the playhead */}
      <rect x="28" y="312" width="264" height="48" rx="12" fill="#2c2c2e" />
      <path d="M43 326l14 10-14 10z" fill="#f2f2f2" />
      <rect x="72" y="323" width="120" height="7" rx="3.5" fill="#ffd60a" />
      <rect x="112" y="333" width="92" height="7" rx="3.5" fill="#ffd60a" fillOpacity="0.55" />
      <rect x="150" y="343" width="126" height="7" rx="3.5" fill="#ff453a" />
      <path d="M212 318v36" stroke="#f2f2f2" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Landing page: shown on the first visit, and from the project list after that. */
export function Welcome() {
  const { projects, loadProjects, newProject, showScreen } = useEditor();
  const [help, setHelp] = useState(false);
  const { dropping, handlers } = useImageDrop(newProject);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const fromPhoto = async () => {
    const file = await pickFile("image/*");
    if (file) await newProject(file);
  };
  const projectsLabel = projects.length > 0 ? `My projects (${projects.length})` : "Project list";

  return (
    <div
      className={`min-h-dvh px-4 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] ${dropping ? "bg-brand/10" : ""}`}
      {...handlers}
    >
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-2">
          <Logo size="sm" />
          <IconButton icon="help" label="Help" onClick={() => setHelp(true)} className="-mr-2" />
        </header>

        <main>
          <section className="grid lg:grid-cols-[1fr_minmax(0,24rem)] gap-8 lg:gap-14 items-center pt-8 lg:pt-16">
            <div className="space-y-5">
              <h1 className="text-display lg:text-[3.25rem] font-bold text-balance">
                Highlight a plan. <span className="text-brand">Export a video.</span>
              </h1>
              <p className="text-heading text-fg-muted max-w-xl">
                Pick a photo or floor plan, mark zones, arrows and notes on it, animate them or sketch while you talk, and export an MP4.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button primary onClick={fromPhoto} className="!h-14 !px-7 !text-[17px] !font-bold flex items-center justify-center gap-2">
                  <Icon name="photo" /> Start with a photo
                </Button>
                <Button onClick={() => showScreen("home")} className="!h-14 !px-6 !text-[15px]">{projectsLabel}</Button>
              </div>
              <p className="flex items-start gap-2 text-label text-fg-muted">
                <Icon name="lock" className="w-4 h-4 mt-0.5 shrink-0 text-success" />
                Your photo stays in this browser. Nothing is uploaded, and there is no account.
              </p>
            </div>
            <div className="w-full max-w-sm mx-auto lg:max-w-none">
              <HeroArt />
            </div>
          </section>

          <section className="pt-12 lg:pt-20 space-y-4" aria-labelledby="how">
            <h2 id="how" className="text-title font-bold">How it works</h2>
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {BLOCKS.map((block, index) => (
                <li key={block.title} className="rounded-card bg-raised p-4 space-y-2">
                  <div className="flex items-center gap-2 text-brand">
                    <Icon name={block.icon} />
                    <span className="text-caption font-bold uppercase tracking-widest text-fg-subtle">Step {index + 1}</span>
                  </div>
                  <h3 className="text-heading font-bold">{block.title}</h3>
                  <p className="text-label text-fg-muted">{block.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-10 rounded-card bg-raised p-5 sm:flex sm:items-start sm:gap-4" aria-labelledby="local">
            <span className="shrink-0 w-11 h-11 grid place-items-center rounded-full bg-chip-active text-success"><Icon name="lock" /></span>
            <div className="space-y-1.5 mt-3 sm:mt-0">
              <h2 id="local" className="text-heading font-bold">Everything stays on this device</h2>
              <p className="text-label text-fg-muted max-w-3xl">
                Projects, photos and narration are saved in this browser's own storage (IndexedDB), and the video is rendered here as well. Your photos and projects are never sent to a server; only the optional online icon search contacts one (iconify.design). The flip side: projects do not sync to your other devices, and clearing this site's data deletes them.
              </p>
            </div>
          </section>
        </main>

        <footer className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 -mx-3">
          <button type="button" onClick={() => setHelp(true)} className="h-11 px-3 rounded-control text-label font-semibold text-fg-muted hover:bg-chip-hover flex items-center gap-2">
            <Icon name="help" className="w-4 h-4" /> Help and keyboard shortcuts
          </button>
        </footer>
      </div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </div>
  );
}
