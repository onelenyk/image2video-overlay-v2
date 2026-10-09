import { animName } from "./util";
import { useEffect, useState, useSyncExternalStore } from "react";
import { makePolygon } from "../engine/scene";
import { EditorCanvas } from "../editor/EditorCanvas";
import { selectedElement, useEditor, type Tool } from "../editor/store";
import { ExportSheet } from "./ExportSheet";
import { HelpSheet } from "./HelpSheet";
import { Player } from "./Player";
import { Timeline } from "./Timeline";
import { Icon, IconButton } from "./kit";
import { AddPanel } from "./panels/AddPanel";
import { AnimatePanel } from "./panels/AnimatePanel";
import { CanvasPanel } from "./panels/CanvasPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { SketchPanel } from "./panels/SketchPanel";
import { StylePanel } from "./panels/StylePanel";
import { TimingPanel } from "./panels/TimingPanel";
import { m, t, type Msg, secs } from "../i18n";

// The main menu never changes: these tools work on the whole project. Selecting
// an overlay adds to it: a selection bar on a phone, the inspector column on a
// wide screen, both offering that overlay's own tools.
//
// Wide screens are laid out like an editing desk: what you can add on the left,
// the picture with its transport in the middle, properties on the right (the
// canvas settings while nothing is selected), and the timeline with its tracks
// across the whole width underneath.
interface ToolItem { id: Tool; label: Msg; icon: string; title?: Msg }
const PROJECT_TOOLS: ToolItem[] = [
  { id: "add", label: m("Add"), icon: "plus", title: m("Add overlay") },
  { id: "sketch", label: m("Draw"), icon: "sketch" },
  { id: "layers", label: m("Overlays"), icon: "layers" },
  { id: "canvas", label: m("Canvas"), icon: "canvas" },
];
const OVERLAY_TOOLS: ToolItem[] = [
  { id: "style", label: m("Style"), icon: "style" },
  { id: "animate", label: m("Animate"), icon: "animate" },
  { id: "timing", label: m("Timing"), icon: "timing" },
];

const PANELS: Record<Tool, () => React.JSX.Element> = { add: AddPanel, style: StylePanel, animate: AnimatePanel, timing: TimingPanel, sketch: SketchPanel, layers: LayersPanel, canvas: CanvasPanel };

const WIDE = window.matchMedia("(min-width: 1024px)");
const subscribeWide = (notify: () => void) => {
  WIDE.addEventListener("change", notify);
  return () => WIDE.removeEventListener("change", notify);
};

/** Banner shown while a drawing tool owns the canvas. */
function ModeBar() {
  const { mode, draft, setMode, addElement, scene, time, stopSketch } = useEditor();
  if (mode === "select") return null;
  const text = {
    draw: t("Draw on the photo"),
    line: t("Drag from start to end"),
    polygon: draft.length < 3 ? t("Tap to place corners ({n})", { n: draft.length }) : t("Tap the first corner to close the shape"),
    sketch: t("Sketching · {time}", { time: `${secs(time, 1)}` }),
    select: "",
  }[mode];
  const pill = "h-9 px-3 rounded-full text-[13px] font-semibold";
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 pl-4 pr-1.5 h-12 rounded-full bg-brand text-on-brand shadow-lg max-w-[calc(100%-1rem)]">
      <span className="text-[13px] font-bold truncate">{text}</span>
      {mode === "polygon" && draft.length >= 2 && (
        <button type="button" className={`${pill} bg-black/15`} onClick={() => { addElement(makePolygon(scene, draft, false)); setMode("select"); }}>{t("Finish open")}</button>
      )}
      <button type="button" className={`${pill} bg-on-brand text-brand`} onClick={() => (mode === "sketch" ? stopSketch() : setMode("select"))}>
        {mode === "sketch" ? t("Stop") : t("Cancel")}
      </button>
    </div>
  );
}

