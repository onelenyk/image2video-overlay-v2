import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEditor } from "../editor/store";
import { SWATCHES } from "./util";

// Small building blocks shared by the editor panels. Everything is sized for
// fingers first: controls are at least 44px tall and text is 13px or larger.

const ICONS: Record<string, string> = {
  back: "M15 18l-6-6 6-6",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3",
  plus: "M12 5v14M5 12h14",
  style: "M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z",
  animate: "M3 12h4l2-6 4 12 2-6h6",
  sketch: "M4 20l4-1L19 8l-3-3L5 16l-1 4zM14 7l3 3",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5",
  canvas: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4",
  export: "M12 15V4M8 8l4-4 4 4M5 13v6h14v-6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
  eyeOff: "M3 3l18 18M10.5 6.2A9.5 9.5 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.8M6.3 7.7A16.5 16.5 0 002 12s4 6 10 6c1.4 0 2.7-.3 3.9-.8",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  close: "M6 6l12 12M18 6L6 18",
  check: "M5 12l5 5 9-10",
  edit: "M4 20h4L19 9l-4-4L4 16v4z",
  prev: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  timing: "M12 7v5l3 3M12 3a9 9 0 100 18 9 9 0 000-18z",
  audio: "M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z",
  help: "M9.6 9.2a2.5 2.5 0 114.3 1.7c-.9.9-1.9 1.4-1.9 2.8M12 17.2v.1M12 3a9 9 0 100 18 9 9 0 000-18z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
  photo: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01",
};

export function Icon({ name, className = "w-5 h-5", fill = false }: { name: string; className?: string; fill?: boolean }) {
  if (name === "play" || name === "pause") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d={name === "play" ? "M7 4.5l13 7.5-13 7.5z" : "M6.5 5h4v14h-4zM13.5 5h4v14h-4z"} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ""} />
    </svg>
  );
}

export function IconButton({ icon, label, onClick, disabled, active, className = "" }: { icon: string; label: string; onClick: () => void; disabled?: boolean; active?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-11 h-11 grid place-items-center rounded-control transition-colors disabled:opacity-30 ${active ? "bg-chip-active text-fg" : "text-fg hover:bg-chip"} ${className}`}
    >
      <Icon name={icon} />
    </button>
  );
}

/** Pill button used for options and property tabs. */
export function Chip({ active, onClick, children, disabled, title }: { active?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`shrink-0 h-10 px-3.5 rounded-control text-[13px] font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
        active ? "bg-fg text-ink" : "bg-chip text-fg hover:bg-chip-hover"
      }`}
    >
      {children}
    </button>
  );
}

/** Row of chips or swatches: scrolls sideways on a phone, wraps in the desktop side column. */
export function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:flex-wrap lg:overflow-visible ${className}`}>{children}</div>;
}

/** One labelled slider. Edits apply live; one undo step is recorded when the drag ends. */
export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; format?: (value: number) => string }) {
  const commit = useEditor((s) => s.commit);
  return (
    <label className="flex items-center gap-3 h-11">
      <span className="w-20 shrink-0 text-[13px] text-fg-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        // The filled part of the track (see input[type="range"] in index.css)
        style={{ "--fill": `${((Math.min(max, Math.max(min, value)) - min) / (max - min || 1)) * 100}%` } as React.CSSProperties}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="flex-1 min-w-0"
      />
      <span className="w-12 shrink-0 text-right text-[13px] font-mono tabular-nums text-fg">{format ? format(value) : Math.round(value * 100) / 100}</span>
    </label>
  );
}

/** A number typed exactly. Applies on Enter or when the field is left. */
export function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const commit = useEditor((s) => s.commit);
  const [text, setText] = useState<string | null>(null);
  const apply = () => {
    if (text === null) return;
    const parsed = parseFloat(text.replace(",", "."));
    if (Number.isFinite(parsed)) { onChange(Math.min(max, Math.max(min, Math.round(parsed * 10) / 10))); commit(); }
    setText(null);
  };
  return (
    <label className="flex-1 min-w-0 flex items-center gap-2 h-11">
      <span className="shrink-0 text-[13px] text-fg-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text ?? String(Math.round(value * 10) / 10)}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={apply}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-full min-w-0 h-10 px-3 rounded-xl bg-raised border border-line text-[16px] sm:text-[13px] font-mono tabular-nums text-fg"
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 h-11 w-full text-[13px] text-fg"
    >
      <span>{label}</span>
      <span className={`w-[51px] h-[31px] rounded-full p-0.5 transition-colors ${checked ? "bg-success" : "bg-chip-active"}`}>
        <span className={`block w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export function ColorRow({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const commit = useEditor((s) => s.commit);
  return (
    <Row>
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Color ${color}`}
          onClick={() => { onChange(color); commit(); }}
          className={`shrink-0 w-9 h-9 rounded-full ${value.toLowerCase() === color ? "ring-2 ring-fg ring-offset-2 ring-offset-ink" : ""}`}
          style={{ background: color }}
        />
      ))}
      <label className="shrink-0 w-9 h-9 rounded-full bg-chip grid place-items-center overflow-hidden cursor-pointer" title="Custom color">
        <span className="text-[15px] leading-none text-fg-muted">+</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} onBlur={commit} className="sr-only" />
      </label>
    </Row>
  );
}

/** Button that asks for a second tap before doing something destructive. */
export function ConfirmButton({ label, confirmLabel = "Tap again to confirm", onConfirm, className = "", disabled }: { label: ReactNode; confirmLabel?: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        clearTimeout(timer.current);
        if (armed) { setArmed(false); onConfirm(); return; }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
      className={`h-11 px-4 rounded-control text-[13px] font-semibold disabled:opacity-40 ${armed ? "bg-danger text-white" : "bg-chip text-danger hover:bg-chip-hover"} ${className}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export function Button({ children, onClick, primary, disabled, className = "" }: { children: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-11 px-4 rounded-control text-[13px] transition-colors disabled:opacity-40 ${primary ? "bg-brand hover:bg-brand-hover text-on-brand font-semibold" : "bg-chip hover:bg-chip-hover text-fg font-semibold"} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Modal sheet: slides up from the bottom on a phone, centred dialog on a wide screen.
 * While it is open it swallows key presses, so editor shortcuts (Delete, Space, arrows)
 * cannot act on the canvas behind it. Esc closes it.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey, true); // capture: runs before the editor's own listener
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-raised rounded-t-sheet sm:rounded-sheet">
        <div className="shrink-0 flex items-center justify-between gap-2 pl-5 pr-3 pt-3 pb-2">
          <h2 className="text-title font-bold">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 grid place-items-center rounded-full text-fg-muted hover:bg-chip-hover"><Icon name="close" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
