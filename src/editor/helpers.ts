import { create } from "zustand";

// Drawing aids of the editing view: grid, rulers, snapping and the magnifier.
// They belong to the device, not to a project, and never reach the export.

export const GRIDS = ["off", "thirds", "squares", "fine"] as const;
export type GridKind = (typeof GRIDS)[number];

interface Aids { grid: GridKind; rulers: boolean; snap: boolean; loupe: boolean }
const KEY = "ph-helpers";
const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
// A finger hides what it points at, so the magnifier starts on for touch screens
const DEFAULTS: Aids = { grid: "off", rulers: false, snap: true, loupe: coarse };

function load(): Aids {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Aids> | null;
    if (!saved || typeof saved !== "object") return DEFAULTS;
    return {
      grid: GRIDS.includes(saved.grid as GridKind) ? (saved.grid as GridKind) : DEFAULTS.grid,
      rulers: typeof saved.rulers === "boolean" ? saved.rulers : DEFAULTS.rulers,
      snap: typeof saved.snap === "boolean" ? saved.snap : DEFAULTS.snap,
      loupe: typeof saved.loupe === "boolean" ? saved.loupe : DEFAULTS.loupe,
    };
  } catch { return DEFAULTS; }
}

export const useHelpers = create<Aids & { change: (patch: Partial<Aids>) => void }>((set, get) => ({
  ...load(),
  change: (patch) => {
    set(patch);
    const { grid, rulers, snap, loupe } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ grid, rulers, snap, loupe })); } catch { /* not remembered, still applied */ }
  },
}));

/** Where the grid lines of a W x H stage are, per axis. */
export function gridLines(kind: GridKind, w: number, h: number): { xs: number[]; ys: number[] } {
  if (kind === "off") return { xs: [], ys: [] };
  if (kind === "thirds") return { xs: [w / 3, (2 * w) / 3], ys: [h / 3, (2 * h) / 3] };
  // Square cells counted from the centre, so the middle of the stage is always on a line
  const step = w / (kind === "squares" ? 10 : 40);
  const along = (size: number) => {
    const out: number[] = [];
    for (let at = size / 2; at > 0.5; at -= step) out.unshift(at);
    for (let at = size / 2 + step; at < size - 0.5; at += step) out.push(at);
    return out;
  };
  return { xs: along(w), ys: along(h) };
}
