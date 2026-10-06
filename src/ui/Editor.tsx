import { useEffect, useState, useSyncExternalStore } from "react";
import { makePolygon } from "../engine/scene";
import { EditorCanvas } from "../editor/EditorCanvas";
import { ANIMATIONS } from "../engine/animations";
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

// The main menu never changes: these tools work on the whole project. Selecting
// an overlay adds to it: a selection bar on a phone, an inspector column on a
// wide screen, both offering that overlay's own tools.
interface ToolItem { id: Tool; label: string; icon: string; title?: string }
const PROJECT_TOOLS: ToolItem[] = [
  { id: "add", label: "Add", icon: "plus", title: "Add overlay" },
  { id: "sketch", label: "Draw", icon: "sketch" },
  { id: "layers", label: "Overlays", icon: "layers" },
  { id: "canvas", label: "Canvas", icon: "canvas" },
];
const OVERLAY_TOOLS: ToolItem[] = [
  { id: "style", label: "Style", icon: "style" },
  { id: "animate", label: "Animate", icon: "animate" },
  { id: "timing", label: "Timing", icon: "timing" },
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
    draw: "Draw on the photo",
    line: "Drag from start to end",
    polygon: draft.length < 3 ? `Tap to place corners (${draft.length})` : "Tap the first corner to close the shape",
    sketch: `Sketching · ${time.toFixed(1)}s`,
    select: "",
  }[mode];
  const pill = "h-9 px-3 rounded-full text-[13px] font-semibold";
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 pl-4 pr-1.5 h-12 rounded-full bg-brand text-on-brand shadow-lg max-w-[calc(100%-1rem)]">
      <span className="text-[13px] font-bold truncate">{text}</span>
      {mode === "polygon" && draft.length >= 2 && (
        <button type="button" className={`${pill} bg-black/15`} onClick={() => { addElement(makePolygon(scene, draft, false)); setMode("select"); }}>Finish open</button>
      )}
      <button type="button" className={`${pill} bg-on-brand text-brand`} onClick={() => (mode === "sketch" ? stopSketch() : setMode("select"))}>
        {mode === "sketch" ? "Stop" : "Cancel"}
      </button>
    </div>
  );
}

