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

function instructions(aspect: number): string {
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
Every part may also have: "at" (seconds from the start when it appears), "until" (seconds when it disappears; omit to stay), "name" (a short label for the layer list), "set" (see below), "anim": {"type", "seconds"}.

Sets: parts that belong to one thing must share the same "set" string, a short name for that thing (e.g. a zone and its label both have "set":"Kitchen"; a badge and its line of text both have "set":"Step 1"). The user then moves the whole set with one drag. Give a "set" to every part that has a companion; leave it out only for parts that stand alone (a route, a title).

Allowed values, nothing else exists:
- tone: ${list(Object.keys(STYLE.tone))}  (accent = yellow, danger = red, success = green, info = blue)
- size: ${list(Object.keys(STYLE.text))};  weight: ${list(Object.keys(STYLE.stroke))}
- symbol: ${list(SYMBOL_NAMES)}
- anim type: ${list(Object.keys(ANIMATIONS))}  (ripple, spotlight and sweep work on pill, badge, zone, ring, area and point only; train and trainLoop on line and route only)

Layout rules:
- Between 3 and 16 parts. Keep everything between 0.04 and 0.96 on both axes.
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
export async function draftTemplate(provider: Provider, key: string, request: string, aspect: number, previous?: AiDraft, signal?: AbortSignal): Promise<AiDraft> {
  const ask: ChatMessage = { role: "user", content: request.trim().slice(0, 2000) };
  const thread: ChatMessage[] = previous ? [...previous.thread, ask] : [{ role: "system", content: instructions(aspect) }, ask];
  const answer = await provider.json(key, thread, signal);
  const raw = extract(answer) as Record<string, unknown> | null;
  const spec = raw && parseTemplate({ ...raw, v: 1, id: "ai-draft", group: "Mine" });
  if (!spec) throw new AiError("answer");
  // Keep only the cleaned template in the thread, not whatever else the model wrote
  return { spec, thread: [...thread, { role: "assistant", content: JSON.stringify({ name: spec.name, hint: spec.hint, parts: spec.parts }) }] };
}
