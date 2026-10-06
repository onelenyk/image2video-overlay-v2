import { create } from "zustand";
import { boundsOf, lineEnds } from "../engine/geometry";
import { drawScene, preloadAssets } from "../engine/renderer";
import { makeImage, makePath, makePreset, newScene, normalizeScene, storyLength, videoLength, type Preset } from "../engine/scene";
import type { Quality } from "../engine/exporter";
import { ASPECTS, STAGE_W, type Asset, type El, type Scene, type Stage, type Vec } from "../engine/types";
import { parseSaved, type SavedTemplate } from "../engine/template";
import { currentUser, storage, useSession } from "./session";
import { PROJECT_FORMAT, newId, type ProjectMeta } from "./storage";

export type Tool = "add" | "style" | "animate" | "timing" | "sketch" | "layers" | "canvas";
/** What a press on the canvas does. */
export type Mode = "select" | "draw" | "line" | "polygon" | "sketch";
export type SketchStyle = "pen" | "marker" | "neon";

export interface SketchSettings {
  style: SketchStyle;
  color: string;
  width: number;
  hold: number | null;
}

export interface Narration {
  name: string;
  url: string;
  duration: number;
}

/** "welcome" is the landing page; it is the first screen until it has been left once. */
export type Screen = "welcome" | "home" | "editor" | "signin" | "account";

const WELCOME_SEEN = "plan-highlighter:welcome-seen";
// Storage can be unavailable (private mode, blocked site data); the app then simply shows the welcome again.
const welcomeSeen = () => { try { return localStorage.getItem(WELCOME_SEEN) === "1"; } catch { return false; } };

interface State {
  screen: Screen;
  /** Whether the open project is safely stored. */
  saveState: "saved" | "saving" | "error";
  projects: ProjectMeta[];
  projectId: string | null;
  projectName: string;

  scene: Scene;
  assets: Record<string, Asset>;
  image: HTMLImageElement | null;
  narration: Narration | null;

  selectedId: string | null;
  /** A whole group is selected (moved together) instead of a single overlay. */
  groupSel: string | null;
  /** Templates the user saved from their own overlays. */
  savedTemplates: SavedTemplate[];
  tool: Tool | null;
  addSection: string | null; // last opened section of the Add panel
  mode: Mode;
  draft: Vec[]; // polygon vertices placed so far

  /** Preview shows the real video frame at `time`; otherwise the canvas is in editing view. */
  preview: boolean;
  playing: boolean;
  time: number;

  sketch: SketchSettings;
  exportSettings: { quality: Quality; fps: number };
  canUndo: boolean;
  canRedo: boolean;
  toast: { text: string; kind: "info" | "error" } | null;

  /** Switches between the screens outside the editor. */
  showScreen: (screen: Exclude<Screen, "editor">) => void;
  /** Try storing the open project again after a failed save. */
  retrySave: () => Promise<void>;
  loadProjects: () => Promise<void>;
  newProject: (photo: File | null, aspect?: Stage["aspect"]) => Promise<void>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => Promise<void>;
  renameProject: (name: string) => void;
  deleteProject: (id: string) => Promise<void>;

  setScene: (scene: Scene) => void;
  patch: (id: string, changes: Partial<El>) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;

  select: (id: string | null) => void;
  addPreset: (kind: Preset) => void;
  addElement: (el: El) => void;
  addAssetImage: (asset: Asset) => void;
  /** Add a set of overlays (and the assets they use) as one named group and one undo step. */
  addGroup: (name: string, elements: El[], assets: Record<string, Asset>) => void;
  selectGroup: (group: string | null) => void;
  ungroup: (group: string) => void;
  removeGroup: (group: string) => void;
  /** Move everything in the group that has a time by `seconds` along the timeline. */
  shiftGroup: (group: string, seconds: number) => void;
  /** Save a group (or, with null, every overlay) as a reusable template. */
  saveTemplate: (name: string, group: string | null) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  loadTemplates: () => Promise<void>;
  addStroke: (points: Vec[], times: number[] | null, start: number) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => void;
  reorder: (id: string, where: "front" | "back" | "forward" | "backward") => void;

