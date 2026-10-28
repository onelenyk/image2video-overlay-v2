# Plan Highlighter

A photo-first editor for making short highlight videos: pick a plan or photo, mark things on it, animate them, sketch while you talk, export an MP4. Built mobile-first; works the same with a mouse.

**[Live Demo](https://onelenyk.github.io/image2video-overlay-v2/)**

## How it works

1. **Projects** - every project is one photo plus what you put on it. Projects are saved in the browser automatically.
2. **Editor** - the photo fills the screen. Under it is the timeline; at the bottom is a row of tools. Tapping a tool opens just that tool's options.
3. **Export** - renders the video and lets you download or share it.

### Vocabulary

| Word | Meaning |
| --- | --- |
| Photo | The picture a project is built on: a plan, a photo, a screenshot |
| Overlay | Anything placed on top of the photo |
| Shape, text, icon | Ready-made overlays, added with Add |
| Stroke | An overlay drawn by hand: freehand line, straight line, polygon |
| Sketch | Strokes recorded live; they replay with the timing they were drawn with |
| Animation | How an overlay moves while it is on screen |
| Timing | When an overlay appears and disappears; its bar on the timeline tracks |

In code an overlay is the `El` type in `src/engine/types.ts`.

### Tools

The main menu is always the same: Add, Draw, Overlays, Canvas. Selecting an overlay adds its own tools next to it without replacing anything: on a phone a selection bar (name, Style, Animate, Timing, Duplicate, Delete) appears above the menu; on a wide screen an inspector column opens on the right with Style, Animate and Timing as sections.

| Tool | What it does |
| --- | --- |
| Add | Add a ready-made overlay, in sections: templates (whole sets for a job: areas, walk-through, furniture, remodel, key feature, route A → B, stops, steps, callouts, remarks), zones, arrows, text, icons (built-in, plus online search of open-licensed sets through the Iconify API), animated presets, images (PNG/JPEG/WebP/SVG) |
| Style | One property at a time: color, opacity, border, shape, label, stroke, arrows, size, arrange |
| Animate | 24 animations with speed, delay and strength |
| Timing | When each element appears and disappears; drag its bar on the timeline tracks to move or trim it |
| Draw | Everything by hand: freehand, straight line, polygon, and live sketching while you talk (strokes replay with the timing they were drawn with; optional narration audio) |
| Overlays | The list of everything on the photo, added overlays and hand-drawn strokes in separate groups: select, hide, reorder, delete |
| Canvas | Photo, aspect ratio, fit, background, dimming, video length |

On the canvas: drag to move, handles to resize and rotate, drag a line end onto a point or polygon corner to attach it, drag a polygon corner onto its neighbour to remove it.

Keyboard: Delete, arrows (Shift = ×10), Ctrl/⌘+Z / Shift+Z, Ctrl/⌘+D, Space (play), Esc.

## Working up close

Pinch with two fingers, hold Ctrl/Cmd and turn the wheel, or use the − / + control in the corner of the photo to zoom in up to 8×; two fingers or the wheel pan. Zoom is only a way of looking while you edit: it is not part of the project and never changes the video. For exact placement, Style → Size has X and Y fields (the centre of the overlay, in stage units; the stage is 1000 wide). Train animations have their own Length, Glow and light colour in Animate.

## Templates and groups

A template is a ready-made set of overlays for a job (areas, a walk-through, a route, steps…). Applying one adds its overlays as a **group**: drag the group to move all of it, tap one of its overlays again to edit just that one, Esc steps back out. A group can be shifted in time, ungrouped, deleted, or saved as a template of your own.

Templates are **data, not code** (`src/engine/template.ts`). A template lists parts in fractions of the stage and in style tokens:

```json
{ "v": 1, "id": "you-are-here", "name": "You are here", "group": "Maps", "hint": "A pulsing marker with a label",
  "parts": [
    { "kind": "ring", "x": 0.5, "y": 0.5, "d": 0.16, "tone": "info", "fill": 0.2, "anim": { "type": "ripple", "seconds": 2 } },
    { "kind": "point", "x": 0.5, "y": 0.5, "tone": "info" },
    { "kind": "pill", "text": "You are here", "x": 0.5, "y": 0.62, "tone": "info", "at": 0.4 }
  ] }
```

- Part kinds: `pill`, `text`, `badge`, `zone`, `ring`, `area`, `point`, `line`, `route` (draws itself), `symbol` (a built-in plan symbol).
- One style for all of them: colours are tones (`accent`, `danger`, `success`, `info`, `dark`, `light`), text sizes `sm`/`md`/`lg`, stroke weights `thin`/`regular`/`bold`, all defined in `STYLE`.
- `at` / `until` place a part on the timeline; `anim` picks one of the app's animations.

Every template goes through `parseTemplate()` before use, including the bundled ones in `src/ui/templateLibrary.ts`. Unknown part kinds and fields are dropped, numbers are range-checked, text is length-limited, at most 40 parts are kept, and there is no way to pass raw SVG, HTML, URLs or colours outside the palette, so a template from any source cannot run code or break the editor. Templates saved by the user are snapshots of real overlays; they are validated the same way when loaded (`parseSaved()`), with SVG re-sanitised and only embedded images allowed.

## Storage, ids and addresses

The app is local-only today, and built so that accounts can be added without a rewrite:

- Everything that is kept goes through the `Storage` interface in `src/editor/storage.ts`. The only implementation is IndexedDB (`src/editor/db.ts`); a server-backed one replaces it in one place (`storage` in `db.ts`).
- Projects and templates have UUIDs. Each project record carries `ownerId` (`"local"` until there are accounts), `createdAt`, and `format`, the version of the record; `upgradeProject()` brings older records up to date when they are read.
- A project's photo and narration are files of their own (`getFile` / `putFile`), not part of the record.
- Saving can fail: the editor shows "Saving…", "Saved" or "Not saved · Retry".
- Screens have addresses (`src/editor/router.ts`): `#/` landing page, `#/projects` project list, `#/p/<id>` a project. Back, reload and direct links work.

## Architecture

There is one renderer. The editor canvas, the timeline thumbnails, PNG export and video export all call `drawScene()`, so the export always matches the preview.

```
src/engine/      no React
  types.ts       scene model (all geometry in stage units, stage is 1000 wide)
  animations.ts  animations as pure functions of time
  geometry.ts    bounds, hit testing, line attachments, path reveal
  renderer.ts    drawScene()
  scene.ts       element factories, video length
  template.ts    template format, validation, the shared style, building overlays
  exporter.ts    MP4 via WebCodecs (+AAC narration), real-time fallback, PNG
src/editor/
  store.ts       Zustand store: project, selection, history, playback clock
  db.ts          IndexedDB persistence
  EditorCanvas.tsx  render loop and pointer / keyboard interaction
src/ui/          screens and tool panels
```

## Development

```bash
npm install
npm run dev
npm run build
```

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS, Zustand, WebCodecs + mp4-muxer.

## License

MIT
