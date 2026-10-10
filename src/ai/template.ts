import { ANIMATIONS } from "../engine/animations";
import { parseTemplate, SYMBOL_NAMES, STYLE, type TemplateSpec } from "../engine/template";
import { AiError, type AiProgress, type ChatMessage, type Effort, type Provider } from "./provider";

// Templates written by an AI model. The model only ever produces template
// DATA; it goes through the same validation as any other template, so a wrong
// or hostile answer can at worst give a poor layout, never code or markup.

const list = (items: readonly string[]) => items.join(", ");

const EXAMPLE = {
  name: "Room tour",
  hint: "Rooms light up one after another, each with its name",
  parts: [
    { kind: "zone", x: 0.07, y: 0.07, w: 0.46, h: 0.47, tone: "accent", border: "none", at: 0, name: "Living room zone", set: "Living room" },
    { kind: "pill", text: "Living room", x: 0.3, y: 0.31, size: "sm", at: 0.2, set: "Living room" },
    { kind: "zone", x: 0.54, y: 0.07, w: 0.39, h: 0.38, tone: "info", border: "none", at: 1.2, name: "Kitchen zone", set: "Kitchen" },
    { kind: "pill", text: "Kitchen", x: 0.73, y: 0.26, size: "sm", at: 1.4, set: "Kitchen" },
    { kind: "route", points: [[0.59, 0.9], [0.59, 0.64], [0.45, 0.48], [0.32, 0.44]], tone: "info", at: 2.4, seconds: 2 },
    { kind: "symbol", symbol: "pin", x: 0.32, y: 0.35, tone: "danger", size: 0.11, at: 4.4, anim: { type: "bounce", seconds: 1 } },
  ],
};