export function Editor() {
  const { projectName, renameProject, closeProject, undo, redo, canUndo, canRedo, tool, setTool, selectedId, select, duplicate, remove, toast, preview, playing, time, mode } = useEditor();
  const selectedName = useEditor((s) => s.scene.elements.find((el) => el.id === s.selectedId)?.name ?? null);
  const [exporting, setExporting] = useState(false);
  const [help, setHelp] = useState(false);
  const { groupSel, selectGroup, ungroup, removeGroup, shiftGroup, saveTemplate, loadTemplates } = useEditor();
  const groupName = useEditor((state) => (state.groupSel ? state.scene.groups?.[state.groupSel]?.name ?? "Group" : null));
  const groupCount = useEditor((state) => (state.groupSel ? state.scene.elements.filter((el) => el.group === state.groupSel).length : 0));
  useEffect(() => { void loadTemplates(); }, [loadTemplates]);
  const hasGroup = !!groupSel && mode === "select";
  const groupActions = groupSel && (
    <>
      <button type="button" onClick={() => shiftGroup(groupSel, -0.5)} className={`${"shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap"} bg-chip text-fg hover:bg-chip-hover`} title="Start the whole group half a second earlier">−0.5s</button>
      <button type="button" onClick={() => shiftGroup(groupSel, 0.5)} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap bg-chip text-fg hover:bg-chip-hover" title="Start the whole group half a second later">+0.5s</button>
      <button type="button" onClick={() => saveTemplate(groupName ?? "My template", groupSel)} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap bg-chip text-fg hover:bg-chip-hover">Save as template</button>
      <button type="button" onClick={() => ungroup(groupSel)} className="shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap bg-chip text-fg hover:bg-chip-hover">Ungroup</button>
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
  const projectTool = projectChoice ?? (wide ? PROJECT_TOOLS.find((item) => item.id === lastProjectTool)! : null);
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
        animate: selected.anim.enabled ? `${ANIMATIONS[selected.anim.type].label} · ${selected.anim.duration.toFixed(1)}s` : "Off",
        timing: selected.type === "path" && selected.sketch
          ? `from ${selected.sketch.start.toFixed(1)}s`
          : selected.time ? `${selected.time.start.toFixed(1)}s – ${selected.time.end === null ? "end" : `${selected.time.end.toFixed(1)}s`}` : "Whole video",
      }
    : {};
  const barButton = "shrink-0 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors";

  return (
    <div className="h-dvh flex flex-col bg-ink text-fg overflow-hidden">
      {/* Project bar: where you are, undo, export */}
      <header className="shrink-0 h-12 flex items-center gap-1 px-2 border-b border-line pt-[env(safe-area-inset-top)]">
        <IconButton icon="back" label="Back to projects" onClick={closeProject} />
        <input
          value={projectName}
          onChange={(e) => renameProject(e.target.value)}
          aria-label="Project name"
          className="flex-1 min-w-0 h-10 px-2 bg-transparent rounded-lg text-[16px] sm:text-[15px] font-semibold truncate focus:bg-chip outline-none"
        />
        <IconButton icon="undo" label="Undo" onClick={undo} disabled={!canUndo} />
        <IconButton icon="redo" label="Redo" onClick={redo} disabled={!canRedo} />
        <IconButton icon="help" label="Help" onClick={() => setHelp(true)} className="hidden min-[420px]:grid" />
        <button type="button" onClick={() => setExporting(true)} className="h-9 px-4 ml-1 mr-1 rounded-full bg-brand hover:bg-brand-hover text-on-brand text-[14px] font-semibold flex items-center gap-1.5">
          <Icon name="export" className="w-4 h-4 hidden min-[420px]:block" /> Export
        </button>
      </header>

      {/* Phone: stage, time controls, selection bar, open panel, menu, top to bottom.
          Wide: menu and its panel on the left, stage and time in the middle,
          the selected overlay's inspector on the right. */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <aside className="order-last lg:order-first shrink-0 min-h-0 flex flex-col lg:flex-row bg-panel border-t border-line lg:border-t-0 lg:border-r">
          <nav className="order-last lg:order-first flex lg:flex-col justify-around lg:justify-start lg:gap-1 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:w-[76px] lg:px-2 lg:py-3 lg:border-r border-line" aria-label="Project tools">
            {PROJECT_TOOLS.map((item) => {
              const on = shown?.id === item.id || (wide && projectTool?.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(on && !wide ? null : item.id)}
                  aria-pressed={on}
                  title={item.title ?? item.label}
                  className={`flex-1 lg:flex-none min-w-0 max-w-24 lg:max-w-none h-14 lg:h-[60px] flex flex-col items-center justify-center gap-0.5 lg:gap-1 rounded-control transition-colors ${on ? "text-brand lg:bg-chip" : "text-fg-subtle hover:text-fg lg:hover:bg-chip"}`}
                >
                  <Icon name={item.icon} />
                  <span className="text-[11px] font-semibold">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Group bar (phone): a whole group is selected */}
          {hasGroup && groupSel && (
            <div className="order-first lg:hidden flex items-center gap-2 h-12 pl-3 pr-1 border-b border-line" role="toolbar" aria-label={`Selected group: ${groupName}`}>
              <span className="shrink-0 max-w-28 truncate text-[13px] font-semibold text-brand">{groupName}</span>
              <span className="shrink-0 text-[12px] text-fg-subtle">{groupCount}</span>
              {/* Only the actions scroll; delete and deselect stay within reach */}
              <span className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">{groupActions}</span>
              <span className="flex shrink-0">
                <IconButton icon="trash" label="Delete group" onClick={() => removeGroup(groupSel)} className="!w-10 !h-10" />
                <IconButton icon="close" label="Deselect" onClick={() => selectGroup(null)} className="!w-10 !h-10" />
              </span>
            </div>
          )}

          {/* Selection bar (phone): appears above the menu while an overlay is selected */}
          {hasSelection && selectedId && (
            <div className="order-first lg:hidden flex items-center gap-1.5 h-12 pl-3 pr-1 border-b border-line overflow-x-auto no-scrollbar" role="toolbar" aria-label={`Selected: ${selectedName}`}>
              <span className="shrink-0 w-3.5 h-3.5 rounded-sm" style={{ background: selectedColor ?? undefined }} aria-hidden />
              <span className="shrink min-w-12 max-w-28 truncate text-[13px] font-semibold text-fg">{selectedName}</span>
              {OVERLAY_TOOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTool(overlayTool?.id === item.id ? null : item.id)}
                  aria-pressed={overlayTool?.id === item.id}
                  className={`${barButton} ${overlayTool?.id === item.id ? "bg-brand text-on-brand" : "bg-chip text-fg hover:bg-chip-hover"}`}
                >
                  {item.label}
                </button>
              ))}
              <span className="ml-auto flex shrink-0">
                <IconButton icon="copy" label="Duplicate" onClick={() => duplicate(selectedId)} className="!w-10 !h-10" />
                <IconButton icon="trash" label="Delete" onClick={() => remove(selectedId)} className="!w-10 !h-10" />
                <IconButton icon="close" label="Deselect" onClick={() => select(null)} className="!w-10 !h-10" />
              </span>
            </div>
          )}

          {Panel && shown && (
            <section aria-label={`${shown.label} options`} className="flex flex-col min-h-0 max-h-[40dvh] lg:max-h-none lg:w-[320px] border-b border-line lg:border-b-0">
              <header className="shrink-0 flex items-center gap-1.5 h-9 lg:h-12 pl-4 pr-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">{shown.title ?? shown.label}</h2>
                <IconButton icon="close" label={`Close ${shown.label}`} onClick={() => setTool(null)} className="ml-auto !w-9 !h-9 text-fg-subtle lg:hidden" />
              </header>
              <div className="px-4 py-2 overflow-y-auto">
                <Panel />
              </div>
            </section>
          )}
        </aside>

        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
          {/* Stage */}
          <main className="relative flex-1 min-h-0 m-1 sm:m-3 lg:m-6">
            <EditorCanvas />
            <ModeBar />
            {preview && mode === "select" && (
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 px-3 h-7 grid place-items-center rounded-full bg-black/70 text-[12px] text-white pointer-events-none whitespace-nowrap">
                {playing ? "Playing · tap the picture to pause" : `Frame at ${time.toFixed(2)}s · what you add appears from here`}
              </span>
            )}
          </main>

          {/* Time: player on top, timeline under it */}
          <div className="shrink-0 border-t border-line bg-panel">
            <div className="max-w-5xl mx-auto">
              <Player />
              <Timeline />
            </div>
          </div>
        </div>

        {/* Group inspector (wide) */}
        {hasGroup && groupSel && (
          <aside className="hidden lg:flex shrink-0 w-[320px] min-h-0 flex-col bg-panel border-l border-line" aria-label={`Selected group: ${groupName}`}>
            <header className="shrink-0 flex items-center gap-2 h-12 pl-4 pr-1 border-b border-line">
              <h2 className="min-w-0 truncate text-[14px] font-semibold text-brand">{groupName}</h2>
              <span className="shrink-0 text-[12px] text-fg-subtle">group of {groupCount}</span>
              <span className="ml-auto flex shrink-0">
                <IconButton icon="trash" label="Delete group (Del)" onClick={() => removeGroup(groupSel)} className="!w-9 !h-9" />
                <IconButton icon="close" label="Deselect (Esc)" onClick={() => selectGroup(null)} className="!w-9 !h-9" />
              </span>
            </header>
            <div className="p-4 space-y-3">
              <p className="text-[13px] text-fg-muted">Drag the group on the photo to move all of it. Click one of its overlays again to edit just that one; Esc steps back out to the group.</p>
              <div>
                <h4 className="mb-1.5 text-[12px] font-medium text-fg-muted">Move in time</h4>
                <div className="flex flex-wrap gap-2">{groupActions}</div>
              </div>
            </div>
          </aside>
        )}

        {/* Inspector (wide): everything about the selected overlay, in sections */}
        {hasSelection && selectedId && (
          <aside className="hidden lg:flex shrink-0 w-[320px] min-h-0 flex-col bg-panel border-l border-line" aria-label={`Selected: ${selectedName}`}>
            <header className="shrink-0 flex items-center gap-2 h-12 pl-4 pr-1 border-b border-line">
              <span className="shrink-0 w-3.5 h-3.5 rounded-sm" style={{ background: selectedColor ?? undefined }} aria-hidden />
              <h2 className="min-w-0 truncate text-[14px] font-semibold text-fg">{selectedName}</h2>
              <span className="ml-auto flex shrink-0">
                <IconButton icon="copy" label="Duplicate (Ctrl/⌘+D)" onClick={() => duplicate(selectedId)} className="!w-9 !h-9" />
                <IconButton icon="trash" label="Delete (Del)" onClick={() => remove(selectedId)} className="!w-9 !h-9" />
                <IconButton icon="close" label="Deselect (Esc)" onClick={() => select(null)} className="!w-9 !h-9" />
              </span>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {OVERLAY_TOOLS.map((item) => {
                const Section = PANELS[item.id];
                const open = !closed.includes(item.id);
                return (
                  <section key={item.id} aria-label={item.label}>
                    {/* Header band: what this block is, and its current value at a glance */}
                    <button
                      type="button"
                      onClick={() => setClosed(open ? [...closed, item.id] : closed.filter((id) => id !== item.id))}
                      aria-expanded={open}
                      className="sticky top-0 z-10 w-full h-11 flex items-center gap-2.5 px-4 bg-raised border-y border-line text-left"
                    >
                      <span className="w-6 h-6 grid place-items-center rounded-md bg-chip-active text-fg"><Icon name={item.icon} className="w-3.5 h-3.5" /></span>
                      <span className="text-[13px] font-semibold text-fg">{item.label}</span>
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
