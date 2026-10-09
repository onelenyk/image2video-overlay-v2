import { ANIMATIONS } from "../engine/animations";
import { parseTemplate, SYMBOL_NAMES, STYLE, type TemplateSpec } from "../engine/template";
import { AiError, type ChatMessage, type Provider } from "./provider";

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
    ? `Ready-made parts (pill, zone, line...) only fade in and loop a simple animation. Anything livelier needs a code part, and the user WANTS lively: unless the request is for plain labels only, build the template around one to three code parts that carry the motion (numbers counting up, charts growing, lines drawing themselves with a moving dot, text typing, progress filling, particles, sweeping highlights, clocks, moving markers) and use ready-made parts for the plain labels and zones around them.`
    : `Do not use code parts in this answer: ready-made parts only.`;
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
- Nothing else exists: no network, DOM, images, timers or imports. Fonts: "system-ui, sans-serif". Put text on a dark plate (rgba(17,24,39,0.92), rounded) or give it a dark outline so it reads on any photo.
- Useful moves: ease with k = Math.min(1, t / seconds), e = 1 - Math.pow(1 - k, 3); loop with (t / seconds) % 1; stagger items with (t - i * 0.15); draw a line progressively with ctx.setLineDash([length * e, length]); glow with ctx.shadowColor and ctx.shadowBlur; pulse with Math.sin(t * 4).
- Declare settings the user can change without code, and read them from p: const params = { to: { type: "number", default: 47, min: 0, max: 1000, label: "Number" }, color: { type: "color", default: "#ffd60a", label: "Colour" }, title: { type: "text", default: "Sales" }, loop: { type: "toggle", default: true } }; put every number, text and colour a user would want to change there.
- Up to about 60 lines per code part. Write real line breaks as \\n inside the JSON string.
Two examples of "code":
"const params = { to: { type: 'number', default: 47, min: 0, max: 1000, label: 'Number' }, unit: { type: 'text', default: ' m²', label: 'Unit' } };\\nfunction draw(ctx, t, w, h, p) {\\n  const e = 1 - Math.pow(1 - Math.min(1, t / 2), 3);\\n  ctx.fillStyle = 'rgba(17,24,39,0.92)'; ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();\\n  ctx.fillStyle = '#ffd60a'; ctx.font = '700 ' + h * 0.56 + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';\\n  ctx.fillText(Math.round(p.to * e) + p.unit, w / 2, h * 0.53);\\n}"
"const params = { color: { type: 'color', default: '#0a84ff', label: 'Colour' }, seconds: { type: 'number', default: 2.5, min: 0.5, max: 8, label: 'Seconds' } };\\nconst PATH = [[0.08, 0.85], [0.3, 0.6], [0.55, 0.7], [0.9, 0.15]];\\nfunction draw(ctx, t, w, h, p) {\\n  const pts = PATH.map(function (q) { return [q[0] * w, q[1] * h]; });\\n  let total = 0; const len = [];\\n  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len.push(d); total += d; }\\n  const e = Math.min(1, t / p.seconds), run = total * e;\\n  ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 18;\\n  ctx.setLineDash([run, total]); ctx.beginPath(); pts.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke(); ctx.setLineDash([]);\\n  let left = run, x = pts[0][0], y = pts[0][1];\\n  for (let i = 0; i < len.length; i++) { if (left <= len[i]) { const f = left / len[i]; x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f; y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f; break; } left -= len[i]; x = pts[i + 1][0]; y = pts[i + 1][1]; }\\n  const pulse = 1 + 0.25 * Math.sin(t * 6);\\n  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 11 * pulse, 0, Math.PI * 2); ctx.fill();\\n}"

Layout rules:
- Between 2 and 16 parts. Keep everything between 0.04 and 0.96 on both axes.
- A "sm" pill is about (0.034 + 0.0175 x characters) of the width and ${(0.053 * aspect).toFixed(2)} of the height; "md" is 1.2 times that, "lg" 1.65 times. A badge is ${(0.084).toFixed(3)} of the width across. Do not let pills, badges and symbols overlap each other or run off the stage; keep texts short (under 24 characters) and prefer "sm".
- Put a label next to or inside the thing it names. Draw lines and routes before the badges that sit on them.
- Reveal parts in a meaningful order: "at" steps of 0.3 to 1.2 seconds, the whole story within about 6 seconds. Use animations sparingly, one or two per template.
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
export async function draftTemplate(provider: Provider, key: string, request: string, aspect: number, rich: boolean, previous?: AiDraft, signal?: AbortSignal): Promise<AiDraft> {
  const ask: ChatMessage = { role: "user", content: request.trim().slice(0, 2000) };
  const thread: ChatMessage[] = previous ? [...previous.thread, ask] : [{ role: "system", content: instructions(aspect, rich) }, ask];
  const answer = await provider.json(key, thread, signal);
  const raw = extract(answer) as Record<string, unknown> | null;
  const spec = raw && parseTemplate({ ...raw, v: 1, id: "ai-draft", group: "Mine" });
  if (!spec) throw new AiError("answer");
  // Keep only the cleaned template in the thread, not whatever else the model wrote
  return { spec, thread: [...thread, { role: "assistant", content: JSON.stringify({ name: spec.name, hint: spec.hint, parts: spec.parts }) }] };
}
