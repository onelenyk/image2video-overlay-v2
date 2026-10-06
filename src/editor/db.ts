import { upgradeProject, type FileKind, type ProjectRecord, type Storage } from "./storage";

// Storage in this browser: IndexedDB. Project records and saved templates as
// JSON, photos and narration as blobs keyed "<project id>:<kind>".

const LEGACY_TEMPLATE_INDEX = "plan-highlighter:templates";
type StoreName = "projects" | "blobs" | "templates";

let opening: Promise<IDBDatabase> | null = null;
const open = () =>
  (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("plan-highlighter", 4);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
      if (!db.objectStoreNames.contains("templates")) db.createObjectStore("templates");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error) => { opening = null; throw error; }));

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = fn(tx.objectStore(store));
    // A write counts only once its transaction has completed (quota errors arrive there)
    if (mode === "readonly") request.onsuccess = () => resolve(request.result);
    else tx.oncomplete = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
  });
}
/** Reads fall back to "nothing there" when storage is unavailable (private mode, blocked site data). */
async function read<T>(store: StoreName, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try { return await run(store, "readonly", fn); } catch (error) { console.warn("Storage is unavailable:", error); return undefined; }
}
const fileKey = (projectId: string, kind: FileKind) => `${projectId}:${kind}`;

/** Templates used to be blobs listed in localStorage; move them over once. */
async function adoptLegacyTemplates() {
  let ids: unknown;
  try { ids = JSON.parse(localStorage.getItem(LEGACY_TEMPLATE_INDEX) ?? "null"); } catch { ids = null; }
  if (!Array.isArray(ids)) return;
  for (const id of ids) {
    if (typeof id !== "string") continue;
    try {
      const blob = await read<Blob>("blobs", (s) => s.get(`tpl:${id}`));
      if (blob) {
        const data: unknown = JSON.parse(await blob.text());
        await run("templates", "readwrite", (s) => s.put(data, id));
      }
      await run("blobs", "readwrite", (s) => s.delete(`tpl:${id}`));
    } catch { /* an unreadable entry is not worth keeping */ }
  }
  try { localStorage.removeItem(LEGACY_TEMPLATE_INDEX); } catch { /* storage unavailable */ }
}

export const localStore: Storage = {
  async listProjects() {
    const all = (await read<unknown[]>("projects", (s) => s.getAll())) ?? [];
    return all
      .map(upgradeProject)
      .filter((record): record is ProjectRecord => record !== null)
      .map(({ id, name, ownerId, createdAt, updatedAt, thumb }) => ({ id, name, ownerId, createdAt, updatedAt, thumb }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
  async getProject(id) {
    return upgradeProject(await read<unknown>("projects", (s) => s.get(id)));
  },
  async putProject(record) {
    await run("projects", "readwrite", (s) => s.put(record));
  },
  async removeProject(id) {
    await run("projects", "readwrite", (s) => s.delete(id));
    await run("blobs", "readwrite", (s) => s.delete(fileKey(id, "image")));
    await run("blobs", "readwrite", (s) => s.delete(fileKey(id, "audio")));
  },

  async getFile(projectId, kind) {
    return (await read<Blob>("blobs", (s) => s.get(fileKey(projectId, kind)))) ?? null;
  },
  async putFile(projectId, kind, file) {
    await run("blobs", "readwrite", (s) => s.put(file, fileKey(projectId, kind)));
  },
  async removeFile(projectId, kind) {
    await run("blobs", "readwrite", (s) => s.delete(fileKey(projectId, kind)));
  },

  async listTemplates() {
    await adoptLegacyTemplates();
    return (await read<unknown[]>("templates", (s) => s.getAll())) ?? [];
  },
  async putTemplate(id, data) {
    await run("templates", "readwrite", (s) => s.put(data, id));
  },
  async removeTemplate(id) {
    await run("templates", "readwrite", (s) => s.delete(id));
  },
};

/** The storage in use. Swapping this for a server-backed one is the whole switch to accounts. */
export const storage: Storage = localStore;
