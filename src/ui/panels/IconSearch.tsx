import { useEffect, useState } from "react";

// Online icon search through the public Iconify API (https://iconify.design).
// Only permissively licensed sets are searched (MIT / Apache 2.0 / ISC), so
// icons can be used in exported videos without attribution. Nothing is
// requested until the user types a query; a chosen icon is copied into the
// project, so it keeps working offline afterwards.

// Iconify runs three equivalent hosts. If one is unreachable (network trouble,
// or a content blocker that knows only the main name), the next one is tried.
const HOSTS = ["https://api.iconify.design", "https://api.simplesvg.com", "https://api.unisvg.com"];
let goodHost = HOSTS[0];

/** GET `path` from the first host that answers; remembers which one worked. */
async function request(path: string, signal?: AbortSignal): Promise<Response> {
  const order = [goodHost, ...HOSTS.filter((host) => host !== goodHost)];
  let failure: unknown = new Error("unreachable");
  for (const host of order) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 7000);
    const abort = () => timeout.abort();
    signal?.addEventListener("abort", abort);
    try {
      const response = await fetch(host + path, { signal: timeout.signal });
      if (response.ok) { goodHost = host; return response; }
      failure = new Error(`${host} answered ${response.status}`);
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      failure = error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  console.warn("Icon search failed on every host:", failure);
  throw failure;
}
const SETS = ["mdi", "material-symbols", "tabler", "lucide", "ph", "heroicons", "carbon", "fluent", "ri", "bi"];
const SUGGESTIONS = ["home", "door", "bed", "kitchen", "bath", "stairs", "window", "sofa", "car", "tree", "camera", "location"];

interface IconSetData {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number; left?: number; top?: number }>;
  aliases?: Record<string, { parent: string }>;
}

/**
 * SVG markup for the given "set:name" ids. Uses the JSON endpoint, which every
 * host serves (the backup hosts refuse plain .svg files), one request per set.
 */
async function loadIcons(ids: string[], signal?: AbortSignal): Promise<Record<string, string>> {
  const bySet = new Map<string, string[]>();
  for (const id of ids) {
    const [set, name] = id.split(":");
    bySet.set(set, [...(bySet.get(set) ?? []), name]);
  }
  const out: Record<string, string> = {};
  await Promise.all([...bySet].map(async ([set, names]) => {
    const data = (await (await request(`/${set}.json?icons=${names.join(",")}`, signal)).json()) as IconSetData;
    for (const name of names) {
      const icon = data.icons[name] ?? data.icons[data.aliases?.[name]?.parent ?? ""];
      if (!icon) continue;
      const w = icon.width ?? data.width ?? 24, h = icon.height ?? data.height ?? 24;
      out[`${set}:${name}`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left ?? 0} ${icon.top ?? 0} ${w} ${h}">${icon.body}</svg>`;
    }
  }));
  return out;
}

type Status = "idle" | "loading" | "done" | "error";

export function IconSearch({ onPick }: { onPick: (svg: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [icons, setIcons] = useState<Record<string, string>>({}); // id -> SVG markup
  const [attempt, setAttempt] = useState(0);
  const term = query.trim();

  // Search a moment after typing stops
  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await request(`/search?query=${encodeURIComponent(term)}&limit=48&prefixes=${SETS.join(",")}`, controller.signal);
        const data = (await response.json()) as { icons?: string[] };
        // The drawings come with the results, so picking one needs no further request
        setIcons(await loadIcons(data.icons ?? [], controller.signal));
        setStatus("done");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, attempt]);

  const searching = term.length >= 2;
  const ids = Object.keys(icons);
  return (
    <div className="space-y-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search more icons online"
        aria-label="Search icons online"
        enterKeyHint="search"
        className="w-full h-10 px-3 rounded-control bg-raised border border-line text-[16px] sm:text-[13px] text-fg placeholder:text-fg-subtle"
      />
      {!searching && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap lg:overflow-visible">
          {SUGGESTIONS.map((word) => (
            <button key={word} type="button" onClick={() => setQuery(word)} className="shrink-0 h-8 px-2.5 rounded-full bg-chip hover:bg-chip-hover text-[12px] text-fg-muted">
              {word}
            </button>
          ))}
        </div>
      )}
      {searching && status === "loading" && <p className="text-[12px] text-fg-subtle">Searching…</p>}
      {searching && status === "error" && (
        <div className="space-y-1.5">
          <p className="text-[12px] text-danger">
            Could not reach the icon service. If you are online, an ad or tracker blocker (or a browser's shield) may be stopping requests to iconify.design: allow it for this page and try again.
          </p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-9 px-3 rounded-control bg-chip hover:bg-chip-hover text-[13px] font-semibold text-fg">Try again</button>
        </div>
      )}
      {searching && status === "done" && ids.length === 0 && <p className="text-[12px] text-fg-subtle">Nothing found for “{term}”. Try a simpler English word.</p>}
      {searching && ids.length > 0 && status !== "error" && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              title={id}
              aria-label={`Add ${id.split(":")[1].replace(/-/g, " ")}`}
              onClick={() => onPick(icons[id])}
              className="shrink-0 w-12 lg:w-auto h-12 rounded-control bg-chip hover:bg-chip-hover grid place-items-center"
            >
              <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(icons[id].replace(/currentColor/g, "#f2f2f2"))}`} alt="" width={24} height={24} className="w-6 h-6" />
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-fg-subtle">
        Search uses iconify.design; what you type is sent there. Open-licensed sets only.
      </p>
    </div>
  );
}
