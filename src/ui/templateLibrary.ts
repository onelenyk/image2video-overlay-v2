import { parseTemplate, type TemplateSpec } from "../engine/template";

// The bundled templates. They are plain data in the same format a template
// from anywhere else would use, and they go through the same validation.
// Coordinates are fractions of the stage; colours and sizes are style tokens.
const RAW: unknown[] = [
  // ---------- Interiors ----------
  { v: 1, id: "room-tour", name: "Room tour", group: "Interiors", hint: "Rooms light up one after another, each with its name", parts: [
    { kind: "zone", x: 0.08, y: 0.1, w: 0.4, h: 0.32, label: "Living room", at: 0, tone: "accent", anim: { type: "pulse", seconds: 1.6 } },
    { kind: "zone", x: 0.54, y: 0.1, w: 0.38, h: 0.26, label: "Kitchen", at: 1.2, tone: "info" },
    { kind: "zone", x: 0.08, y: 0.5, w: 0.36, h: 0.38, label: "Bedroom", at: 2.4, tone: "success" },
    { kind: "zone", x: 0.56, y: 0.48, w: 0.34, h: 0.3, label: "Bathroom", at: 3.6, tone: "danger" },
  ] },
  { v: 1, id: "areas", name: "Areas", group: "Interiors", hint: "A size label in each room and the total on top", parts: [
    { kind: "pill", text: "47 m² total", x: 0.5, y: 0.1, tone: "accent", size: "lg", at: 0 },
    { kind: "pill", text: "18 m²", x: 0.28, y: 0.34, at: 0.6 },
    { kind: "pill", text: "12 m²", x: 0.7, y: 0.4, at: 1.1 },
    { kind: "pill", text: "9 m²", x: 0.34, y: 0.68, at: 1.6 },
    { kind: "pill", text: "8 m²", x: 0.72, y: 0.74, at: 2.1 },
  ] },
  { v: 1, id: "walk-through", name: "Walk-through", group: "Interiors", hint: "A route from the entrance through the rooms", parts: [
    { kind: "point", x: 0.5, y: 0.9, label: "Entrance", tone: "success", at: 0, anim: { type: "ripple", seconds: 2 } },
    { kind: "route", points: [[0.5, 0.9], [0.5, 0.7], [0.3, 0.58], [0.32, 0.38], [0.55, 0.3], [0.72, 0.2]], at: 0.5, seconds: 2.4, anim: { type: "train", seconds: 2 }, name: "Route" },
    { kind: "symbol", symbol: "pin", x: 0.72, y: 0.14, tone: "danger", size: 0.11, at: 2.9, anim: { type: "bounce", seconds: 1 } },
    { kind: "pill", text: "Living room", x: 0.72, y: 0.25, size: "sm", at: 3.1 },
  ] },
  { v: 1, id: "furniture", name: "Furniture", group: "Interiors", hint: "Plan symbols that appear one by one", parts: [
    { kind: "symbol", symbol: "sofa", x: 0.3, y: 0.32, tone: "dark", size: 0.17, at: 0.3, name: "Sofa" },
    { kind: "symbol", symbol: "bed", x: 0.7, y: 0.3, tone: "dark", size: 0.17, at: 0.9, name: "Bed" },
    { kind: "symbol", symbol: "table", x: 0.32, y: 0.68, tone: "dark", size: 0.17, at: 1.5, name: "Table" },
    { kind: "symbol", symbol: "bath", x: 0.7, y: 0.7, tone: "dark", size: 0.17, at: 2.1, name: "Bath" },
  ] },
  { v: 1, id: "remodel", name: "Remodel", group: "Interiors", hint: "What goes and what is new, with a legend", parts: [
    { kind: "zone", x: 0.14, y: 0.3, w: 0.3, h: 0.24, tone: "danger", fill: 0.18, border: "dashed", at: 0.2, name: "Remove" },
    { kind: "pill", text: "Remove", x: 0.29, y: 0.26, tone: "danger", size: "sm", at: 0.4 },
    { kind: "zone", x: 0.56, y: 0.46, w: 0.3, h: 0.24, tone: "success", fill: 0.22, at: 1, name: "New" },
    { kind: "pill", text: "New", x: 0.71, y: 0.42, tone: "success", size: "sm", at: 1.2 },
  ] },
  { v: 1, id: "key-feature", name: "Key feature", group: "Interiors", hint: "A spotlight on one place and a caption", parts: [
    { kind: "ring", x: 0.5, y: 0.4, d: 0.34, tone: "accent", anim: { type: "spotlight", seconds: 2.4 }, name: "Spotlight" },
    { kind: "pill", text: "Floor-to-ceiling windows", x: 0.5, y: 0.86, tone: "dark", at: 0.6 },
  ] },

  // ---------- Maps ----------
  { v: 1, id: "route-a-b", name: "Route A → B", group: "Maps", hint: "Two points and a line drawn between them", parts: [
    { kind: "route", points: [[0.2, 0.72], [0.36, 0.62], [0.46, 0.46], [0.62, 0.42], [0.8, 0.28]], tone: "info", at: 0.4, seconds: 2, name: "Route" },
    { kind: "point", x: 0.2, y: 0.72, label: "A", tone: "info", at: 0, anim: { type: "ripple", seconds: 2 } },
    { kind: "point", x: 0.8, y: 0.28, label: "B", tone: "danger", at: 2.3, anim: { type: "pulse", seconds: 1.5 } },
    { kind: "pill", text: "12 min", x: 0.5, y: 0.56, size: "sm", at: 2.6 },
  ] },
  { v: 1, id: "stops", name: "Stops", group: "Maps", hint: "Numbered stops joined one after another", parts: [
    { kind: "route", points: [[0.18, 0.75], [0.4, 0.5]], tone: "light", weight: "regular", straight: true, at: 0.3, seconds: 0.6 },
    { kind: "route", points: [[0.4, 0.5], [0.62, 0.66]], tone: "light", weight: "regular", straight: true, at: 1.2, seconds: 0.6 },
    { kind: "route", points: [[0.62, 0.66], [0.82, 0.3]], tone: "light", weight: "regular", straight: true, at: 2.1, seconds: 0.6 },
    { kind: "badge", text: "1", x: 0.18, y: 0.75, at: 0 },
    { kind: "badge", text: "2", x: 0.4, y: 0.5, at: 0.9 },
    { kind: "badge", text: "3", x: 0.62, y: 0.66, at: 1.8 },
    { kind: "badge", text: "4", x: 0.82, y: 0.3, at: 2.7 },
  ] },
  { v: 1, id: "you-are-here", name: "You are here", group: "Maps", hint: "A pulsing marker with a label", parts: [
    { kind: "ring", x: 0.5, y: 0.5, d: 0.16, tone: "info", fill: 0.2, anim: { type: "ripple", seconds: 2 }, name: "Pulse" },
    { kind: "point", x: 0.5, y: 0.5, tone: "info", name: "Marker" },
    { kind: "pill", text: "You are here", x: 0.5, y: 0.62, tone: "info", at: 0.4 },
  ] },
  { v: 1, id: "territory", name: "Territory", group: "Maps", hint: "An outlined area with its name", parts: [
    { kind: "area", points: [[0.22, 0.3], [0.52, 0.2], [0.8, 0.34], [0.74, 0.66], [0.42, 0.76], [0.2, 0.58]], tone: "accent", fill: 0.22, anim: { type: "ants", seconds: 2 }, name: "Area" },
    { kind: "pill", text: "Plot 14 · 0.6 ha", x: 0.5, y: 0.48, at: 0.5 },
  ] },
  { v: 1, id: "nearby", name: "What's nearby", group: "Maps", hint: "Your place in the middle, what is around it and how far", parts: [
    { kind: "symbol", symbol: "home", x: 0.5, y: 0.5, tone: "accent", size: 0.16, anim: { type: "pulse", seconds: 1.8 }, name: "Home" },
    { kind: "line", from: [0.5, 0.5], to: [0.22, 0.26], dashed: true, weight: "thin", at: 0.5 },
    { kind: "symbol", symbol: "school", x: 0.22, y: 0.24, size: 0.12, at: 0.6, name: "School" },
    { kind: "pill", text: "5 min", x: 0.22, y: 0.35, size: "sm", at: 0.7 },
    { kind: "line", from: [0.5, 0.5], to: [0.8, 0.3], dashed: true, weight: "thin", at: 1.2 },
    { kind: "symbol", symbol: "shop", x: 0.8, y: 0.28, size: 0.12, at: 1.3, name: "Shop" },
    { kind: "pill", text: "2 min", x: 0.8, y: 0.39, size: "sm", at: 1.4 },
    { kind: "line", from: [0.5, 0.5], to: [0.24, 0.76], dashed: true, weight: "thin", at: 1.9 },
    { kind: "symbol", symbol: "tree", x: 0.24, y: 0.76, size: 0.12, at: 2, name: "Park" },
    { kind: "pill", text: "8 min", x: 0.24, y: 0.87, size: "sm", at: 2.1 },
    { kind: "line", from: [0.5, 0.5], to: [0.78, 0.74], dashed: true, weight: "thin", at: 2.6 },
    { kind: "symbol", symbol: "bus", x: 0.78, y: 0.74, size: 0.12, at: 2.7, name: "Bus stop" },
    { kind: "pill", text: "3 min", x: 0.78, y: 0.85, size: "sm", at: 2.8 },
  ] },
  { v: 1, id: "radius", name: "Radius", group: "Maps", hint: "Rings around a point: delivery zone, a five-minute walk", parts: [
    { kind: "ring", x: 0.5, y: 0.5, d: 0.72, tone: "info", fill: 0.08, border: "dashed", at: 1.4, name: "Outer ring" },
    { kind: "ring", x: 0.5, y: 0.5, d: 0.48, tone: "info", fill: 0.12, at: 0.8, name: "Middle ring" },
    { kind: "ring", x: 0.5, y: 0.5, d: 0.24, tone: "info", fill: 0.2, at: 0.2, name: "Inner ring" },
    { kind: "point", x: 0.5, y: 0.5, tone: "info", anim: { type: "ripple", seconds: 2 }, name: "Centre" },
    { kind: "pill", text: "5 min walk", x: 0.5, y: 0.34, size: "sm", at: 1 },
  ] },

  // ---------- Explain ----------
  { v: 1, id: "steps", name: "Steps 1-2-3", group: "Explain", hint: "Numbered steps with a line of text each", parts: [
    { kind: "badge", text: "1", x: 0.16, y: 0.28, at: 0 },
    { kind: "pill", text: "First this", x: 0.48, y: 0.28, at: 0.25 },
    { kind: "badge", text: "2", x: 0.16, y: 0.5, at: 0.9 },
    { kind: "pill", text: "Then this", x: 0.48, y: 0.5, at: 1.15 },
    { kind: "badge", text: "3", x: 0.16, y: 0.72, at: 1.8 },
    { kind: "pill", text: "And finally this", x: 0.54, y: 0.72, at: 2.05 },
  ] },
  { v: 1, id: "tap-here", name: "Tap here", group: "Explain", hint: "A pulsing spot and a hint, for app screenshots", parts: [
    { kind: "ring", x: 0.5, y: 0.55, d: 0.14, tone: "accent", fill: 0.25, anim: { type: "ripple", seconds: 1.6 }, name: "Tap spot" },
    { kind: "symbol", symbol: "tap", x: 0.5, y: 0.6, tone: "light", size: 0.12, anim: { type: "bounce", seconds: 1.2 }, name: "Finger" },
    { kind: "pill", text: "Tap here", x: 0.5, y: 0.42, tone: "accent", at: 0.4 },
  ] },
  { v: 1, id: "callouts", name: "Callouts", group: "Explain", hint: "A dot, a leader line and a note, three times", parts: [
    { kind: "line", from: [0.36, 0.42], to: [0.2, 0.2], weight: "thin", at: 0.15 },
    { kind: "ring", x: 0.36, y: 0.42, d: 0.03, tone: "accent", fill: 1, at: 0 },
    { kind: "pill", text: "Note one", x: 0.2, y: 0.2, size: "sm", at: 0.3 },
    { kind: "line", from: [0.6, 0.5], to: [0.8, 0.3], weight: "thin", at: 0.95 },
    { kind: "ring", x: 0.6, y: 0.5, d: 0.03, tone: "accent", fill: 1, at: 0.8 },
    { kind: "pill", text: "Note two", x: 0.8, y: 0.3, size: "sm", at: 1.1 },
    { kind: "line", from: [0.46, 0.62], to: [0.5, 0.86], weight: "thin", at: 1.75 },
    { kind: "ring", x: 0.46, y: 0.62, d: 0.03, tone: "accent", fill: 1, at: 1.6 },
    { kind: "pill", text: "Note three", x: 0.5, y: 0.86, size: "sm", at: 1.9 },
  ] },
  { v: 1, id: "compare", name: "Compare A / B", group: "Explain", hint: "Two options side by side", parts: [
    { kind: "zone", x: 0.06, y: 0.22, w: 0.4, h: 0.5, tone: "info", fill: 0.25, label: "A", at: 0 },
    { kind: "zone", x: 0.54, y: 0.22, w: 0.4, h: 0.5, tone: "danger", fill: 0.25, label: "B", at: 0.8 },
    { kind: "badge", text: "vs", x: 0.5, y: 0.47, tone: "light", at: 1.4, anim: { type: "pop", seconds: 3 } },
    { kind: "pill", text: "Option A", x: 0.26, y: 0.8, tone: "info", size: "sm", at: 0.2 },
    { kind: "pill", text: "Option B", x: 0.74, y: 0.8, tone: "danger", size: "sm", at: 1 },
  ] },

  // ---------- Review ----------
  { v: 1, id: "dimensions", name: "Dimensions", group: "Review", hint: "Measure lines with numbers along the walls", parts: [
    { kind: "line", from: [0.15, 0.2], to: [0.85, 0.2], arrow: "both", tone: "accent", weight: "thin", at: 0 },
    { kind: "pill", text: "5.40 m", x: 0.5, y: 0.14, size: "sm", at: 0.2 },
    { kind: "line", from: [0.1, 0.28], to: [0.1, 0.82], arrow: "both", tone: "accent", weight: "thin", at: 0.8 },
    { kind: "pill", text: "3.20 m", x: 0.2, y: 0.55, size: "sm", at: 1 },
  ] },
  { v: 1, id: "remarks", name: "Remarks", group: "Review", hint: "Circled problems with numbered notes", parts: [
    { kind: "ring", x: 0.3, y: 0.3, d: 0.18, tone: "danger", at: 0, anim: { type: "pulse", seconds: 1.4 } },
    { kind: "badge", text: "1", x: 0.39, y: 0.21, tone: "danger", at: 0.2 },
    { kind: "pill", text: "Fix this", x: 0.3, y: 0.44, size: "sm", at: 0.35 },
    { kind: "ring", x: 0.68, y: 0.46, d: 0.18, tone: "danger", at: 0.9, anim: { type: "pulse", seconds: 1.4 } },
    { kind: "badge", text: "2", x: 0.77, y: 0.37, tone: "danger", at: 1.1 },
    { kind: "pill", text: "Check this", x: 0.68, y: 0.6, size: "sm", at: 1.25 },
    { kind: "ring", x: 0.36, y: 0.72, d: 0.18, tone: "danger", at: 1.8, anim: { type: "pulse", seconds: 1.4 } },
    { kind: "badge", text: "3", x: 0.45, y: 0.63, tone: "danger", at: 2 },
    { kind: "pill", text: "Redo this", x: 0.36, y: 0.86, size: "sm", at: 2.15 },
  ] },
  { v: 1, id: "evacuation", name: "Evacuation", group: "Review", hint: "Where you are and the ways out", parts: [
    { kind: "point", x: 0.5, y: 0.6, label: "You are here", tone: "info", anim: { type: "ripple", seconds: 2 } },
    { kind: "line", from: [0.5, 0.56], to: [0.22, 0.3], arrow: "end", tone: "success", weight: "bold", at: 0.6, anim: { type: "train", seconds: 1.6 } },
    { kind: "symbol", symbol: "exit", x: 0.18, y: 0.22, tone: "success", size: 0.12, at: 0.9, name: "Exit 1" },
    { kind: "line", from: [0.54, 0.6], to: [0.82, 0.74], arrow: "end", tone: "success", weight: "bold", at: 1.4, anim: { type: "train", seconds: 1.6 } },
    { kind: "symbol", symbol: "exit", x: 0.86, y: 0.82, tone: "success", size: 0.12, at: 1.7, name: "Exit 2" },
    { kind: "pill", text: "Exit", x: 0.18, y: 0.33, tone: "success", size: "sm", at: 1 },
  ] },

  // ---------- Present ----------
  { v: 1, id: "intro-outro", name: "Intro & outro", group: "Present", hint: "A title at the start and a closing line at the end", parts: [
    { kind: "pill", text: "Apartment tour", x: 0.5, y: 0.16, tone: "accent", size: "lg", at: 0, until: 2.4, name: "Title" },
    { kind: "pill", text: "47 m² · 2 rooms", x: 0.5, y: 0.26, size: "sm", at: 0.4, until: 2.4, name: "Subtitle" },
    { kind: "pill", text: "Book a viewing", x: 0.5, y: 0.86, tone: "accent", at: 4.5, anim: { type: "pulse", seconds: 1.4 }, name: "Call to action" },
  ] },
];

/** Library previews are built on a small stage, so labels and lines stay readable at tile size. */
export const PREVIEW_W = 560, PREVIEW_H = 420;

export const LIBRARY: TemplateSpec[] = RAW.map(parseTemplate).filter((t): t is TemplateSpec => t !== null);
if (import.meta.env.DEV && LIBRARY.length !== RAW.length) console.warn(`Template library: ${RAW.length - LIBRARY.length} bundled template(s) failed validation`);
