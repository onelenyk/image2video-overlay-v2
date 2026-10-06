import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PROJECT_FORMAT, upgradeProject, type FileKind, type ProjectMeta, type Storage } from "./storage";

// Storage in the user's account (Supabase): rows in `projects` and `templates`,
// files in the private bucket `project-files` at <user id>/<project id>/<kind>.
// Row level security on the server limits everything to its owner; nothing here
// is trusted to do that.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

/** The connection to the server, or null when the app is built without accounts. */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } })
  : null;

const BUCKET = "project-files";
const fail = (what: string, error: { message: string } | null) => { if (error) throw new Error(`${what}: ${error.message}`); };
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface Row { id: string; owner_id: string; name: string; format: number; scene: unknown; assets: unknown; narration_name: string | null; thumb: string; created_at: string; updated_at: string }
const metaOf = (row: Pick<Row, "id" | "owner_id" | "name" | "thumb" | "created_at" | "updated_at">): ProjectMeta => ({
  id: row.id, name: row.name, ownerId: row.owner_id, thumb: row.thumb, createdAt: Date.parse(row.created_at), updatedAt: Date.parse(row.updated_at),
});

export function remoteStore(client: SupabaseClient, userId: string): Storage {
  const path = (projectId: string, kind: FileKind) => `${userId}/${projectId}/${kind}`;
  return {
    async listProjects() {
      const { data, error } = await client.from("projects").select("id, owner_id, name, thumb, created_at, updated_at").order("updated_at", { ascending: false });
      fail("Could not load projects", error);
      return (data ?? []).map(metaOf);
    },
    async getProject(id) {
      if (!isUuid(id)) return null;
      const { data, error } = await client.from("projects").select("*").eq("id", id).maybeSingle<Row>();
      fail("Could not load the project", error);
      if (!data) return null;
      return upgradeProject({ ...metaOf(data), format: data.format, scene: data.scene, assets: data.assets, narrationName: data.narration_name ?? undefined });
    },
    async putProject(record) {
      const { error } = await client.from("projects").upsert({
        id: record.id, owner_id: userId, name: record.name, format: PROJECT_FORMAT, scene: record.scene, assets: record.assets,
        narration_name: record.narrationName ?? null, thumb: record.thumb,
        created_at: new Date(record.createdAt).toISOString(), updated_at: new Date(record.updatedAt).toISOString(),
      });
      fail("Could not save the project", error);
    },
    async removeProject(id) {
      const { error } = await client.from("projects").delete().eq("id", id);
      fail("Could not delete the project", error);
      await client.storage.from(BUCKET).remove([path(id, "image"), path(id, "audio")]);
    },

    async getFile(projectId, kind) {
      const { data, error } = await client.storage.from(BUCKET).download(path(projectId, kind));
      return error ? null : data; // "not found" is the normal case for a project without that file
    },
    async putFile(projectId, kind, file) {
      const { error } = await client.storage.from(BUCKET).upload(path(projectId, kind), file, { upsert: true, contentType: file.type || "application/octet-stream" });
      fail("Could not upload the file", error);
    },
    async removeFile(projectId, kind) {
      const { error } = await client.storage.from(BUCKET).remove([path(projectId, kind)]);
      fail("Could not remove the file", error);
    },

    async listTemplates() {
      const { data, error } = await client.from("templates").select("data").order("created_at", { ascending: true });
      fail("Could not load templates", error);
      return (data ?? []).map((row) => row.data as unknown);
    },
    async putTemplate(id, data) {
      const { error } = await client.from("templates").upsert({ id, owner_id: userId, data });
      fail("Could not save the template", error);
    },
    async removeTemplate(id) {
      const { error } = await client.from("templates").delete().eq("id", id);
      fail("Could not delete the template", error);
    },
  };
}