export function Editor() {
  const saveState = useEditor((state) => state.saveState);
  const retrySave = useEditor((state) => state.retrySave);
  const { projectName, renameProject, closeProject, undo, redo, canUndo, canRedo, tool, setTool, selectedId, select, duplicate, remove, toast, preview, playing, time, mode } = useEditor();
  const selectedName = useEditor((s) => s.scene.elements.find((el) => el.id === s.selectedId)?.name ?? null);
  const [exporting, setExporting] = useState(false);
  const [help, setHelp] = useState(false);
  const { groupSel, selectGroup, ungroup, removeGroup, shiftGroup, saveTemplate, loadTemplates } = useEditor();
  const groupName = useEditor((state) => (state.groupSel ? state.scene.groups?.[state.groupSel]?.name ?? t("Group") : null));
  const groupCount = useEditor((state) => (state.groupSel ? state.scene.elements.filter((el) => el.group === state.groupSel).length : 0));
  useEffect(() => { void loadTemplates(); }, [loadTemplates]);
  const hasGroup = !!groupSel && mode === "select";
  const groupActions = groupSel && (
    <>
      <button type="button" onClick={() => shiftGroup(groupSel, -0.5)} className={`${"shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap"} bg-chip text-fg hover:bg-chip-hover`} title={t("Start the whole group half a second earlier")}>−0.5s</button>
      <button type="button" onClick={() => shiftGroup(groupSel, 0.5)} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap bg-chip text-fg hover:bg-chip-hover" title={t("Start the whole group half a second later")}>+0.5s</button>
      <button type="button" onClick={() => saveTemplate(groupName ?? t("My template"), groupSel)} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap bg-chip text-fg hover:bg-chip-hover">{t("Save as template")}</button>
      <button type="button" onClick={() => ungroup(groupSel)} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap bg-chip text-fg hover:bg-chip-hover">{t("Ungroup")}</button>
    </>
  );

  const wide = useSyncExternalStore(subscribeWide, () => WIDE.matches);
  const hasSelection = !!selectedId && mode === "select";
  const selectedColor = useEditor((state) => state.scene.elements.find((el) => el.id === state.selectedId)?.color ?? null);

  // The project tool whose panel is open. On a wide screen its column is always
  // there, so remember the last one while an overlay tool is the latest choice.
  const [lastProjectTool, setLastProjectTool] = useState<Tool>("add");
  const projectChoice = PROJECT_TOOLS.find((item) => item.id === tool) ?? null;
  if (projectChoice && projectChoice.id !== lastProjectTool) setLastProjectTool(projectChoice.id);
  // On a wide screen the canvas settings live in the right column, not in the menu
  const menu = wide ? PROJECT_TOOLS.filter((item) => item.id !== "canvas") : PROJECT_TOOLS;
  const projectTool = wide ? menu.find((item) => item.id === (projectChoice?.id ?? lastProjectTool)) ?? menu[0] : projectChoice;
  // The overlay tool open on a phone (a wide screen shows all three in the inspector)
  const overlayTool = hasSelection ? OVERLAY_TOOLS.find((item) => item.id === tool) ?? null : null;
  const shown = wide ? projectTool : overlayTool ?? projectTool;
  const Panel = shown ? PANELS[shown.id] : null;
  // Inspector sections: collapsed ones, and a one-line summary of each for its header
  const [closed, setClosed] = useState<Tool[]>([]);
  const selected = useEditor(selectedElement);
  const summary: Partial<Record<Tool, string>> = selected
    ? {
        style: `${selected.color} · ${Math.round(selected.opacity * 100)}%`,
        animate: selected.anim.enabled ? `${animName(selected.anim.type)} · ${secs(selected.anim.duration, 1)}` : t("Off"),
        timing: selected.type === "path" && selected.sketch
          ? t("from {time}", { time: `${secs(selected.sketch.start, 1)}` })
          : selected.time ? `${secs(selected.time.start, 1)} – ${selected.time.end === null ? t("end") : `${secs(selected.time.end, 1)}`}` : t("Whole video"),
      }
    : {};
  const barButton = "shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors";

  return (
    <div className="h-dvh flex flex-col bg-ink text-fg overflow-hidden">
      {/* Project bar: where you are, undo, export */}
      <header className="shrink-0 h-12 flex items-center gap-1 px-2 border-b border-line pt-[env(safe-area-inset-top)]">
        <IconButton icon="back" label={t("Back to projects")} onClick={closeProject} />
        <input
          value={projectName}
          onChange={(e) => renameProject(e.target.value)}
          aria-label={t("Project name")}
          className="flex-1 min-w-0 h-10 px-2 bg-transparent rounded-lg text-[16px] sm:text-[15px] font-semibold truncate focus:bg-chip outline-none"
        />
        {/* Is the work safe? Quiet while it is, loud when it is not */}
        {saveState === "error" ? (
          <button type="button" onClick={() => void retrySave()} className="shrink-0 h-8 px-2.5 rounded-full bg-danger text-white text-[12px] font-semibold whitespace-nowrap" title={t("The last change could not be stored. Tap to try again.")}>{t("Not saved · Retry")}</button>
        ) : (
          <span role="status" className="hidden sm:block shrink-0 px-1 text-[12px] text-fg-subtle whitespace-nowrap">{saveState === "saving" ? t("Saving…") : t("Saved")}</span>
        )}
        <IconButton icon="undo" label={t("Undo")} onClick={undo} disabled={!canUndo} />
        <IconButton icon="redo" label={t("Redo")} onClick={redo} disabled={!canRedo} />
        <IconButton icon="help" label={t("Help")} onClick={() => setHelp(true)} className="hidden min-[420px]:grid" />
        <button type="button" onClick={() => setExporting(true)} className="h-9 px-4 ml-1 mr-1 rounded-full bg-brand hover:bg-brand-hover text-on-brand text-[14px] font-semibold flex items-center gap-1.5">
          <Icon name="export" className="w-4 h-4 hidden min-[420px]:block" /> {t("Export")}
        </button>
      </header>

      {/* Phone: stage, transport, timeline, selection bar, open panel, menu, top to bottom.
          Wide: three columns over the full-width timeline. */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[300px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)_auto]">
        <aside className="order-last lg:order-none lg:col-start-1 lg:row-start-1 shrink-0 min-h-0 flex flex-col bg-panel border-t border-line lg:border-t-0 lg:border-r">
          <nav className="order-last lg:order-first shrink-0 flex justify-around lg:justify-start lg:items-center lg:gap-0.5 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:h-12 lg:px-2 lg:py-0 lg:border-b border-line" aria-label={t("Project tools")}>
            {menu.map((item) => {
              const on = shown?.id === item.id || (wide && projectTool?.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(on && !wide ? null : item.id)}
                  aria-pressed={on}
                  title={t(item.title ?? item.label)}
                  className={`flex-1 lg:flex-none min-w-0 max-w-24 lg:max-w-none h-14 lg:h-8 lg:px-2 flex flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-1.5 rounded-control lg:rounded-full transition-colors ${on ? "text-brand lg:bg-chip-active lg:text-fg" : "text-fg-subtle hover:text-fg lg:hover:bg-chip"}`}
                >
                  <Icon name={item.icon} className="w-5 h-5 lg:w-4 lg:h-4" />
                  <span className="text-[11px] lg:text-[13px] font-semibold">{t(item.label)}</span>
                </button>
              );
            })}
          </nav>

          {/* Group bar (phone): a whole group is selected */}
          {hasGroup && groupSel && (
            <div className="order-first lg:hidden flex items-center gap-2 h-12 pl-3 pr-1 border-b border-line" role="toolbar" aria-label={t("Selected group: {name}", { name: groupName ?? "" })}>
              <span className="shrink-0 max-w-28 truncate text-[13px] font-semibold text-brand">{groupName}</span>
              <span className="shrink-0 text-[12px] text-fg-subtle">{groupCount}</span>
              {/* Only the actions scroll; delete and deselect stay within reach */}
              <span className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">{groupActions}</span>
              <span className="flex shrink-0">
                <IconButton icon="trash" label={t("Delete group")} onClick={() => removeGroup(groupSel)} className="!w-10 !h-10" />
                <IconButton icon="close" label={t("Deselect")} onClick={() => selectGroup(null)} className="!w-10 !h-10" />
              </span>
            </div>
          )}

          {/* Selection bar (phone): appears above the menu while an overlay is selected */}
          {hasSelection && selectedId && (
            <div className="order-first lg:hidden flex items-center gap-1.5 h-12 pl-3 pr-1 border-b border-line" role="toolbar" aria-label={t("Selected: {name}", { name: selectedName ?? "" })}>
              <span className="shrink-0 w-3.5 h-3.5 rounded-sm" style={{ background: selectedColor ?? undefined }} aria-hidden />
              <span className="shrink min-w-0 max-w-24 truncate text-[13px] font-semibold text-fg">{selectedName}</span>
              {/* Only the tools scroll; duplicate, delete and deselect stay within reach */}
              <span className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {OVERLAY_TOOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(overlayTool?.id === item.id ? null : item.id)}
                  aria-pressed={overlayTool?.id === item.id}
                  className={`${barButton} ${overlayTool?.id === item.id ? "bg-brand text-on-brand" : "bg-chip text-fg hover:bg-chip-hover"}`}
                >
                  {t(item.label)}
                </button>
              ))}
              </span>
              <span className="flex shrink-0">
                <IconButton icon="copy" label={t("Duplicate")} onClick={() => duplicate(selectedId)} className="!w-9 !h-10" />
                <IconButton icon="trash" label={t("Delete")} onClick={() => remove(selectedId)} className="!w-9 !h-10" />
                <IconButton icon="close" label={t("Deselect")} onClick={() => select(null)} className="!w-9 !h-10" />
              </span>
            </div>
          )}

          {Panel && shown && (
            <section aria-label={t("{name} options", { name: t(shown.label) })} className="flex flex-col min-h-0 max-h-[40dvh] lg:max-h-none lg:flex-1 border-b border-line lg:border-b-0">
              <header className="shrink-0 flex lg:hidden items-center gap-1.5 h-9 pl-4 pr-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">{t(shown.title ?? shown.label)}</h2>
                <IconButton icon="close" label={t("Close {name}", { name: t(shown.label) })} onClick={() => setTool(null)} className="ml-auto !w-9 !h-9 text-fg-subtle lg:hidden" />
              </header>
              <div className="px-4 py-2 lg:py-3 overflow-y-auto">
                <Panel />
              </div>
            </section>
          )}
        </aside>

        <div className="lg:col-start-2 lg:row-start-1 flex-1 min-h-0 min-w-0 flex flex-col">
          {/* Stage */}
          <main className="relative flex-1 min-h-0 m-1 sm:m-3 lg:m-4 lg:mb-1">
            <EditorCanvas />
            <ModeBar />
            {preview && mode === "select" && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 px-3 h-7 grid place-items-center rounded-full bg-black/70 text-[12px] text-white pointer-events-none whitespace-nowrap">
                {playing ? t("Playing · tap the picture to pause") : t("Frame at {time} · what you add appears from here", { time: `${secs(time, 2)}` })}
              </span>
            )}
          </main>

          {/* Transport, right under the picture */}
          <div className="shrink-0 border-t border-line bg-panel lg:border-t-0 lg:bg-transparent lg:pb-1">
            <Player />
          </div>
        </div>

        {/* Timeline: frames and tracks, across the whole width on a wide screen */}
        <div className="shrink-0 bg-panel lg:col-span-3 lg:row-start-2 lg:border-t border-line">
          <Timeline />
        </div>

        {/* Nothing selected (wide): the right column holds the settings of the picture itself */}
        {!hasGroup && !hasSelection && (
          <aside className="hidden lg:flex lg:col-start-3 lg:row-start-1 min-h-0 flex-col bg-panel border-l border-line" aria-label={t("Canvas")}>
            <header className="shrink-0 flex items-center h-12 px-4 border-b border-line">
              <h2 className="text-[14px] font-semibold text-fg">{t("Canvas")}</h2>
              <span className="ml-auto text-[12px] text-fg-subtle">{t("Select an overlay to edit it")}</span>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3"><CanvasPanel /></div>
          </aside>
        )}

        {/* Group inspector (wide) */}
        {hasGroup && groupSel && (
          <aside className="hidden lg:flex lg:col-start-3 lg:row-start-1 min-h-0 flex-col bg-panel border-l border-line" aria-label={t("Selected group: {name}", { name: groupName ?? "" })}>
            <header className="shrink-0 flex items-center gap-2 h-12 pl-4 pr-1 border-b border-line">
              <h2 className="min-w-0 truncate text-[14px] font-semibold text-brand">{groupName}</h2>
              <span className="shrink-0 text-[12px] text-fg-subtle">{t("group of {n}", { n: groupCount })}</span>
              <span className="ml-auto flex shrink-0">
                <IconButton icon="trash" label={t("Delete group (Del)")} onClick={() => removeGroup(groupSel)} className="!w-9 !h-9" />
                <IconButton icon="close" label={t("Deselect (Esc)")} onClick={() => selectGroup(null)} className="!w-9 !h-9" />
              </span>
            </header>
            <div className="p-4 space-y-3">
              <p className="text-[13px] text-fg-muted">{t("Drag the group on the photo to move all of it. Click one of its overlays again to edit just that one; Esc steps back out to the group.")}</p>
              <div>
                <h4 className="mb-1.5 text-[12px] font-medium text-fg-muted">{t("Move in time")}</h4>
                <div className="flex flex-wrap gap-2">{groupActions}</div>
              </div>
            </div>
          </aside>
        )}

        {/* Inspector (wide): everything about the selected overlay, in sections */}
        {hasSelection && selectedId && (
          <aside className="hidden lg:flex lg:col-start-3 lg:row-start-1 min-h-0 flex-col bg-panel border-l border-line" aria-label={t("Selected: {name}", { name: selectedName ?? "" })}>
            <header className="shrink-0 flex items-center gap-2 h-12 pl-4 pr-1 border-b border-line">
              <span className="shrink-0 w-3.5 h-3.5 rounded-sm" style={{ background: selectedColor ?? undefined }} aria-hidden />
              <h2 className="min-w-0 truncate text-[14px] font-semibold text-fg">{selectedName}</h2>
              <span className="ml-auto flex shrink-0">
                <IconButton icon="copy" label={t("Duplicate (Ctrl/⌘+D)")} onClick={() => duplicate(selectedId)} className="!w-9 !h-9" />
                <IconButton icon="trash" label={t("Delete (Del)")} onClick={() => remove(selectedId)} className="!w-9 !h-9" />
                <IconButton icon="close" label={t("Deselect (Esc)")} onClick={() => select(null)} className="!w-9 !h-9" />
              </span>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {OVERLAY_TOOLS.map((item) => {
                const Section = PANELS[item.id];
                const open = !closed.includes(item.id);
                return (
                  <section key={item.id} aria-label={t(item.label)}>
                    {/* Header band: what this block is, and its current value at a glance */}
                    <button
                      type="button"
                      onClick={() => setClosed(open ? [...closed, item.id] : closed.filter((id) => id !== item.id))}
                      aria-expanded={open}
                      className="sticky top-0 z-10 w-full h-11 flex items-center gap-2.5 px-4 bg-raised border-y border-line text-left"
                    >
                      <span className="w-6 h-6 grid place-items-center rounded-md bg-chip-active text-fg"><Icon name={item.icon} className="w-3.5 h-3.5" /></span>
                      <span className="text-[13px] font-semibold text-fg">{t(item.label)}</span>
                      <span className="ml-auto min-w-0 truncate text-[12px] font-mono text-fg-subtle">{summary[item.id]}</span>
                      <Icon name={open ? "down" : "next"} className="w-3.5 h-3.5 text-fg-subtle" />
                    </button>
                    {open && <div className="px-4 pt-3 pb-5"><Section /></div>}
                  </section>
                );
              })}
            </div>
          </aside>
        )}
      </div>

      {exporting && <ExportSheet onClose={() => setExporting(false)} />}
      {help && <HelpSheet onClose={() => setHelp(false)} />}
      {toast && (
        <div role="status" className={`fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-control text-[13px] font-semibold max-w-[calc(100%-2rem)] ${toast.kind === "error" ? "bg-danger text-white" : "bg-raised text-fg"} shadow-xl`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
