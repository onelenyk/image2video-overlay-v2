import { useEffect, useMemo, useState } from "react";
import { buildTemplate, type TemplateSpec } from "../engine/template";
import type { Stage } from "../engine/types";
import { useSession } from "../editor/session";
import { useEditor } from "../editor/store";
import { HelpSheet } from "./HelpSheet";
import { Logo } from "./Logo";
import { Button, Icon, IconButton, Row } from "./kit";
import { TemplateGallery, type GalleryItem } from "./TemplateGallery";
import { library as bundled, PREVIEW_H, PREVIEW_W } from "./templateLibrary";
import { useImageDrop } from "./useImageDrop";
import { pickFile } from "./util";
import { LangSwitch } from "./LangSwitch";
import { m, t, tn, type Msg } from "../i18n";

const BLANK: { value: Stage["aspect"]; label: Msg }[] = [
  { value: "9:16", label: m("9:16 portrait") },
  { value: "4:5", label: m("4:5") },
  { value: "1:1", label: m("Square") },
  { value: "16:9", label: m("16:9 landscape") },
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
      aria-label={armed ? t("Confirm deleting {name}", { name }) : t("Delete {name}", { name })}
      className={`shrink-0 h-9 grid place-items-center rounded-control text-[12px] font-semibold ${armed ? "px-2.5 bg-danger text-white" : "w-9 text-fg-subtle hover:bg-chip-hover hover:text-fg"}`}
    >
      {armed ? t("Delete?") : <Icon name="trash" className="w-4 h-4" />}
    </button>
  );
}

/** Inline rename input for a project. */
function RenameInput({ name, onSave, onCancel }: { name: string; onSave: (newName: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    }
    onCancel();
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={save}
      onFocus={(e) => e.currentTarget.select()}
      aria-label={t("New name for {name}", { name })}
      maxLength={60}
      autoFocus
      className="w-full h-9 px-2 rounded-control bg-chip border border-line text-fg text-[16px] sm:text-label"
    />
  );
}

