import { CodeEditor } from "../CodeEditor";
import { useState } from "react";
import { hexToRgb, rgbToHex } from "../../engine/renderer";
import type { El, Label } from "../../engine/types";
import { selectedElement, useEditor } from "../../editor/store";
import { Button, Chip, ColorRow, ConfirmButton, NumberField, Row, Slider, Toggle } from "../kit";
import { m, t, type Msg } from "../../i18n";

type Prop = "code" | "color" | "opacity" | "border" | "shape" | "label" | "stroke" | "ends" | "size" | "arrange";

const PROPS: Record<El["type"], Prop[]> = {
  box: ["color", "opacity", "border", "shape", "label", "size", "arrange"],
  point: ["color", "opacity", "label", "size", "arrange"],
  line: ["color", "opacity", "stroke", "ends", "arrange"],
  polygon: ["color", "opacity", "stroke", "shape", "arrange"],
  image: ["color", "opacity", "size", "arrange"],
  path: ["color", "opacity", "stroke", "arrange"],
  code: ["code", "opacity", "size", "arrange"],
};
const LABELS: Record<Prop, Msg> = { code: m("Code"), color: m("Color"), opacity: m("Opacity"), border: m("Border"), shape: m("Shape"), label: m("Label"), stroke: m("Stroke~style"), ends: m("Arrows"), size: m("Size"), arrange: m("Arrange") };

// "rgba(…)", "rgb(…)", "#rgb", "#rgba", "#rrggbb", "#rrggbbaa" -> colour and optional opacity
function parseColor(text: string): { color: string; opacity?: number } | null {
  const value = text.trim();
  let m = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(value);
  if (m) {
    const out: { color: string; opacity?: number } = { color: rgbToHex(+m[1], +m[2], +m[3]) };
    if (m[4] != null) out.opacity = Math.min(1, Math.max(0, m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4])));
    return out;
  }
  m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!m) return null;
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const out: { color: string; opacity?: number } = { color: "#" + h.slice(0, 6).toLowerCase() };
  if (h.length === 8) out.opacity = Math.round((parseInt(h.slice(6), 16) / 255) * 100) / 100;
  return out;
}