function instructions(aspect: number, rich: boolean): string {
  const richness = rich
    ? `DESIGN BAR. The user expects a polished motion design, the kind a professional would post, not a wireframe. A plain result (a few pills and a zone) is a failure. Ready-made parts only fade in and loop one simple animation, so the richness has to come from code parts: build the template around one to four of them and keep ready-made parts for plain labels, zones and arrows.
What "rich" means here:
- Composition: one clear focal element, supporting elements around it, generous spacing, things aligned to each other. Use the stage; do not crowd a corner.
- Hierarchy in type: a large bold number or title (700-800 weight), a small muted caption (rgba(255,255,255,0.65)), letter-spaced small caps for tags.
- Surfaces with depth instead of flat boxes: cards with rounded corners (16-28), a soft shadow under them (ctx.shadowColor 'rgba(0,0,0,0.35)', shadowBlur 30, shadowOffsetY 10), a subtle top-to-bottom gradient fill, a 1.5px light edge (rgba(255,255,255,0.18)), glassy plates (rgba(255,255,255,0.14) fill over rgba(17,24,39,0.55)).
- Colour: one accent per template plus neutrals. Good accents: #ffd60a, #0a84ff, #30d158, #ff453a, #bf5af2, #ff9f0a. Gradients between two close hues (e.g. #0a84ff to #5e5ce6) for bars, rings and lines. Glows in the accent colour for emphasis.
- Motion in layers: an entrance for each element (slide up 20-40 units while fading in, or scale from 0.9 with a small overshoot), staggered 0.08-0.2 s apart; then a main action (count up, bars growing, a line drawing itself with a travelling dot, a ring filling); then a quiet ambient loop after it finishes (a soft pulse, a slow shimmer sweeping across, floating particles) so the last frame is never dead.
- Easing always: never linear. easeOut: 1 - Math.pow(1 - k, 3). Overshoot: 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2).
- Details that sell it: tick marks and thin grid lines in charts, value labels that appear as a bar lands, an icon drawn with a few strokes, a thin progress line under a title, rounded line caps, numbers formatted with spaces or units.
Good building blocks for code parts: a stat card (caption, big counting number, small delta chip, sparkline drawing itself); a donut or ring gauge filling with the value in the middle; a bar or line chart with axes that builds in; a glass callout card with a title, two lines of text and an accent stripe; a route line with glow, a moving dot and distance counter; a timeline of steps that light up one by one; a comparison slider; a typewriter headline with a caret; a full-stage ambient layer (x 0, y 0, w 1, h 1) of slow soft light blobs or drifting particles behind everything, kept faint.
Mistakes to avoid: text that does not fit its plate (always draw text with ui.text and a maxWidth smaller than the plate, or use ui.pill); a full-stage layer that hides or greys out the photo (ambient layers must stay under 0.12 opacity overall, with no flat fill over the whole stage); a route or line drawn across a card; elements touching the edges of the stage.
Expose what the user will want to edit (texts, numbers, accent colour, speed) as settings.`
    : `Do not use code parts in this answer: ready-made parts only. Still aim for a considered layout: a clear focal point, aligned elements, a meaningful reveal order.`;
  return `You design overlay templates for a tool that turns a photo, floor plan, map or screenshot into a short explainer video. A template is a list of parts drawn over the user's picture and revealed over time. You cannot see the picture: lay the parts out sensibly for what the user describes; they will drag things into place afterwards.

Answer with ONE JSON object and nothing else:
{"name": string (max 30 characters), "hint": string (one line saying what it shows, max 100 characters), "parts": [ ... ]}

Coordinates are fractions of the stage: x and w run 0..1 across its width, y and h run 0..1 down its height. The stage is ${aspect.toFixed(2)} times as wide as it is tall. x,y of pill, text, badge, ring, point and symbol are their CENTRE; x,y of a zone are its top-left corner.

Parts (fields in [] are optional):
- {"kind":"pill","text","x","y",["tone"],["size"]}  text on a rounded plate. Use this for all wording.
- {"kind":"badge","text","x","y",["tone"]}  a disc with at most 3 characters: a number or a letter.
- {"kind":"zone","x","y","w","h",["tone"],["fill" 0..1],["border" "solid"|"dashed"|"none"]}  a rectangle highlight.
- {"kind":"ring","x","y","d",["tone"],["fill" 0..1],["border" "solid"|"dashed"]}  a circle; d is its diameter as a fraction of the width.
- {"kind":"area","points":[[x,y],...],["tone"],["fill" 0..1]}  a closed outline with 3 or more corners.
- {"kind":"point","x","y",["tone"]}  a small dot marker.
- {"kind":"line","from":[x,y],"to":[x,y],["tone"],["arrow" "none"|"end"|"both"],["dashed" true],["weight"]}  a straight line or arrow.
- {"kind":"route","points":[[x,y],...],["tone"],["seconds"],["straight" true],["weight"]}  a path that draws itself over "seconds".
- {"kind":"symbol","symbol","x","y",["tone"],["size" fraction of the width, e.g. 0.1]}  a pictogram.
- {"kind":"code","x","y","w","h","code",["params"]}  a transparent box that YOUR JavaScript draws on every frame. x,y is its top-left corner; it may be any size, up to the whole stage (x 0, y 0, w 1, h 1).
Every part may also have: "at" (seconds from the start when it appears), "until" (seconds when it disappears; omit to stay), "name" (a short label for the layer list), "set" (see below), "anim": {"type", "seconds"}.

Sets: parts that belong to one thing must share the same "set" string, a short name for that thing (e.g. a zone and its label both have "set":"Kitchen"; a badge and its line of text both have "set":"Step 1"). The user then moves the whole set with one drag. Give a "set" to every part that has a companion; leave it out only for parts that stand alone (a route, a title).

Allowed values, nothing else exists:
- tone: ${list(Object.keys(STYLE.tone))}  (accent = yellow, danger = red, success = green, info = blue)
- size: ${list(Object.keys(STYLE.text))};  weight: ${list(Object.keys(STYLE.stroke))}
- symbol: ${list(SYMBOL_NAMES)}
- anim type: ${list(Object.keys(ANIMATIONS))}  (ripple, spotlight and sweep work on pill, badge, zone, ring, area and point only; train and trainLoop on line and route only)

${richness}

How to write a code part (the "code" field is a string of JavaScript):
- It defines function draw(ctx, t, w, h, p). ctx is a Canvas 2D context, already scaled so the box is w by h units (the whole stage is 1000 units wide). t is seconds since the part appeared. p holds the settings. The canvas starts transparent on every frame: draw only what should be visible.
- The picture must depend ONLY on t. Do not keep variables that change between frames. Math.random() returns the same sequence on every frame, so particles keep their paths: take all random numbers first, then move things with t.
- Coordinates are always the box's own units: never use ctx.canvas.width or height, pixel ratios or fixed pixel sizes; use w and h. Use ctx.save() and ctx.restore() around temporary transforms.
- Nothing else exists: no network, DOM, images, timers or imports. Fonts: "system-ui, sans-serif". Put text on a dark plate (rgba(17,24,39,0.92), rounded) or give it a dark outline so it reads on any photo.
- A helper object "ui" is always available. USE IT: it makes text fit, keeps the look consistent and saves lines. (Do not declare your own variable called ui.)
    ui.prog(t, start, seconds)  eased progress 0..1 that begins at "start" seconds and lasts "seconds"; the main tool for entrances and staggering.
    ui.ease(k), ui.back(k) (overshoot), ui.clamp(v, lo, hi)
    ui.text(ctx, text, x, y, { size, weight, color, align: "left"|"center"|"right", maxWidth, alpha, outline })  draws text; with maxWidth the font shrinks so the text ALWAYS fits. Always pass maxWidth.
    ui.card(ctx, x, y, w, h, { radius, fill, fill2 (gradient to), edge, glow: colour, alpha })  a rounded plate with a soft shadow and a light edge; dark glass by default.
    ui.pill(ctx, text, cx, cy, { size, fill, color, maxWidth, alpha })  a rounded plate sized to its text, centred on cx, cy.
    ui.ring(ctx, cx, cy, r, value 0..1, { width, color, track })  a ring gauge with a glow.
    ui.path(ctx, [[x, y], ...], k 0..1, { width, color })  draws a polyline up to the fraction k and RETURNS the point at its end { x, y }, so you can draw a moving dot there.
    ui.dots(ctx, cx, cy, count, active, { color })  a slide indicator.
    ui.font(ctx, size, weight), ui.fit(ctx, text, maxWidth, size, weight) -> size
  Entrance idiom: const a = ui.prog(t, 0.2, 0.5); ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 30); ...draw...
  Other moves: loop with (t / seconds) % 1; pulse with Math.sin(t * 4); glow with ctx.shadowColor and ctx.shadowBlur.
- Declare settings the user can change without code, and read them from p: const params = { to: { type: "number", default: 47, min: 0, max: 1000, label: "Number" }, color: { type: "color", default: "#ffd60a", label: "Colour" }, title: { type: "text", default: "Sales" }, loop: { type: "toggle", default: true } }; put every number, text and colour a user would want to change there.
- A code part may be up to about 120 lines. Helper functions above draw() are fine. Write real line breaks as \\n inside the JSON string.
Two examples of "code":
"const params = { to: { type: 'number', default: 47, min: 0, max: 1000, label: 'Number' }, unit: { type: 'text', default: ' m²', label: 'Unit' }, caption: { type: 'text', default: 'Total area', label: 'Caption' }, color: { type: 'color', default: '#ffd60a', label: 'Colour' } };\\nfunction draw(ctx, t, w, h, p) {\\n  const a = ui.prog(t, 0, 0.5);\\n  ctx.globalAlpha = a; ctx.translate(0, (1 - a) * 30);\\n  ui.card(ctx, 0, 0, w, h, { radius: 28, fill: 'rgba(30,36,52,0.92)', fill2: 'rgba(14,18,30,0.92)' });\\n  ui.text(ctx, p.caption.toUpperCase(), w * 0.1, h * 0.24, { size: h * 0.11, weight: 700, color: 'rgba(255,255,255,0.6)', maxWidth: w * 0.8 });\\n  ui.text(ctx, Math.round(p.to * ui.prog(t, 0.3, 1.6)) + p.unit, w * 0.1, h * 0.58, { size: h * 0.42, weight: 800, color: p.color, maxWidth: w * 0.8 });\\n  ctx.fillStyle = p.color; ctx.fillRect(w * 0.1, h * 0.86, w * 0.8 * ui.prog(t, 0.3, 1.6), 4);\\n}"
"const params = { label: { type: 'text', default: '4 min to the metro', label: 'Label' }, color: { type: 'color', default: '#0a84ff', label: 'Colour' }, seconds: { type: 'number', default: 2.5, min: 0.5, max: 8, label: 'Seconds' } };\\nconst ROUTE = [[0.08, 0.85], [0.3, 0.6], [0.55, 0.7], [0.9, 0.2]];\\nfunction draw(ctx, t, w, h, p) {\\n  const pts = ROUTE.map(function (q) { return [q[0] * w, q[1] * h]; });\\n  const k = ui.prog(t, 0.2, p.seconds);\\n  const head = ui.path(ctx, pts, k, { width: 10, color: p.color });\\n  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(head.x, head.y, 11 * (1 + 0.25 * Math.sin(t * 6)), 0, Math.PI * 2); ctx.fill();\\n  ui.pill(ctx, p.label, w * 0.5, h * 0.1, { size: h * 0.07, maxWidth: w * 0.9, alpha: ui.prog(t, p.seconds, 0.4) });\\n}"

Layout rules:
- Between 2 and 16 parts. Keep everything between 0.04 and 0.96 on both axes.
- A "sm" pill is about (0.034 + 0.0175 x characters) of the width and ${(0.053 * aspect).toFixed(2)} of the height; "md" is 1.2 times that, "lg" 1.65 times. A badge is ${(0.084).toFixed(3)} of the width across. Do not let pills, badges and symbols overlap each other or run off the stage; keep texts short (under 24 characters) and prefer "sm".
- Put a label next to or inside the thing it names. Draw lines and routes before the badges that sit on them.
- Reveal parts in a meaningful order: "at" steps of 0.3 to 1.2 seconds. A single scene should tell its story within about 6 seconds. Use the ready-made "anim" sparingly, one or two per template.
- Stories with several scenes (slides): when the user asks for a story, slides, steps shown one screen at a time, or a sequence with transitions, make each scene its own group of parts with "at" = when the scene starts and "until" = when it ends, so scenes replace each other; 3 to 5 seconds per scene, up to 30 seconds in all. Every part fades in and out by itself over 0.3 s at "at" and "until". The best way to build a scene is ONE code part that draws the whole slide (title, number, picture-like graphics, its own entrance animation in the first 0.6 s), sized to the area it needs or to the full stage. Give the scenes a shared look (same accent, same type scale, same plate style) and a different layout or motion each, so it feels like one story and not five copies. Add one small code part that stays for the whole story as a progress indicator (dots or segments showing the current scene; give it the scene length as a setting and derive the current scene from t). Total parts may go up to 20 for a story.
- Write "name", "hint" and all texts in the language of the user's request.

Example of a good answer:
${JSON.stringify(EXAMPLE)}`;
}