  setTool: (tool: Tool | null) => void;
  setAddSection: (section: string) => void;
  setMode: (mode: Mode) => void;
  setDraft: (draft: Vec[]) => void;
  setStage: (changes: Partial<Stage>) => void;
  setPhoto: (file: File | null) => Promise<void>;
  setNarration: (file: File | null) => Promise<void>;
  setSketch: (changes: Partial<SketchSettings>) => void;
  setExportSettings: (changes: Partial<State["exportSettings"]>) => void;

  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  exitPreview: () => void;
  /** Called every animation frame by the canvas; advances the clock. */
  frame: () => void;
  startSketch: () => void;
  stopSketch: () => void;

  notify: (text: string, kind?: "info" | "error") => void;
}

// ---- state kept outside React (not rendered, or too big to diff) ----
const HISTORY_LIMIT = 80;
let undoStack: string[] = [];
let redoStack: string[] = [];
let lastSnapshot = "";
let clockOrigin = 0;
let saveTimer = 0;
let flushSave: () => Promise<void> = async () => {};
let toastTimer = 0;
let photoUrl: string | null = null;
let narrationAudio: HTMLAudioElement | null = null;
export const narrationData: { buffer: AudioBuffer | null } = { buffer: null };


function loadImage(blob: Blob): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl = url; resolve(img.naturalWidth ? img : null); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/** Stage with a new height; elements keep their relative vertical position. */
function withStageHeight(scene: Scene, height: number): Scene {
  const h = Math.min(5000, Math.max(200, Math.round(height)));
  const ratio = h / scene.stage.h;
  if (ratio === 1) return scene;
  const scaleY = (p: Vec): Vec => ({ x: p.x, y: p.y * ratio });
  const elements = scene.elements.map((el): El => {
    switch (el.type) {
      case "line": return { ...el, a: scaleY(el.a), b: scaleY(el.b) };
      case "polygon": case "path": return { ...el, points: el.points.map(scaleY) };
      case "point": return { ...el, y: el.y * ratio };
      default: return { ...el, y: (el.y + el.h / 2) * ratio - el.h / 2 };
    }
  });
  return { ...scene, stage: { ...scene.stage, h }, elements };
}

async function decodeAudio(blob: Blob): Promise<AudioBuffer | null> {
  try {
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    await context.close();
    return buffer;
  } catch {
    return null;
  }
}

export const sketchLook = (s: SketchSettings) =>
  s.style === "marker" ? { width: s.width * 4, opacity: 0.4, glow: 0 } : s.style === "neon" ? { width: s.width, opacity: 1, glow: 12 } : { width: s.width, opacity: 1, glow: 0 };