export function StylePanel() {
  const el = useEditor(selectedElement);
  const { patch, commit, remove, duplicate, reorder, notify } = useEditor();
  const [chosen, setChosen] = useState<Prop>("color");
  const [colorText, setColorText] = useState<string | null>(null);

  if (!el) return <p className="text-[13px] text-fg-muted py-3">{t("Tap an overlay on the photo to style it.")}</p>;

  const props = PROPS[el.type];
  const prop = props.includes(chosen) ? chosen : props[0];
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  const set = (changes: Partial<El>) => patch(el.id, changes);
  const setLabel = (changes: Partial<Label>) => { if ("label" in el) set({ label: { ...el.label, ...changes } } as Partial<El>); };
  const done = <T,>(fn: (value: T) => void) => (value: T) => { fn(value); commit(); };
  const [r, g, b] = hexToRgb(el.color);

  // The controls of one property
  const controls = (prop: Prop) => (
    <>
        {prop === "code" && el.type === "code" && <CodeEditor key={el.id} el={el} />}
        {prop === "color" && (
          <div className="space-y-2">
            <ColorRow value={el.color} onChange={(color) => set({ color })} />
            <input
              type="text"
              spellCheck={false}
              aria-label={t("Color as rgba or hex")}
              value={colorText ?? `rgba(${r},${g},${b},${el.opacity.toFixed(2)})`}
              onChange={(e) => setColorText(e.target.value)}
              onBlur={() => {
                if (colorText !== null) {
                  const parsed = parseColor(colorText);
                  if (parsed) { set({ color: parsed.color, ...(parsed.opacity != null ? { opacity: parsed.opacity } : {}) }); commit(); }
                  else if (colorText.trim()) notify(t("Use rgba(239,68,68,0.4) or #ef4444."), "error");
                  setColorText(null);
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="w-full h-10 px-3 rounded-xl bg-raised border border-line text-[16px] sm:text-[13px] font-mono text-fg"
            />
            {el.type === "image" && <Toggle label={t("Tint with this color")} checked={el.tint} onChange={done((tint: boolean) => set({ tint }))} />}
          </div>
        )}

        {prop === "opacity" && <Slider label={t("Opacity")} value={el.opacity} min={0} max={1} step={0.05} onChange={(opacity) => set({ opacity })} format={(v) => `${Math.round(v * 100)}%`} />}

        {prop === "border" && el.type === "box" && (
          <>
            <Slider label={t("Width")} value={el.borderWidth} min={0} max={60} onChange={(borderWidth) => set({ borderWidth })} />
            <Toggle label={t("Dashed")} checked={el.dashed} onChange={done((dashed: boolean) => set({ dashed }))} />
          </>
        )}

        {prop === "shape" && el.type === "box" && (
          <>
            <Row>
              <Chip active={el.shape === "rect"} onClick={() => done(() => set({ shape: "rect" }))(0)}>{t("Rectangle")}</Chip>
              <Chip active={el.shape === "ellipse"} onClick={() => done(() => set({ shape: "ellipse" }))(0)}>{t("Ellipse")}</Chip>
            </Row>
            {el.shape === "rect" && <Slider label={t("Corners")} value={el.radius} min={0} max={Math.round(Math.min(el.w, el.h) / 2)} onChange={(radius) => set({ radius })} />}
          </>
        )}
        {prop === "shape" && el.type === "polygon" && (
          <>
            <Toggle label={t("Closed shape")} checked={el.closed} onChange={done((closed: boolean) => set({ closed: closed && el.points.length >= 3, fill: closed ? el.fill : false }))} />
            <Toggle label={t("Fill")} checked={el.fill && el.closed} onChange={done((fill: boolean) => set({ fill: fill && el.closed }))} />
          </>
        )}

        {prop === "label" && "label" in el && (
          <div className="space-y-1">
            <div className="flex gap-2 items-center">
              <textarea
                rows={1}
                value={el.label.text}
                placeholder={t("Label text")}
                onChange={(e) => setLabel({ text: e.target.value })}
                onBlur={commit}
                className="flex-1 min-w-0 h-11 px-3 py-2.5 rounded-xl bg-raised border border-line text-[16px] sm:text-[14px] text-fg resize-none"
              />
              <label className="shrink-0 w-11 h-11 rounded-xl border border-line overflow-hidden cursor-pointer" title={t("Text color")} style={{ background: el.label.color }}>
                <input type="color" value={el.label.color} onChange={(e) => setLabel({ color: e.target.value })} onBlur={commit} className="sr-only" />
              </label>
            </div>
            <Slider label={t("Text size")} value={el.label.size} min={12} max={200} onChange={(size) => setLabel({ size })} />
            <Toggle label={t("Show label")} checked={el.label.show} onChange={done((show: boolean) => setLabel({ show }))} />
          </div>
        )}

        {prop === "stroke" && (el.type === "line" || el.type === "polygon" || el.type === "path") && (
          <>
            <Slider label={t("Thickness")} value={el.width} min={el.type === "polygon" ? 0 : 1} max={60} onChange={(width) => set({ width })} />
            {el.type !== "path" && <Toggle label={t("Dashed")} checked={el.dashed} onChange={done((dashed: boolean) => set({ dashed }))} />}
            {el.type === "path" && <Slider label={t("Glow")} value={el.glow} min={0} max={30} onChange={(glow) => set({ glow })} />}
          </>
        )}

        {prop === "ends" && el.type === "line" && (
          <>
            <Toggle label={t("Arrow at start")} checked={el.arrowA} onChange={done((arrowA: boolean) => set({ arrowA }))} />
            <Toggle label={t("Arrow at end")} checked={el.arrowB} onChange={done((arrowB: boolean) => set({ arrowB }))} />
            {(el.aRef || el.bRef) && <Button onClick={() => { set({ aRef: undefined, bRef: undefined }); commit(); }}>{t("Detach from other overlays")}</Button>}
          </>
        )}

        {prop === "size" && (el.type === "box" || el.type === "image" || el.type === "code") && (
          <>
            <Slider label={t("Width")} value={el.w} min={12} max={1000} onChange={(w) => set(el.type === "image" ? { w, h: (w * el.h) / el.w } : { w })} />
            {(el.type === "box" || el.type === "code") && <Slider label={t("Height")} value={el.h} min={12} max={2000} onChange={(h) => set({ h })} />}
            <Slider label={t("Rotation")} value={el.rot} min={0} max={360} onChange={(rot) => set({ rot })} format={(v) => `${Math.round(v)}°`} />
          </>
        )}
        {/* Exact place of the centre, in stage units (the stage is 1000 wide) */}
        {prop === "size" && (el.type === "box" || el.type === "image" || el.type === "code") && (
          <div className="flex gap-3">
            <NumberField label="X" value={el.x + el.w / 2} min={-2000} max={3000} onChange={(x) => set({ x: x - el.w / 2 })} />
            <NumberField label="Y" value={el.y + el.h / 2} min={-2000} max={6000} onChange={(y) => set({ y: y - el.h / 2 })} />
          </div>
        )}
        {prop === "size" && el.type === "point" && (
          <div className="flex gap-3">
            <NumberField label="X" value={el.x} min={-2000} max={3000} onChange={(x) => set({ x })} />
            <NumberField label="Y" value={el.y} min={-2000} max={6000} onChange={(y) => set({ y })} />
          </div>
        )}
        {prop === "size" && el.type === "point" && <Slider label={t("Radius")} value={el.r} min={6} max={120} onChange={(radius) => set({ r: radius })} />}

        {prop === "arrange" && (
          <Row>
            <Chip onClick={() => reorder(el.id, "front")}>{t("To front")}</Chip>
            <Chip onClick={() => reorder(el.id, "forward")}>{t("Forward")}</Chip>
            <Chip onClick={() => reorder(el.id, "backward")}>{t("Backward")}</Chip>
            <Chip onClick={() => reorder(el.id, "back")}>{t("To back")}</Chip>
            <Chip onClick={() => duplicate(el.id)}>{t("Duplicate")}</Chip>
            <Chip onClick={() => { set({ visible: !el.visible }); commit(); }}>{el.visible ? t("Hide") : t("Show")}</Chip>
            <ConfirmButton label={t("Delete")} confirmLabel={t("Delete?")} onConfirm={() => remove(el.id)} className="shrink-0 !h-10 !rounded-full" />
          </Row>
        )}
    </>
  );

  // Wide screens have room for the whole list: every property under its own label
  if (wide) {
    return (
      <div className="space-y-4">
        {props.map((key) => (
          <div key={key}>
            {/* Opacity is a single slider that already carries its own label */}
            {key !== "opacity" && <h4 className="mb-1.5 text-[12px] font-medium text-fg-muted">{t(LABELS[key])}</h4>}
            {controls(key)}
          </div>
        ))}
      </div>
    );
  }

  // Phone: one property at a time, picked from the row of chips
  return (
    <div className="space-y-2">
      <div className="min-h-[52px] flex flex-col justify-center">{controls(prop)}</div>
      <Row>
        {props.map((key) => <Chip key={key} active={key === prop} onClick={() => setChosen(key)}>{t(LABELS[key])}</Chip>)}
      </Row>
    </div>
  );
}
