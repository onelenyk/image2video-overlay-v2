import { useEffect, useMemo, useRef, useState } from "react";
import { AiError, DEFAULT_PROVIDER, loadEffort, loadKey, saveEffort, saveKey, type AiFailure, type AiProgress } from "../ai/provider";
import { draftTemplate, type AiDraft } from "../ai/template";
import { useEditor } from "../editor/store";
import { buildTemplate, type Built } from "../engine/template";
import { m, t, tn, type Msg } from "../i18n";
import { Button, Sheet, Toggle } from "./kit";
import { ScenePreview } from "./MiniPreview";

const provider = DEFAULT_PROVIDER;

const FAILURES: Record<AiFailure, Msg> = {
  key: m("DeepSeek did not accept this key. Check it and try again."),
  balance: m("The DeepSeek account has no balance left. Top it up and try again."),
  busy: m("DeepSeek is busy right now. Try again in a moment."),
  network: m("Could not reach DeepSeek. Check the connection."),
  answer: m("The answer was not a usable template. Try again, or describe it differently."),
  length: m("The model thought for too long and ran out of room for the answer. Try again, or choose Quick."),
};
const EFFORTS: Record<string, { name: Msg; note: Msg }> = {
  quick: { name: m("Quick"), note: m("About 10 seconds.") },
  thoughtful: { name: m("Thoughtful"), note: m("About a minute: the model thinks the design through first. Usually more polished.") },
  best: { name: m("Pro model"), note: m("The larger model: over a minute and several times the price. Not always better.") },
};
const IDEAS: Msg[] = [
  m("Three steps of a recipe, numbered, with a short line each"),
  m("Tour of a two-room flat: rooms light up one by one with their names"),
  m("A route from the metro to our office with the walking time"),
  m("Before and after: two halves with labels and an arrow between them"),
];
const field = "w-full rounded-control bg-chip-hover px-3 text-[14px] text-fg placeholder:text-fg-subtle outline-none focus:ring-2 focus:ring-brand";

