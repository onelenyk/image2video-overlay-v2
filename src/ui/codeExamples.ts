import { m, t, type Msg } from "../i18n";

// Ready-made code overlays. Each is plain source the user can read and change.
// A frame depends only on `t` (seconds since the overlay appeared): no stored
// state, and Math.random() gives the same numbers on every frame.
// `@Label@` marks a setting's name; it is put in the interface language when the overlay is added.

export interface CodeExample { id: string; name: Msg; w: number; h: number; code: string }

const plate = `ctx.fillStyle = "rgba(17,24,39,0.92)";
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, h / 2); ctx.fill();`;

export const CODE_EXAMPLES: CodeExample[] = [
  { id: "counter", name: m("Counter"), w: 320, h: 110, code: `export const params = {
  to: { type: "number", default: 47, min: 0, max: 1000, label: "@Number~value@" },
  unit: { type: "text", default: " m²", label: "@Unit@" },
  seconds: { type: "number", default: 2, min: 0.2, max: 10, step: 0.1, label: "@Seconds@" },
  color: { type: "color", default: "#ffd60a", label: "@Color@" },
};

// t: seconds since the overlay appeared; w, h: its size; p: the settings above
function draw(ctx, t, w, h, p) {
  const k = Math.min(1, t / p.seconds);
  const eased = 1 - Math.pow(1 - k, 3);
  ${plate}
  ctx.fillStyle = p.color;
  ctx.font = "700 " + h * 0.56 + "px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(Math.round(p.to * eased) + p.unit, w / 2, h * 0.53);
}
` },
  { id: "typewriter", name: m("Typewriter"), w: 560, h: 90, code: `export const params = {
  text: { type: "text", default: "@Panoramic windows@", label: "@Text@" },
  speed: { type: "number", default: 14, min: 2, max: 40, label: "@Letters per second@" },
  color: { type: "color", default: "#ffffff", label: "@Color@" },
};

function draw(ctx, t, w, h, p) {
  const letters = Array.from(p.text);
  const shown = letters.slice(0, Math.floor(t * p.speed)).join("");
  const typing = shown.length < p.text.length;
  ${plate}
  ctx.fillStyle = p.color;
  ctx.font = "600 " + h * 0.46 + "px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(shown, h * 0.45, h * 0.53);
  // The caret blinks once the text is complete
  if (typing || (t * 2) % 1 < 0.5) ctx.fillRect(h * 0.45 + ctx.measureText(shown).width + 4, h * 0.26, 3, h * 0.5);
}
` },
  { id: "progress", name: m("Progress bar"), w: 480, h: 70, code: `export const params = {
  percent: { type: "number", default: 72, min: 0, max: 100, label: "@Percent@" },
  seconds: { type: "number", default: 2, min: 0.2, max: 10, step: 0.1, label: "@Seconds@" },
  color: { type: "color", default: "#30d158", label: "@Color@" },
};

function draw(ctx, t, w, h, p) {
  const k = Math.min(1, t / p.seconds);
  const value = p.percent * (1 - Math.pow(1 - k, 3));
  const bar = h * 0.36, y = h - bar;
  ctx.fillStyle = "rgba(17,24,39,0.85)";
  ctx.beginPath(); ctx.roundRect(0, y, w, bar, bar / 2); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.roundRect(0, y, Math.max(bar, (w * value) / 100), bar, bar / 2); ctx.fill();
  ctx.font = "700 " + h * 0.44 + "px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.lineWidth = h * 0.08;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(Math.round(value) + "%", 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(Math.round(value) + "%", 0, 0);
}
` },
  { id: "chart", name: m("Bar chart"), w: 460, h: 300, code: `export const params = {
  values: { type: "text", default: "30, 55, 42, 80, 64", label: "@Values@" },
  seconds: { type: "number", default: 1.2, min: 0.2, max: 6, step: 0.1, label: "@Seconds@" },
  color: { type: "color", default: "#0a84ff", label: "@Color@" },
};

function draw(ctx, t, w, h, p) {
  const values = p.values.split(",").map(Number).filter((v) => isFinite(v) && v >= 0);
  if (!values.length) return;
  const top = Math.max.apply(null, values) || 1;
  const gap = w * 0.04, bar = (w - gap * (values.length + 1)) / values.length;
  ctx.fillStyle = "rgba(17,24,39,0.88)";
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 18); ctx.fill();
  ctx.font = "600 " + Math.min(22, bar * 0.4) + "px system-ui, sans-serif";
  ctx.textAlign = "center";
  values.forEach((value, i) => {
    // Bars start one after another
    const k = Math.min(1, Math.max(0, (t - i * 0.15) / p.seconds));
    const tall = (h - 70) * (value / top) * (1 - Math.pow(1 - k, 3));
    const x = gap + i * (bar + gap);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.roundRect(x, h - 20 - tall, bar, tall, 6); ctx.fill();
    ctx.fillStyle = "#ffffff";
    if (k > 0.6) ctx.fillText(String(value), x + bar / 2, h - 28 - tall);
  });
}
` },
  { id: "sonar", name: m("Sonar rings"), w: 260, h: 260, code: `export const params = {
  rings: { type: "number", default: 3, min: 1, max: 6, step: 1, label: "@Rings@" },
  seconds: { type: "number", default: 1.8, min: 0.4, max: 6, step: 0.1, label: "@Seconds@" },
  color: { type: "color", default: "#ff453a", label: "@Color@" },
};

function draw(ctx, t, w, h, p) {
  const r = Math.min(w, h) / 2;
  ctx.translate(w / 2, h / 2);
  for (let i = 0; i < p.rings; i++) {
    const q = (t / p.seconds + i / p.rings) % 1;
    ctx.globalAlpha = 1 - q;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 6 * (1 - q) + 1;
    ctx.beginPath(); ctx.arc(0, 0, r * (0.12 + 0.86 * q), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.12, 0, Math.PI * 2); ctx.fill();
}
` },
  { id: "confetti", name: m("Confetti"), w: 640, h: 420, code: `export const params = {
  pieces: { type: "number", default: 70, min: 10, max: 300, step: 1, label: "@Pieces@" },
  speed: { type: "number", default: 1, min: 0.2, max: 3, step: 0.1, label: "@Speed@" },
};

const COLORS = ["#ffd60a", "#ff453a", "#30d158", "#0a84ff", "#ffffff"];

function draw(ctx, t, w, h, p) {
  // Math.random() gives the same numbers on every frame, so each piece keeps its own path
  for (let i = 0; i < p.pieces; i++) {
    const x = Math.random() * w, fall = 0.35 + Math.random() * 0.5, phase = Math.random(), size = 6 + Math.random() * 10;
    const sway = Math.random() * 6, spin = (Math.random() - 0.5) * 8;
    const y = ((t * fall * p.speed + phase) % 1.15) * (h + 40) - 30;
    ctx.save();
    ctx.translate(x + Math.sin(t * 2 + sway) * 14, y);
    ctx.rotate(t * spin + sway);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(-size / 2, -size / 4, size, size / 2);
    ctx.restore();
  }
}
` },
];

/** The example's source with its setting names in the interface language. */
export const exampleCode = (example: CodeExample) => example.code.replace(/@([^@\n]+)@/g, (_, label: string) => t(label as Msg));
