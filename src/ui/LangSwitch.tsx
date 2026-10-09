import { LANGS, useLang } from "../i18n";

/** Two-way language switch. */
export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex p-0.5 rounded-control bg-chip ${className}`} role="group" aria-label="Language / Мова">
      {LANGS.map((item) => (
        <button key={item.id} type="button" lang={item.id} title={item.label} aria-pressed={lang === item.id} onClick={() => setLang(item.id)} className={`h-8 min-w-10 px-2 rounded-[7px] text-[12px] font-semibold transition-colors ${lang === item.id ? "bg-chip-active text-fg" : "text-fg-muted hover:text-fg"}`}>
          {item.short}
        </button>
      ))}
    </div>
  );
}