/** Describe a template in words, get it drawn by the user's own AI provider, then add or save it. */
export function AiTemplateSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, built: Built) => void }) {
  const stage = useEditor((s) => s.scene.stage);
  const photo = useEditor((s) => s.image);
  const saveBuiltTemplate = useEditor((s) => s.saveBuiltTemplate);
  const [key, setKey] = useState(() => loadKey(provider));
  const [keyDraft, setKeyDraft] = useState("");
  const [editingKey, setEditingKey] = useState(false);
  const [request, setRequest] = useState("");
  const [change, setChange] = useState("");
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AiFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [rich, setRich] = useState(true);
  const [effort, setEffort] = useState(() => loadEffort(provider));
  const [waited, setWaited] = useState(0);
  const [progress, setProgress] = useState<AiProgress | null>(null);
  useEffect(() => {
    if (!busy) return;
    const started = Date.now();
    const timer = window.setInterval(() => setWaited(Math.round((Date.now() - started) / 1000)), 1000);
    return () => { clearInterval(timer); setWaited(0); };
  }, [busy]);
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);

  const built = useMemo(() => (draft ? buildTemplate(draft.spec, stage.w, stage.h) : null), [draft, stage.w, stage.h]);
  const story = built ? Math.max(0.5, ...built.elements.map((el) => (el.type === "path" && el.sketch ? el.sketch.start + (el.sketch.times.at(-1) ?? 0) : el.time?.start ?? 0))) : 0;

  const keepKey = () => {
    const value = keyDraft.trim();
    if (!value) return;
    saveKey(provider, value); // if it cannot be stored, it still works until the page is closed
    setKey(value);
    setKeyDraft("");
    setEditingKey(false);
    setFailure(null);
  };
  const forgetKey = () => { saveKey(provider, ""); setKey(""); setEditingKey(false); };

  const run = async (text: string, previous?: AiDraft) => {
    if (!text.trim() || busy) return;
    const control = new AbortController();
    running.current = control;
    setBusy(true);
    setProgress(null);
    setFailure(null);
    try {
      const next = await draftTemplate(provider, key, effort, text, stage.w / stage.h, rich, previous, control.signal, setProgress);
      setDraft(next);
      setChange("");
      setSaved(false);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      const why = error instanceof AiError ? error.why : "network";
      setFailure(why);
      if (why === "key") setEditingKey(true);
    } finally {
      if (running.current === control) { running.current = null; setBusy(false); }
    }
  };

  const coded = draft ? draft.spec.parts.filter((part) => part.kind === "code").length : 0;
  // What to say while waiting: connecting, thinking, then the answer being written
  const status = !progress ? t("Sending the request… {n} s", { n: waited })
    : progress.phase === "thinking" ? t("The model is thinking… {n} s", { n: waited })
    : t("Writing the template… {chars} characters, {n} s", { chars: progress.chars, n: waited });
  const needsKey = !key || editingKey;
  return (
    <Sheet title={t("Template with AI")} onClose={onClose}>
      <div className="space-y-4 pt-1">
        {failure && <p role="alert" className="rounded-control bg-danger/15 px-3 py-2.5 text-[13px] text-fg">{t(FAILURES[failure])}</p>}

        {needsKey ? (
          <section className="space-y-3" aria-label={t("AI provider key")}>
            <p className="text-[13px] leading-snug text-fg-muted">{t("Templates are written by an AI model through your own DeepSeek account. Paste an API key to connect it.")}</p>
            <input type="password" autoComplete="off" spellCheck={false} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") keepKey(); }} placeholder={provider.keyHint} aria-label={t("DeepSeek API key")} className={`${field} h-11 font-mono`} />
            <p className="text-[12px] leading-snug text-fg-subtle">{t("The key is kept in this browser only and is sent only to DeepSeek, together with your description. Your photo is never sent. DeepSeek charges your account for each request.")}</p>
            <div className="flex flex-wrap gap-2">
              <Button primary disabled={!keyDraft.trim()} onClick={keepKey}>{t("Save key")}</Button>
              <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="h-11 px-4 inline-flex items-center rounded-control bg-chip-hover hover:bg-chip-active text-[13px] font-semibold text-fg">{t("Get a key")}</a>
              {key && <Button className="!bg-chip-hover hover:!bg-chip-active" onClick={() => { setEditingKey(false); setKeyDraft(""); }}>{t("Cancel")}</Button>}
              {key && <button type="button" onClick={forgetKey} className="h-11 px-3 text-[13px] font-semibold text-danger">{t("Remove key")}</button>}
            </div>
          </section>
        ) : !draft ? (
          <section className="space-y-3">
            <textarea value={request} onChange={(e) => setRequest(e.target.value)} rows={4} maxLength={2000} placeholder={t("Describe what the template should show")} aria-label={t("Describe what the template should show")} className={`${field} py-2.5 resize-none leading-snug`} />
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => setRequest(t(idea))} className="max-w-full px-3 py-1.5 rounded-control bg-chip-hover hover:bg-chip-active text-[12px] text-fg-muted text-left">{t(idea)}</button>
              ))}
            </div>
            <Toggle label={t("Lively: let the AI write code for motion")} checked={rich} onChange={setRich} />
            <div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-control bg-chip-hover" role="group" aria-label={t("How hard the AI thinks")}>
                {provider.efforts.map((item) => (
                  <button key={item.id} type="button" aria-pressed={effort.id === item.id} onClick={() => { setEffort(item); saveEffort(provider, item); }} className={`h-9 rounded-[7px] text-[13px] font-semibold transition-colors ${effort.id === item.id ? "bg-fg text-ink" : "text-fg-muted hover:text-fg"}`}>{t(EFFORTS[item.id]?.name ?? "Quick")}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-fg-subtle">{t(EFFORTS[effort.id]?.note ?? "About 10 seconds.")}</p>
            </div>
            <Button primary disabled={!request.trim() || busy} onClick={() => void run(request)} className="w-full">{busy ? status : t("Create template")}</Button>
            <p className="text-[12px] leading-snug text-fg-subtle">{t("The model does not see your photo: it lays things out by your description, and you drag them into place afterwards.")}</p>
          </section>
        ) : built && (
          <section className="space-y-3">
            {/* The draft plays over the project's own photo, at the stage's proportions */}
            <div className="mx-auto rounded-card overflow-hidden bg-[#5c5c61] bg-cover bg-center" style={{ maxWidth: `calc(38dvh * ${stage.w / stage.h})`, backgroundImage: photo ? `url("${photo.src}")` : undefined }}>
              <ScenePreview key={draft.thread.length} elements={built.elements} assets={built.assets} width={stage.w} height={stage.h} seconds={story + 2.5} className="block w-full" style={{ aspectRatio: `${stage.w} / ${stage.h}` }} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-fg">{draft.spec.name}</div>
              <div className="text-[13px] leading-snug text-fg-muted">{draft.spec.hint}</div>
              <div className="text-[12px] text-fg-subtle">{tn(draft.spec.parts.length, "{n} part", "{n} parts")}{coded > 0 ? ` · ${tn(coded, "{n} drawn by code", "{n} drawn by code")}` : ""}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button primary onClick={() => onAdd(draft.spec.name, built)}>{t("Add to the photo")}</Button>
              <Button className="!bg-chip-hover hover:!bg-chip-active" disabled={saved} onClick={() => void saveBuiltTemplate(draft.spec.name, built).then(setSaved)}>{saved ? t("Saved") : t("Save to my templates")}</Button>
            </div>
            <div className="flex gap-2">
              <input value={change} onChange={(e) => setChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void run(change, draft); }} maxLength={500} placeholder={t("What to change, e.g. “make the labels shorter”")} aria-label={t("What to change")} className={`${field} h-11 min-w-0`} />
              <Button disabled={!change.trim() || busy} onClick={() => void run(change, draft)} className="shrink-0 !bg-chip-hover hover:!bg-chip-active">{busy ? "…" : t("Change")}</Button>
            </div>
            {busy && <p role="status" className="text-[12px] text-fg-muted">{status}</p>}
            <button type="button" disabled={busy} onClick={() => { setDraft(null); setFailure(null); }} className="h-9 text-[13px] font-semibold text-fg-muted hover:text-fg disabled:opacity-40">{t("Start over")}</button>
          </section>
        )}

        {!needsKey && (
          <p className="pt-1 text-[12px] text-fg-subtle">
            {t("Connected: DeepSeek, your key.")}{" "}
            <button type="button" onClick={() => setEditingKey(true)} className="font-semibold text-fg-muted hover:text-fg underline underline-offset-2">{t("Change key")}</button>
          </p>
        )}
      </div>
    </Sheet>
  );
}
