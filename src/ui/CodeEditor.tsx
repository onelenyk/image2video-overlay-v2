import { useEffect, useState, useSyncExternalStore } from "react";
import { useEditor } from "../editor/store";
import { codeCheck, codeRetry, codeStatus, codeSupported, MAX_CODE, onCodeStatus, type ParamSpec, type ParamValue } from "../engine/codeRunner";
import type { CodeEl } from "../engine/types";
import { t, type Msg } from "../i18n";
import { ColorRow, Slider, Toggle } from "./kit";

/** Messages the sandbox produces itself; anything else comes from the browser's JavaScript engine and is shown as is. */
const KNOWN: Record<string, Msg> = {
  "The code must define function draw(ctx, t, w, h, p).": "The code must define function draw(ctx, t, w, h, p).",
  "The code took too long to draw a frame.": "The code took too long to draw a frame.",
  "The code took too long to start.": "The code took too long to start.",
  "The code is too long.": "The code is too long.",
};

/** The source of a code overlay, what is wrong with it, and the settings it declares. */
export function CodeEditor({ el }: { el: CodeEl }) {
  const patch = useEditor((s) => s.patch);
  const commit = useEditor((s) => s.commit);
  // Typing does not touch the overlay on every key: the text is applied after a short pause
  const [text, setText] = useState(el.code);
  const [applied, setApplied] = useState(el.code);
  // The overlay's code changed from outside (undo, another overlay selected): show that
  if (el.code !== applied) { setApplied(el.code); setText(el.code); }
  const apply = (next: string) => { setApplied(next); patch(el.id, { code: next }); };
  useEffect(() => {
    if (text === applied) return;
    const timer = window.setTimeout(() => { setApplied(text); patch(el.id, { code: text }); }, 450);
    return () => clearTimeout(timer);
  }, [text, applied, el.id, patch]);

  // Loading the code tells us its settings and whether it runs
  const status = useSyncExternalStore(onCodeStatus, () => codeStatus(el.code));
  useEffect(() => { void codeCheck(el.code); }, [el.code]);

  const params = status?.params ?? {};
  const names = Object.keys(params);
  const value = (name: string, spec: ParamSpec): ParamValue => (typeof el.params[name] === typeof spec.default ? el.params[name] : spec.default);
  const setParam = (name: string, next: ParamValue) => patch(el.id, { params: { ...el.params, [name]: next } });
  const label = (name: string, spec: ParamSpec) => spec.label || name;
  const unsupported = !codeSupported() || status?.error?.message === "unsupported";
  const error = status?.error;

  return (
    <div className="space-y-3">
      {names.length > 0 && (
        <div className="space-y-1">
          {names.map((name) => {
            const spec = params[name], current = value(name, spec);
            if (spec.type === "number") return <Slider key={name} label={label(name, spec)} value={current as number} min={spec.min ?? 0} max={spec.max ?? 100} step={spec.step ?? 1} onChange={(next) => setParam(name, next)} />;
            if (spec.type === "toggle") return <Toggle key={name} label={label(name, spec)} checked={current as boolean} onChange={(next) => { setParam(name, next); commit(); }} />;
            if (spec.type === "color") return <div key={name} className="space-y-1"><span className="text-[13px] text-fg-muted">{label(name, spec)}</span><ColorRow value={current as string} onChange={(next) => setParam(name, next)} /></div>;
            return (
              <label key={name} className="flex items-center gap-3 h-11">
                <span className="w-20 shrink-0 text-[13px] text-fg-muted truncate">{label(name, spec)}</span>
                <input type="text" value={current as string} maxLength={200} onChange={(e) => setParam(name, e.target.value)} onBlur={commit} className="flex-1 min-w-0 h-9 rounded-control bg-chip px-3 text-[13px] text-fg outline-none focus:ring-2 focus:ring-brand" />
              </label>
            );
          })}
        </div>
      )}

      {unsupported ? (
        <p role="alert" className="rounded-control bg-danger/15 px-3 py-2.5 text-[13px] text-fg">{t("Code overlays are not supported in this browser.")}</p>
      ) : error && (
        <div role="alert" className="rounded-control bg-danger/15 px-3 py-2.5 text-[13px] text-fg space-y-1.5">
          <p className="font-mono text-[12px] break-words">{error.line ? `${t("Line {n}", { n: error.line })}: ` : ""}{KNOWN[error.message] ? t(KNOWN[error.message]) : error.message}</p>
          {/took too long/.test(error.message) && <button type="button" onClick={() => { codeRetry(el.code); void codeCheck(el.code); patch(el.id, { params: { ...el.params } }); }} className="font-semibold underline underline-offset-2">{t("Try again")}</button>}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_CODE))}
        onBlur={() => { if (text !== applied) apply(text); commit(); }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          e.preventDefault();
          const area = e.currentTarget, at = area.selectionStart;
          const next = text.slice(0, at) + "  " + text.slice(area.selectionEnd);
          setText(next);
          requestAnimationFrame(() => { area.selectionStart = area.selectionEnd = at + 2; });
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        rows={14}
        aria-label={t("Code")}
        className="block w-full rounded-control bg-ink px-3 py-2.5 font-mono text-[12px] leading-[1.5] text-fg outline-none focus:ring-2 focus:ring-brand resize-y whitespace-pre overflow-auto"
      />
      <p className="text-[12px] leading-snug text-fg-subtle">{t("The code draws this overlay on every frame. It runs sealed off: it has no network and cannot reach your projects or account.")}</p>
    </div>
  );
}