/** Project list: every project is a photo plus what was added on top of it. */
export function Home() {
  const { projects, loadProjects, newProject, openProject, deleteProject, renameProjectById, duplicateProject, showScreen } = useEditor();
  const [blank, setBlank] = useState(false);
  const [help, setHelp] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { dropping, handlers } = useImageDrop(newProject);
  const session = useSession();
  const notify = useEditor((s) => s.notify);
  const [moving, setMoving] = useState(false);

  useEffect(() => { loadProjects(); }, [loadProjects, session.user.id]);

  const handleRename = async (id: string, newName: string) => {
    await renameProjectById(id, newName);
    setRenamingId(null);
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      await duplicateProject(id);
    } finally {
      setBusyId(null);
    }
  };

  const fromPhoto = async () => {
    const file = await pickFile("image/*");
    if (file) await newProject(file);
  };
  const moveLocal = async () => {
    setMoving(true);
    try {
      const moved = await session.adoptLocal();
      await loadProjects();
      notify(tn(moved, "{n} project moved to your account.", "{n} projects moved to your account."));
    } catch (error) {
      console.warn(error);
      notify(t("Could not move everything. What is left stays on this device; try again."), "error");
    } finally {
      setMoving(false);
    }
  };
  // Photo first, then the template laid over it and playing
  const fromTemplate = async (spec: TemplateSpec) => {
    const file = await pickFile("image/*");
    if (!file) return;
    await newProject(file);
    const state = useEditor.getState();
    if (state.screen !== "editor") return; // the photo could not be read
    const built = buildTemplate(spec, state.scene.stage.w, state.scene.stage.h);
    state.addGroup(spec.name, built.elements, built.assets);
    state.seek(0);
    state.play();
  };
  const library = useMemo<GalleryItem[]>(() => bundled().map((spec) => ({ id: spec.id, name: spec.name, hint: spec.hint, group: spec.group, sample: spec.sample, built: buildTemplate(spec, PREVIEW_W, PREVIEW_H), width: PREVIEW_W, height: PREVIEW_H, onPick: () => void fromTemplate(spec) })), []); // eslint-disable-line react-hooks/exhaustive-deps -- fromTemplate reads the store when called

  return (
    <div
      className={`min-h-dvh px-4 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] ${dropping ? "bg-brand/10" : ""}`}
      {...handlers}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => showScreen("welcome")} aria-label={t("About Plan Highlighter")} className="h-11 -ml-1 px-1 rounded-control">
            <Logo size="sm" />
          </button>
          <span className="flex items-center">
            <LangSwitch />
            {session.available && session.ready && (session.user.guest ? (
              <button type="button" onClick={() => showScreen("signin")} className="h-10 px-3 rounded-control text-label font-semibold text-fg-muted hover:bg-chip-hover hover:text-fg">{t("Sign in")}</button>
            ) : (
              <button type="button" onClick={() => showScreen("account")} aria-label={t("Account: {email}", { email: session.user.email ?? "" })} title={session.user.email} className="w-9 h-9 grid place-items-center rounded-full bg-chip-active text-label font-bold">{(session.user.email ?? "?").charAt(0).toUpperCase()}</button>
            ))}
            <IconButton icon="help" label={t("Help")} onClick={() => setHelp(true)} className="-mr-2" />
          </span>
        </header>

        {/* Signed in, with guest work still on this device: ask once what to do with it */}
        {session.localProjects > 0 && (
          <section className="rounded-card bg-raised p-4 space-y-3" aria-label={t("Projects on this device")}>
            <p className="text-label">
              <span className="font-semibold">{tn(session.localProjects, "{n} project on this device", "{n} projects on this device")}</span>
              <span className="text-fg-muted"> {tn(session.localProjects, "It was made without an account. Move it to your account to have it everywhere.", "They were made without an account. Move them to your account to have them everywhere.")}</span>
            </p>
            <div className="flex gap-2">
              <Button primary onClick={moveLocal} disabled={moving} className="flex-1">{moving ? t("Moving…") : t("Move to my account")}</Button>
              <Button onClick={session.dismissAdopt} disabled={moving} className="flex-1">{t("Keep here only")}</Button>
            </div>
          </section>
        )}

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button primary onClick={fromPhoto} className="!h-14 !text-[16px] !font-bold sm:px-8 flex items-center justify-center gap-2">
              <Icon name="photo" /> {t("New project from a photo")}
            </Button>
            <Button onClick={() => setBlank((v) => !v)} className="!h-14 !text-[15px]">{t("Blank canvas")}</Button>
          </div>
          {blank && (
            <Row>
              {BLANK.map((b) => (
                <button key={b.value} type="button" onClick={() => newProject(null, b.value)} className="shrink-0 h-11 px-4 rounded-control bg-chip hover:bg-chip-hover text-label font-semibold whitespace-nowrap">
                  {t(b.label)}
                </button>
              ))}
            </Row>
          )}
        </div>

        <section className="space-y-3" aria-labelledby="start-template">
          <div>
            <h2 id="start-template" className="text-caption font-bold uppercase tracking-widest text-fg-subtle">{t("Start from a template")}</h2>
            <p className="text-caption text-fg-subtle">{t("Pick one, choose your photo, then adjust.")}</p>
          </div>
          <TemplateGallery items={library} layout="row" />
        </section>

        {projects.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-caption font-bold uppercase tracking-widest text-fg-subtle">{t("Projects")}</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {projects.map((project) => (
                <li key={project.id} className="rounded-card bg-raised overflow-hidden flex flex-col">
                  <button type="button" onClick={() => openProject(project.id)} aria-label={t("Open {name}", { name: project.name })} className="relative block w-full aspect-square bg-black">
                    {project.thumb && <img src={project.thumb} alt="" className="absolute inset-0 w-full h-full object-contain" />}
                  </button>
                  <div className="flex flex-col px-3 py-2 gap-1">
                    {renamingId === project.id ? (
                      <RenameInput name={project.name} onSave={(newName) => handleRename(project.id, newName)} onCancel={() => setRenamingId(null)} />
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-label font-semibold">{project.name}</p>
                        <p className="text-caption text-fg-subtle">{new Date(project.updatedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                    <div className="flex gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => setRenamingId(project.id)}
                        aria-label={t("Rename {name}", { name: project.name })}
                        className="w-9 h-9 grid place-items-center rounded-control text-fg-subtle hover:bg-chip-hover hover:text-fg"
                      >
                        <Icon name="edit" className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(project.id)}
                        disabled={busyId === project.id}
                        aria-label={t("Duplicate {name}", { name: project.name })}
                        className="w-9 h-9 grid place-items-center rounded-control text-fg-subtle hover:bg-chip-hover hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="copy" className="w-4 h-4" />
                      </button>
                      <DeleteProject name={project.name} onConfirm={() => deleteProject(project.id)} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="rounded-card bg-raised px-6 py-10 text-center space-y-2">
            <span className="mx-auto w-14 h-14 grid place-items-center rounded-full bg-chip-active text-brand"><Icon name="photo" className="w-6 h-6" /></span>
            <h2 className="text-heading font-bold pt-2">{t("No projects yet")}</h2>
            <p className="text-label text-fg-muted max-w-sm mx-auto">
              {t("A project is one photo or plan plus the highlights you put on it. Start with a photo above; on a computer you can also drop an image anywhere on this page.")}
            </p>
          </section>
        )}

        <footer className="pt-2 space-y-1">
          <p className="flex items-start gap-2 text-label text-fg-muted">
            <Icon name="lock" className="w-4 h-4 mt-0.5 shrink-0 text-success" />
            <span>
              {session.user.guest ? t("Projects are saved in this browser only. Nothing is uploaded.") : t("Projects are saved in your account. Videos are rendered on this device.")}
              {session.user.guest && session.available && <button type="button" onClick={() => showScreen("signin")} className="ml-1.5 font-semibold text-brand">{t("Sign in to keep them everywhere")}</button>}
            </span>
          </p>
          <button type="button" onClick={() => showScreen("welcome")} className="h-11 -ml-3 px-3 rounded-control text-label font-semibold text-fg-muted hover:bg-chip-hover">
            {t("What Plan Highlighter does")}
          </button>
        </footer>
      </div>
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </div>
  );
}
