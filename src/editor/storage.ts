import type { Asset, Scene } from "../engine/types";

// Everything the app keeps between visits goes through this interface. Today
// the only implementation is the browser's own IndexedDB (db.ts); with accounts
// a server-backed one takes its place and nothing above this file changes.
//
// What that asks of the data already now:
//   - ids are UUIDs, so they stay unique across users and devices;
//   - every record says who owns it and which version of the format it is in;
//   - a project's photo and narration are files of their own, not part of the record;
//   - writes can fail, and callers are told when they do.

/** Version of the project record format. Bump it together with a step in `upgradeProject`. */
export const PROJECT_FORMAT = 1;

/** Owner of everything made before there are accounts. */
export const LOCAL_USER = "local";

export interface User {
  id: string;
  /** Not signed in: data lives on this device only. */
  guest: boolean;
}
/** The one place that knows who is using the app. */
export const currentUser = (): User => ({ id: LOCAL_USER, guest: true });

export interface ProjectMeta {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  thumb: string; // small JPEG data URL for the project list
}

export interface ProjectRecord extends ProjectMeta {
  format: number;
  scene: Scene;
  assets: Record<string, Asset>;
  narrationName?: string;
}

/** The files that belong to a project next to its record. */
export type FileKind = "image" | "audio";

export interface Storage {
  listProjects(): Promise<ProjectMeta[]>;
  getProject(id: string): Promise<ProjectRecord | null>;
  /** Rejects when the record could not be stored. */
  putProject(record: ProjectRecord): Promise<void>;
  /** Removes the project and its files. */
  removeProject(id: string): Promise<void>;

  getFile(projectId: string, kind: FileKind): Promise<Blob | null>;
  putFile(projectId: string, kind: FileKind, file: Blob): Promise<void>;
  removeFile(projectId: string, kind: FileKind): Promise<void>;

  /** Saved templates as stored. They are untrusted until parsed (see engine/template.ts). */
  listTemplates(): Promise<unknown[]>;
  putTemplate(id: string, data: unknown): Promise<void>;
  removeTemplate(id: string): Promise<void>;
}

/** A new id for a project, template or file: unique without asking a server. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Old browsers on plain http: random enough for a local-only fallback
  return "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/** Brings a stored record of any older format up to the current one. */
export function upgradeProject(raw: unknown): ProjectRecord | null {
  const r = raw as Partial<ProjectRecord> | null;
  if (!r || typeof r !== "object" || typeof r.id !== "string" || !r.scene) return null;
  const updatedAt = typeof r.updatedAt === "number" ? r.updatedAt : Date.now();
  // Format 0 (before versioning): no owner, no creation time
  return {
    id: r.id,
    name: typeof r.name === "string" ? r.name : "Untitled",
    ownerId: typeof r.ownerId === "string" ? r.ownerId : LOCAL_USER,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : updatedAt,
    updatedAt,
    thumb: typeof r.thumb === "string" ? r.thumb : "",
    format: PROJECT_FORMAT,
    scene: r.scene,
    assets: r.assets && typeof r.assets === "object" ? r.assets : {},
    narrationName: typeof r.narrationName === "string" ? r.narrationName : undefined,
  };
}
