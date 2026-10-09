import { create } from "zustand";
import { uk, ukPlurals } from "./uk";

// Translations, gettext-style: the English text is the key.
//   t("Start with a photo")              the text in the current language
//   t("My projects ({n})", { n: 3 })     with values put in
//   t("Custom~length")                   "~note" tells two uses of one English word apart; it is never shown
//   tn(n, "{n} overlay", "{n} overlays") a count; Ukrainian has three forms, kept in ukPlurals
//   m("Zones")                           marks a text in a constant; call t() on it when rendering
// Every text must have an entry in src/i18n/uk/*, or the build fails.
// Do not call t() at module level: constants are created before the language is known. Use m() there.

export type Lang = "en" | "uk";
export type Msg = keyof typeof uk;
export type PluralMsg = keyof typeof ukPlurals;
type Vars = Record<string, string | number>;

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "uk", label: "Українська", short: "УК" },
];

const STORE_KEY = "ph-lang";
function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved === "en" || saved === "uk") return saved;
  } catch { /* private window: fall through to the browser's language */ }
  return (navigator.languages ?? [navigator.language]).some((code) => code?.toLowerCase().startsWith("uk")) ? "uk" : "en";
}

/** The chosen language. The app is re-mounted when it changes (see main.tsx), so t() needs no hook. */
export const useLang = create<{ lang: Lang; setLang: (lang: Lang) => void }>((set) => ({
  lang: detect(),
  setLang: (lang) => {
    try { localStorage.setItem(STORE_KEY, lang); } catch { /* not remembered, still applied */ }
    document.documentElement.lang = lang;
    set({ lang });
  },
}));
document.documentElement.lang = useLang.getState().lang;

export const currentLang = () => useLang.getState().lang;
const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : text);
const plain = (msg: string) => { const cut = msg.indexOf("~"); return cut < 0 ? msg : msg.slice(0, cut); };

export function t(msg: Msg, vars?: Vars): string {
  return fill(currentLang() === "uk" ? uk[msg] : plain(msg), vars);
}

/** Marks a text for translation without translating it yet. */
export const m = (msg: Msg): Msg => msg;

const ukRules = new Intl.PluralRules("uk");
/** A counted text; `{n}` in it is the number. */
export function tn(n: number, one: PluralMsg, other: string, vars?: Vars): string {
  const all = { n, ...vars };
  if (currentLang() !== "uk") return fill(n === 1 ? one : other, all);
  const [single, few, many]: readonly string[] = ukPlurals[one];
  const rule = ukRules.select(n);
  return fill(rule === "one" ? single : rule === "few" ? few : many, all);
}

/** Seconds with their unit, e.g. "1.5s" / "1,5 с". */
export function secs(value: number, digits = 1): string {
  const text = value.toFixed(digits);
  return currentLang() === "uk" ? `${text.replace(".", ",")} с` : `${text}s`;
}
