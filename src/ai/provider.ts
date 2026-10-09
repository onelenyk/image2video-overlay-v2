// AI providers the user can plug their own key into. The key stays on this
// device and requests go straight from the browser to the provider: nothing
// passes through our servers.

/** Why a request failed, in terms the interface can explain. */
export type AiFailure = "key" | "balance" | "busy" | "network" | "answer";
export class AiError extends Error {
  readonly why: AiFailure;
  constructor(why: AiFailure, detail = "") { super(detail || why); this.why = why; }
}

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface Provider {
  id: string;
  label: string;
  /** Where the user gets a key. */
  keyUrl: string;
  /** What a key looks like, shown as the field's placeholder. */
  keyHint: string;
  /** Asks for a JSON object and returns the raw text of the answer. */
  json(key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string>;
}

const deepseek: Provider = {
  id: "deepseek",
  label: "DeepSeek",
  keyUrl: "https://platform.deepseek.com/api_keys",
  keyHint: "sk-…",
  async json(key, messages, signal) {
    let response: Response;
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "deepseek-chat", messages, response_format: { type: "json_object" }, temperature: 0.8, max_tokens: 8000 }),
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") throw error;
      throw new AiError("network");
    }
    if (response.status === 401 || response.status === 403) throw new AiError("key");
    if (response.status === 402) throw new AiError("balance");
    if (response.status === 429 || response.status >= 500) throw new AiError("busy");
    if (!response.ok) throw new AiError("answer", `HTTP ${response.status}`);
    const data = (await response.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new AiError("answer");
    return content;
  },
};

export const PROVIDERS: Provider[] = [deepseek];
export const DEFAULT_PROVIDER = deepseek;

const slot = (provider: Provider) => `ph-ai-key-${provider.id}`;
/** The saved key, or "" when there is none (or storage is unavailable). */
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
