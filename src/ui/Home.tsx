import { useEffect, useState } from "react";
import type { Stage } from "../engine/types";
import { useEditor } from "../editor/store";
import { HelpSheet } from "./HelpSheet";
import { Logo } from "./Logo";
import { Button, Icon, IconButton, Row } from "./kit";
import { useImageDrop } from "./useImageDrop";
import { pickFile } from "./util";

const BLANK: { value: Stage["aspect"]; label: string }[] = [
  { value: "9:16", label: "9:16 portrait" },
  { value: "4:5", label: "4:5" },
  { value: "1:1", label: "Square" },
  { value: "16:9", label: "16:9 landscape" },
];

/** A quiet bin in the corner of a card; it asks once more before deleting. */
function DeleteProject({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      aria-label={armed ? `Confirm deleting ${name}` : `Delete ${name}`}
      className={`shrink-0 h-9 grid place-items-center rounded-control text-[12px] font-semibold ${armed ? "px-2.5 bg-danger text-white" : "w-9 text-fg-subtle hover:bg-chip-hover hover:text-fg"}`}
    >
      {armed ? "Delete?" : <Icon name="trash" className="w-4 h-4" />}
    </button>
  );
}

/** Project list: every project is a photo plus what was added on top of it. */
export function Home() {
  const { projects, loadProjects, newProject, openProject, deleteProject, showScreen } = useEditor();
  const [blank, setBlank] = useState(false);
  const [help, setHelp] = useState(false);
  const { dropping, handlers } = useImageDrop(newProject);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const fromPhoto = async () => {
    const file = await pickFile("image/*");
    if (file) await newProject(file);
  };

  return (
    <div
      className={`min-h-dvh px-4 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] ${dropping ? "bg-brand/10" : ""}`}
      {...handlers}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => showScreen("welcome")} aria-label="About Plan Highlighter" className="h-11 -ml-1 px-1 rounded-control">
            <Logo size="sm" />
          </button>
          <IconButton icon="help" label="Help" onClick={() => setHelp(true)} className="-mr-2" />
        </header>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button primary onClick={fromPhoto} className="!h-14 !text-[16px] !font-bold sm:px-8 flex items-center justify-center gap-2">
              <Icon name="photo" /> New project from a photo
            </Button>
            <Button onClick={() => setBlank((v) => !v)} className="!h-14 !text-[15px]">Blank canvas</Button>
          </div>
          {blank && (
            <Row>
              {BLANK.map((b) => (
                <button key={b.value} type="button" onClick={() => newProject(null, b.value)} className="shrink-0 h-11 px-4 rounded-control bg-chip hover:bg-chip-hover text-label font-semibold whitespace-nowrap">
                  {b.label}
                </button>
              ))}
            </Row>
          )}
        </div>

        {projects.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-caption font-bold uppercase tracking-widest text-fg-subtle">Projects</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {projects.map((project) => (
                <li key={project.id} className="rounded-card bg-raised overflow-hidden flex flex-col">
                  <button type="button" onClick={() => openProject(project.id)} aria-label={`Open ${project.name}`} className="relative block w-full aspect-square bg-black">
                    {project.thumb && <img src={project.thumb} alt="" className="absolute inset-0 w-full h-full object-contain" />}
                  </button>
                  <div className="flex items-center gap-1 pl-3 pr-1.5 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-label font-semibold">{project.name}</p>
                      <p className="text-caption text-fg-subtle">{new Date(project.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <DeleteProject name={project.name} onConfirm={() => deleteProject(project.id)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-card bg-raised px-6 py-10 text-center space-y-2">
            <span className="mx-auto w-14 h-14 grid place-items-center rounded-full bg-chip-active text-brand"><Icon name="photo" className="w-6 h-6" /></span>
            <h2 className="text-heading font-bold pt-2">No projects yet</h2>
            <p className="text-label text-fg-muted max-w-sm mx-auto">
              A project is one photo or plan plus the highlights you put on it. Start with a photo above; on a computer you can also drop an image anywhere on this page.
            </p>
          </section>
        )}

        <footer className="pt-2 space-y-1">
          <p className="flex items-start gap-2 text-label text-fg-muted">
            <Icon name="lock" className="w-4 h-4 mt-0.5 shrink-0 text-success" />
            Projects are saved in this browser only. Nothing is uploaded.
          </p>
          <button type="button" onClick={() => showScreen("welcome")} className="h-11 -ml-3 px-3 rounded-control text-label font-semibold text-fg-muted hover:bg-chip-hover">
            What Plan Highlighter does
          </button>
        </footer>
      </div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </div>
  );
}