export const useEditor = create<State>((set, get) => {
  const resetHistory = () => {
    undoStack = [];
    redoStack = [];
    lastSnapshot = JSON.stringify(get().scene);
    set({ canUndo: false, canRedo: false });
  };

  const makeThumb = async (): Promise<string> => {
    const { scene, assets, image } = get();
    await preloadAssets(assets);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = Math.round((320 * scene.stage.h) / scene.stage.w);
    drawScene(canvas.getContext("2d")!, scene, { width: canvas.width, height: canvas.height, assets, image, time: null });
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  const saveNow = async () => {
    clearTimeout(saveTimer);
    saveTimer = 0;
    const { projectId, projectName, scene, assets, narration, projects } = get();
    if (!projectId) return;
    set({ saveState: "saving" });
    const known = projects.find((p) => p.id === projectId);
    const record = {
      id: projectId, name: projectName, ownerId: known?.ownerId ?? currentUser().id, createdAt: known?.createdAt ?? Date.now(), updatedAt: Date.now(),
      thumb: await makeThumb(), format: PROJECT_FORMAT, scene, assets, narrationName: narration?.name,
    };
    try {
      await storage.putProject(record);
    } catch (error) {
      console.warn("Could not save the project:", error);
      set({ saveState: "error" });
      return;
    }
    const meta: ProjectMeta = { id: record.id, name: record.name, ownerId: record.ownerId, createdAt: record.createdAt, updatedAt: record.updatedAt, thumb: record.thumb };
    // Newer edits may be waiting already: only then is it not "saved" yet
    set((state) => ({ projects: [meta, ...state.projects.filter((p) => p.id !== projectId)], saveState: saveTimer ? "saving" : "saved" }));
  };
  flushSave = async () => { if (saveTimer || get().screen === "editor") await saveNow(); };
  const saveSoon = () => {
    clearTimeout(saveTimer);
    if (get().saveState !== "saving") set({ saveState: "saving" });
    saveTimer = window.setTimeout(saveNow, 600);
  };

  const restore = (snapshot: string) => {
    const scene = JSON.parse(snapshot) as Scene;
    lastSnapshot = snapshot;
    const selectedId = scene.elements.some((el) => el.id === get().selectedId) ? get().selectedId : null;
    const groupSel = scene.elements.some((el) => el.group === get().groupSel) ? get().groupSel : null;
    set({ scene, selectedId, groupSel, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
    saveSoon();
  };

  const stopAudio = () => {
    narrationAudio?.pause();
    narrationAudio = null;
  };
  const startAudio = (from: number) => {
    stopAudio();
    const { narration } = get();
    if (!narration || from >= narration.duration) return;
    narrationAudio = new Audio(narration.url);
    narrationAudio.currentTime = from;
    narrationAudio.play().catch(() => { /* autoplay may be blocked; the timeline still runs */ });
  };

  const openEditor = (id: string, name: string, scene: Scene, assets: Record<string, Asset>) => {
    set({ screen: "editor", saveState: "saved", projectId: id, projectName: name, scene, assets, selectedId: null, groupSel: null, tool: null, mode: "select", draft: [], preview: false, playing: false, time: 0 });
    resetHistory();
  };

  return {
    screen: welcomeSeen() ? "home" : "welcome",
    saveState: "saved",
    projects: [],
    projectId: null,
    projectName: "",
    scene: newScene(),
    assets: {},
    image: null,
    narration: null,
    selectedId: null,
    groupSel: null,
    savedTemplates: [],
    tool: null,
    addSection: null,
    mode: "select",
    draft: [],
    preview: false,
    playing: false,
    time: 0,
    sketch: { style: "pen", color: "#ef4444", width: 8, hold: null },
    exportSettings: { quality: "1080", fps: 30 },
    canUndo: false,
    canRedo: false,
    toast: null,

    showScreen: (screen) => set({ screen }),
    retrySave: () => saveNow(),

    loadProjects: async () => {
      try { set({ projects: await storage.listProjects() }); }
      catch (error) { console.warn(error); get().notify("Could not load your projects. Check the connection.", "error"); }
    },

    newProject: async (photo, aspect = "9:16") => {
      const id = newId();
      let scene = newScene(ASPECTS[aspect === "image" ? "9:16" : aspect], photo ? "image" : aspect);
      let image: HTMLImageElement | null = null;
      if (photo) {
        image = await loadImage(photo);
        if (!image) { get().notify("Could not read that image.", "error"); return; }
        scene = withStageHeight(scene, (STAGE_W * image.naturalHeight) / image.naturalWidth);
        try { await storage.putFile(id, "image", photo); } catch { get().notify("Could not store the photo on this device.", "error"); return; }
      }
      stopAudio();
      narrationData.buffer = null;
      set({ image, narration: null });
      const count = get().projects.length + 1;
      openEditor(id, photo?.name.replace(/\.[^.]+$/, "").slice(0, 40) || `Project ${count}`, scene, {});
      await saveNow();
    },

    openProject: async (id) => {
      const record = await storage.getProject(id).catch(() => null);
      const scene = record && normalizeScene(record.scene);
      if (!record || !scene) { get().notify("That project could not be opened.", "error"); return; }
      const photo = await storage.getFile(id, "image");
      const image = photo ? await loadImage(photo) : null;
      const audio = await storage.getFile(id, "audio");
      stopAudio();
      narrationData.buffer = audio ? await decodeAudio(audio) : null;
      const narration = audio && narrationData.buffer ? { name: record.narrationName || "Narration", url: URL.createObjectURL(audio), duration: narrationData.buffer.duration } : null;
      set({ image, narration });
      openEditor(id, record.name, scene, record.assets || {});
    },

    closeProject: async () => {
      stopAudio();
      await saveNow();
      set({ screen: "home", projectId: null, preview: false, playing: false, mode: "select", tool: null });
    },

    renameProject: (name) => {
      set({ projectName: name.slice(0, 60) || "Untitled" });
      saveSoon();
    },

    deleteProject: async (id) => {
      try { await storage.removeProject(id); } catch { get().notify("Could not delete that project.", "error"); return; }
      set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
    },

    setScene: (scene) => set({ scene }),

    patch: (id, changes) =>
      set((state) => ({ scene: { ...state.scene, elements: state.scene.elements.map((el) => (el.id === id ? ({ ...el, ...changes } as El) : el)) } })),

    commit: () => {
      const snapshot = JSON.stringify(get().scene);
      if (snapshot === lastSnapshot) return;
      undoStack.push(lastSnapshot);
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack = [];
      lastSnapshot = snapshot;
      set({ canUndo: true, canRedo: false });
      saveSoon();
    },

    undo: () => {
      get().commit(); // an edit still in progress (a nudge, a dragged slider) becomes its own step first
      if (!undoStack.length) return;
      redoStack.push(lastSnapshot);
      restore(undoStack.pop()!);
    },
    redo: () => {
      get().commit();
      if (!redoStack.length) return;
      undoStack.push(lastSnapshot);
      restore(redoStack.pop()!);
    },

    select: (id) => {
      if (get().selectedId !== id || get().groupSel) set({ selectedId: id, groupSel: null });
    },

    addPreset: (kind) => get().addElement(makePreset(get().scene, kind)),

    addElement: (el) => {
      // Added while parked on a frame: the element belongs to that moment
      const { preview, playing, time } = get();
      if (preview && !playing && time > 0.05 && !el.time) {
        el = { ...el, time: { start: Math.round(time * 100) / 100, end: null, fade: 0.2 } };
        get().notify(`Appears at ${time.toFixed(1)}s. Change it in Timing.`);
      }
      set((state) => ({ scene: { ...state.scene, elements: [...state.scene.elements, el], nextId: state.scene.nextId + 1 }, selectedId: el.id, groupSel: null }));
      get().commit();
    },

    addAssetImage: (asset) => {
      const { scene, assets, selectedId } = get();
      // Reuse an identical asset instead of storing it twice
      const key = Object.keys(assets).find((k) => assets[k].data === asset.data) ?? `a${Date.now().toString(36)}`;
      const current = scene.elements.find((el) => el.id === selectedId);
      set({ assets: { ...assets, [key]: asset } });
      get().addElement(makeImage(scene, key, asset, current?.color));
    },

    addGroup: (name, elements, assets) => {
      const { scene } = get();
      let next = scene.nextId;
      const group = `g${next}`;
      const fresh = elements.map((el) => ({ ...el, id: `e${next++}`, group }));
      set({
        assets: { ...get().assets, ...assets },
        scene: { ...scene, elements: [...scene.elements, ...fresh], nextId: next, groups: { ...scene.groups, [group]: { name: name.slice(0, 40) } } },
        selectedId: null,
        groupSel: group,
      });
      get().commit();
    },

    selectGroup: (group) => set({ groupSel: group, selectedId: null }),

    ungroup: (group) => {
      const { scene } = get();
      const groups = { ...scene.groups };
      delete groups[group];
      set({ scene: { ...scene, groups, elements: scene.elements.map((el) => (el.group === group ? { ...el, group: undefined } : el)) }, groupSel: null });
      get().commit();
    },

    removeGroup: (group) => {
      const { scene } = get();
      const gone = new Set(scene.elements.filter((el) => el.group === group).map((el) => el.id));
      const lost = (ref?: { id: string }) => !!ref && gone.has(ref.id);
      // Lines outside the group that were attached to something in it keep their position
      const elements = scene.elements.filter((el) => !gone.has(el.id)).map((el): El => {
        if (el.type !== "line" || (!lost(el.aRef) && !lost(el.bRef))) return el;
        const ends = lineEnds(el, scene);
        return { ...el, a: lost(el.aRef) ? ends.a : el.a, b: lost(el.bRef) ? ends.b : el.b, aRef: lost(el.aRef) ? undefined : el.aRef, bRef: lost(el.bRef) ? undefined : el.bRef };
      });
      const groups = { ...scene.groups };
      delete groups[group];
      set({ scene: { ...scene, elements, groups }, groupSel: null, selectedId: null });
      get().commit();
    },

    shiftGroup: (group, seconds) => {
      const { scene } = get();
      const members = scene.elements.filter((el) => el.group === group);
      const starts = members.map((el) => (el.type === "path" && el.sketch ? el.sketch.start : el.time?.start)).filter((v): v is number => v != null);
      if (!starts.length) return;
      const dt = Math.max(seconds, -Math.min(...starts)); // nothing may start before 0
      const round = (v: number) => Math.round(v * 100) / 100;
      set({
        scene: {
          ...scene,
          elements: scene.elements.map((el): El => {
            if (el.group !== group) return el;
            if (el.type === "path" && el.sketch) return { ...el, sketch: { ...el.sketch, start: round(el.sketch.start + dt) } };
            return el.time ? { ...el, time: { ...el.time, start: round(el.time.start + dt), end: el.time.end === null ? null : round(el.time.end + dt) } } : el;
          }),
        },
      });
      get().commit();
    },

    saveTemplate: async (name, group) => {
      const { scene, assets, savedTemplates } = get();
      const elements = scene.elements.filter((el) => (group ? el.group === group : true));
      const used = new Set(elements.map((el) => (el.type === "image" ? el.asset : "")));
      // Validate exactly as it will be validated when loaded back
      const saved = parseSaved({
        v: 1, kind: "snapshot", id: newId(), name: name.trim().slice(0, 40) || "My template",
        w: scene.stage.w, h: scene.stage.h, elements,
        assets: Object.fromEntries(Object.entries(assets).filter(([key]) => used.has(key))),
      });
      if (!saved) { get().notify("Nothing to save as a template.", "error"); return; }
      try { await storage.putTemplate(saved.id, saved); } catch { get().notify("Could not save the template on this device.", "error"); return; }
      set({ savedTemplates: [...savedTemplates, saved] });
      get().notify(`Saved “${saved.name}” to Templates.`);
    },

    deleteTemplate: async (id) => {
      try { await storage.removeTemplate(id); } catch { get().notify("Could not delete that template.", "error"); return; }
      set({ savedTemplates: get().savedTemplates.filter((t) => t.id !== id) });
    },

    loadTemplates: async () => {
      // Stored data is checked like any other before it is used
      let stored: unknown[] = [];
      try { stored = await storage.listTemplates(); } catch (error) { console.warn(error); }
      const list = stored.slice(0, 100).map(parseSaved).filter((t): t is SavedTemplate => t !== null);
      set({ savedTemplates: list });
    },

    addStroke: (points, times, start) => {
      const { scene, sketch } = get();
      const look = sketchLook(sketch); // the same pen for one-off strokes and live sketching
      if (times) {
        const el = makePath(scene, points, { color: sketch.color, ...look, sketch: { start, times, hold: sketch.hold, fade: 0.4 } });
        // Strokes are added while the clock runs: do not steal the selection
        set((state) => ({ scene: { ...state.scene, elements: [...state.scene.elements, el], nextId: state.scene.nextId + 1 } }));
        get().commit();
      } else {
        get().addElement(makePath(scene, points, { color: sketch.color, ...look, smooth: points.length > 2 }));
      }
    },

    remove: (id) => {
      const { scene } = get();
      const index = scene.elements.findIndex((el) => el.id === id);
      if (index < 0) return;
      // Lines attached to the removed element keep their current position
      const elements = scene.elements
        .filter((el) => el.id !== id)
        .map((el): El => {
          if (el.type !== "line" || (el.aRef?.id !== id && el.bRef?.id !== id)) return el;
          const ends = lineEnds(el, scene);
          return { ...el, a: el.aRef?.id === id ? ends.a : el.a, b: el.bRef?.id === id ? ends.b : el.b, aRef: el.aRef?.id === id ? undefined : el.aRef, bRef: el.bRef?.id === id ? undefined : el.bRef };
        });
      set({ scene: { ...scene, elements }, selectedId: get().selectedId === id ? null : get().selectedId });
      get().commit();
    },

    duplicate: (id) => {
      const { scene } = get();
      const source = scene.elements.find((el) => el.id === id);
      if (!source) return;
      const copy = JSON.parse(JSON.stringify(source)) as El;
      copy.id = `e${scene.nextId}`;
      copy.name = `${source.name} copy`.slice(0, 40);
      const shift = (p: Vec) => ({ x: p.x + 30, y: p.y + 30 });
      if (copy.type === "line") {
        // Start from where the ends actually are: an attached end follows its target
        const ends = source.type === "line" ? lineEnds(source, scene) : copy;
        copy.a = shift(ends.a); copy.b = shift(ends.b); delete copy.aRef; delete copy.bRef;
      }
      else if (copy.type === "polygon" || copy.type === "path") copy.points = copy.points.map(shift);
      else { copy.x += 30; copy.y += 30; }
      const elements = [...scene.elements];
      elements.splice(elements.indexOf(source) + 1, 0, copy);
      set({ scene: { ...scene, elements, nextId: scene.nextId + 1 }, selectedId: copy.id, groupSel: null });
      get().commit();
    },

    reorder: (id, where) => {
      const { scene } = get();
      const list = [...scene.elements];
      const i = list.findIndex((el) => el.id === id);
      if (i < 0) return;
      const [el] = list.splice(i, 1);
      const j = where === "front" ? list.length : where === "back" ? 0 : Math.min(list.length, Math.max(0, i + (where === "forward" ? 1 : -1)));
      list.splice(j, 0, el);
      set({ scene: { ...scene, elements: list } });
      get().commit();
    },

    setTool: (tool) => set({ tool }),
    setAddSection: (addSection) => set({ addSection }),

    setMode: (mode) => {
      if (get().mode === "sketch" && mode !== "sketch") get().stopSketch();
      set({ mode, draft: [], selectedId: mode === "select" ? get().selectedId : null, groupSel: mode === "select" ? get().groupSel : null });
    },

    setDraft: (draft) => set({ draft }),

    setStage: (changes) => {
      let scene = { ...get().scene, stage: { ...get().scene.stage, ...changes } };
      if (changes.aspect) {
        const image = get().image;
        const ratio = changes.aspect === "image" ? (image ? image.naturalHeight / image.naturalWidth : null) : ASPECTS[changes.aspect];
        if (ratio) scene = withStageHeight({ ...scene, stage: { ...scene.stage, h: get().scene.stage.h } }, STAGE_W * ratio);
      }
      set({ scene });
    },

    setPhoto: async (file) => {
      const { projectId, scene } = get();
      if (!projectId) return;
      if (!file) {
        await storage.removeFile(projectId, "image").catch(() => {});
        set({ image: null, scene: scene.stage.aspect === "image" ? { ...scene, stage: { ...scene.stage, aspect: "9:16" } } : scene });
      } else {
        const image = await loadImage(file);
        if (!image) { get().notify("Could not read that image.", "error"); return; }
        try { await storage.putFile(projectId, "image", file); } catch { get().notify("Could not store the photo on this device.", "error"); return; }
        set({ image, scene: scene.stage.aspect === "image" ? withStageHeight(scene, (STAGE_W * image.naturalHeight) / image.naturalWidth) : scene });
      }
      // The photo itself is not in the undo history, so stepping back across this
      // point would pair the old layout with the new photo. Start history afresh.
      resetHistory();
      saveSoon();
    },

    setNarration: async (file) => {
      const { projectId, narration } = get();
      if (!projectId) return;
      stopAudio();
      if (narration) URL.revokeObjectURL(narration.url);
      if (!file) {
        narrationData.buffer = null;
        await storage.removeFile(projectId, "audio").catch(() => {});
        set({ narration: null });
      } else {
        const buffer = await decodeAudio(file);
        if (!buffer) { get().notify("Could not read that audio file.", "error"); return; }
        narrationData.buffer = buffer;
        try { await storage.putFile(projectId, "audio", file); } catch { get().notify("Could not store the audio on this device.", "error"); return; }
        set({ narration: { name: file.name, url: URL.createObjectURL(file), duration: buffer.duration } });
      }
      saveSoon();
    },

    setSketch: (changes) => set((state) => ({ sketch: { ...state.sketch, ...changes } })),
    setExportSettings: (changes) => set((state) => ({ exportSettings: { ...state.exportSettings, ...changes } })),

    play: () => {
      const { scene, narration, time } = get();
      const length = videoLength(scene, narration?.duration).seconds;
      const from = time >= length - 0.05 ? 0 : time;
      clockOrigin = performance.now() - from * 1000;
      startAudio(from);
      set({ playing: true, preview: true, time: from, selectedId: null, groupSel: null });
    },

    pause: () => {
      stopAudio();
      set({ playing: false });
    },

    seek: (time) => {
      stopAudio();
      const length = videoLength(get().scene, get().narration?.duration).seconds;
      // The selection stays, so an element's timing can be set while scrubbing
      set({ time: Math.min(length, Math.max(0, time)), preview: true, playing: false });
    },

    exitPreview: () => {
      stopAudio();
      set({ preview: false, playing: false });
    },

    frame: () => {
      const state = get();
      if (!state.playing) return;
      const time = (performance.now() - clockOrigin) / 1000;
      if (state.mode === "sketch") { set({ time }); return; } // sketching runs until stopped
      const length = videoLength(state.scene, state.narration?.duration);
      if (time < length.seconds) { set({ time }); return; }
      if (length.kind === "loop") {
        // Seamless loops keep playing
        clockOrigin = performance.now() - (time % length.seconds) * 1000;
        set({ time: time % length.seconds });
      } else {
        stopAudio();
        set({ time: length.seconds, playing: false });
      }
    },

    startSketch: () => {
      // Continue from the playhead, or after the existing strokes, so sessions do not overlap
      const from = get().preview ? get().time : Math.ceil(storyLength(get().scene) * 10) / 10;
      clockOrigin = performance.now() - from * 1000;
      startAudio(from);
      set({ mode: "sketch", playing: true, preview: true, time: from, selectedId: null, groupSel: null, draft: [] });
    },

    stopSketch: () => {
      stopAudio();
      set({ mode: "select", playing: false });
    },

    notify: (text, kind = "info") => {
      clearTimeout(toastTimer);
      set({ toast: { text, kind } });
      toastTimer = window.setTimeout(() => set({ toast: null }), kind === "error" ? 4500 : 2200);
    },
  };
});

// The welcome counts as seen once the user moves on from it, whichever way they leave.
useEditor.subscribe((state, previous) => {
  if (previous.screen !== "welcome" || state.screen === "welcome") return;
  try { localStorage.setItem(WELCOME_SEEN, "1"); } catch { /* see welcomeSeen */ }
});

export const selectedElement = (state: State): El | null => state.scene.elements.find((el) => el.id === state.selectedId) ?? null;
export { boundsOf };

// Phones kill background tabs without warning: save when the page is hidden or closed
window.addEventListener("pagehide", () => { void flushSave(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushSave(); });

// Handy for debugging from the browser console in development
if (import.meta.env.DEV) Object.assign(window, { __editor: useEditor });

// Signing in or out changes whose projects these are: show that person's
let sessionUser = useSession.getState().user.id;
useSession.subscribe((session) => {
  if (!session.ready || session.user.id === sessionUser) return;
  sessionUser = session.user.id;
  const state = useEditor.getState();
  if (state.screen === "editor") useEditor.setState({ screen: "home", projectId: null, preview: false, playing: false, mode: "select", tool: null });
  useEditor.setState({ projects: [], savedTemplates: [] });
  void state.loadProjects();
  void state.loadTemplates();
});
