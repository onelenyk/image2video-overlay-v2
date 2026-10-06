import type { Asset, Scene } from "../engine/types";

// Projects live in IndexedDB: the scene as JSON, the photo and narration as blobs.

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  thumb: string; // small JPEG data URL for the project list
}

export interface ProjectRecord extends ProjectMeta {
  scene: Scene;
  assets: Record<string, Asset>;
  narrationName?: string;
}

let opening: Promise<IDBDatabase> | null = null;
const open = () =>
  (opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("plan-highlighter", 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));

async function run<T>(store: "projects" | "blobs", mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T>((resolve, reject) => {
      const request = fn(db.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Storage is unavailable:", error);
    return undefined;
  }
}

export const db = {
  async list(): Promise<ProjectMeta[]> {
    const all = (await run<ProjectRecord[]>("projects", "readonly", (s) => s.getAll())) ?? [];
    return all.map(({ id, name, updatedAt, thumb }) => ({ id, name, updatedAt, thumb })).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get: (id: string) => run<ProjectRecord>("projects", "readonly", (s) => s.get(id)),
  put: (record: ProjectRecord) => run("projects", "readwrite", (s) => s.put(record)),
  async remove(id: string) {
    await run("projects", "readwrite", (s) => s.delete(id));
    await run("blobs", "readwrite", (s) => s.delete(`${id}:image`));
    await run("blobs", "readwrite", (s) => s.delete(`${id}:audio`));
  },
  getBlob: (key: string) => run<Blob>("blobs", "readonly", (s) => s.get(key)),
  putBlob: (key: string, blob: Blob) => run("blobs", "readwrite", (s) => s.put(blob, key)),
  removeBlob: (key: string) => run("blobs", "readwrite", (s) => s.delete(key)),
};