export interface AiDraft {
  spec: TemplateSpec;
  /** The conversation so far, so a follow-up request can change this result. */
  thread: ChatMessage[];
}

/** Pulls the JSON object out of a model's answer, tolerating code fences and stray prose around it. */
function extract(answer: string): unknown {
  const from = answer.indexOf("{"), to = answer.lastIndexOf("}");
  if (from < 0 || to <= from) return null;
  try { return JSON.parse(answer.slice(from, to + 1)); } catch { return null; }
}

/**
 * Asks the model for a template. Pass `previous` and a change request to revise an earlier draft.
 * Throws AiError; "answer" means the model replied but not with a usable template.
 */
export async function draftTemplate(provider: Provider, key: string, effort: Effort, request: string, aspect: number, rich: boolean, previous?: AiDraft, signal?: AbortSignal, onProgress?: (progress: AiProgress) => void): Promise<AiDraft> {
  const ask: ChatMessage = { role: "user", content: request.trim().slice(0, 2000) };
  const thread: ChatMessage[] = previous ? [...previous.thread, ask] : [{ role: "system", content: instructions(aspect, rich) }, ask];
  const answer = await provider.json(key, thread, effort, signal, onProgress);
  const raw = extract(answer) as Record<string, unknown> | null;
  const spec = raw && parseTemplate({ ...raw, v: 1, id: "ai-draft", group: "Mine" });
  if (!spec) throw new AiError("answer");
  // Keep only the cleaned template in the thread, not whatever else the model wrote
  return { spec, thread: [...thread, { role: "assistant", content: JSON.stringify({ name: spec.name, hint: spec.hint, parts: spec.parts }) }] };
}
