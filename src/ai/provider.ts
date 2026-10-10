// AI providers the user can plug their own key into. The key stays on this
// device and requests go straight from the browser to the provider: nothing
// passes through our servers.

/** Why a request failed, in terms the interface can explain. */
export type AiFailure = "key" | "balance" | "busy" | "network" | "answer" | "length";
export class AiError extends Error {
  readonly why: AiFailure;
  constructor(why: AiFailure, detail = "") { super(detail || why); this.why = why; }
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

/** What the model is doing right now, and how much text it has produced in that phase. */
export interface AiProgress { phase: "thinking" | "writing"; chars: number }

/** How much the model should think before answering. Slower and dearer levels design better. */
export interface Effort { id: string; model: string; thinking: boolean }

export interface Provider {
  id: string;
  label: string;
  /** Where the user gets a key. */
  keyUrl: string;
  /** What a key looks like, shown as the field's placeholder. */
  keyHint: string;
  /** Quickest first. */
  efforts: Effort[];
  /** Asks for a JSON object and returns the raw text of the answer. */
  json(key: string, messages: ChatMessage[], effort: Effort, signal?: AbortSignal, onProgress?: (progress: AiProgress) => void): Promise<string>;
}

const deepseek: Provider = {
  id: "deepseek",
  label: "DeepSeek",
  keyUrl: "https://platform.deepseek.com/api_keys",
  keyHint: "sk-…",
  efforts: [
    { id: "quick", model: "deepseek-flash", thinking: false },
    { id: "thoughtful", model: "deepseek-flash", thinking: true },
    { id: "best", model: "deepseek-v4-pro", thinking: true },
  ],
  async json(key, messages, effort, signal, onProgress) {
    const ask = (strict: boolean) => fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: effort.model,
        messages,
        stream: true,
        // Thinking is counted against this limit: measured at 10-12 thousand tokens of thinking before a 2-3 thousand token answer
        max_tokens: 64000,
        ...(strict ? { response_format: { type: "json_object" } } : {}),
        ...(effort.thinking ? { thinking: { type: "enabled" }, reasoning_effort: "low" } : { thinking: { type: "disabled" }, temperature: 0.9 }),
      }),
    });
    let response: Response;
    try {
      response = await ask(true);
      // Some model and mode combinations refuse the strict JSON switch; the answer is parsed leniently anyway
      if (response.status === 400) response = await ask(false);
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw new AiError("network");
    }
    if (response.status === 401 || response.status === 403) throw new AiError("key");
    if (response.status === 402) throw new AiError("balance");
    if (response.status === 429 || response.status >= 500) throw new AiError("busy");
    if (!response.ok || !response.body) throw new AiError("answer", `HTTP ${response.status}`);

    // The answer arrives in pieces ("data: {...}" lines): first the model's thinking, then the text itself
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", content = "", thought = 0, finish = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          let piece: { choices?: { finish_reason?: string | null; delta?: { content?: string | null; reasoning_content?: string | null } }[] };
          try { piece = JSON.parse(payload); } catch { continue; }
          const choice = piece.choices?.[0];
          if (!choice) continue;
          if (choice.delta?.reasoning_content) thought += choice.delta.reasoning_content.length;
          if (choice.delta?.content) content += choice.delta.content;
          if (choice.finish_reason) finish = choice.finish_reason;
          if (content) onProgress?.({ phase: "writing", chars: content.length }); else if (thought) onProgress?.({ phase: "thinking", chars: thought });
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw new AiError("network");
    }
    if (!content.trim()) throw new AiError(finish === "length" ? "length" : "answer");
    return content;
  },
};

export const PROVIDERS: Provider[] = [deepseek];
export const DEFAULT_PROVIDER = deepseek;

const slot = (provider: Provider) => `ph-ai-key-${provider.id}`;
/** The saved key, or "" when there is none (or storage is unavailable). */
const effortSlot = (provider: Provider) => `ph-ai-level-${provider.id}`;
/** The effort chosen last time; the quickest by default. */
export function loadEffort(provider: Provider): Effort {
  let saved: string | null = null;
  try { saved = localStorage.getItem(effortSlot(provider)); } catch { /* default below */ }
  return provider.efforts.find((effort) => effort.id === saved) ?? provider.efforts[0];
}
export function saveEffort(provider: Provider, effort: Effort) {
  try { localStorage.setItem(effortSlot(provider), effort.id); } catch { /* not remembered */ }
}

export function loadKey(provider: Provider): string {
  try { return localStorage.getItem(slot(provider)) ?? ""; } catch { return ""; }
}
/** Saves the key on this device; an empty key removes it. Returns false if it could not be stored. */
export function saveKey(provider: Provider, key: string): boolean {
  try {
    if (key) localStorage.setItem(slot(provider), key); else localStorage.removeItem(slot(provider));
    return true;
  } catch { return false; }
}
