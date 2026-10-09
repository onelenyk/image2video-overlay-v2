import { create } from "zustand";
import { localStore } from "./db";
import { remoteStore, supabase } from "./remote";
import { LOCAL_USER, newId, type Storage, type User } from "./storage";
import { t } from "../i18n";

// Who is using the app, and therefore where their work is kept: a guest's
// projects stay in this browser, a signed-in user's are in their account.

const GUEST: User = { id: LOCAL_USER, guest: true };
const ADOPT_DISMISSED = "plan-highlighter:adopt-dismissed";
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface Session {
  /** False until the saved sign-in (if any) has been checked. */
  ready: boolean;
  /** Whether this build can sign people in at all. */
  available: boolean;
  user: User & { email?: string };
  /** Projects made as a guest on this device that a signed-in user has not yet moved or declined. */
  localProjects: number;
  /** Emails a sign-in link. Resolves to an error message, or null when the email is on its way. */
  sendLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Moves the guest projects and templates on this device into the account. Returns how many projects moved. */
  adoptLocal: () => Promise<number>;
  dismissAdopt: () => void;
}

export const useSession = create<Session>((set, get) => ({
  ready: !supabase,
  available: !!supabase,
  user: GUEST,
  localProjects: 0,

  sendLink: async (email) => {
    if (!supabase) return t("Accounts are not set up in this build.");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    return error ? error.message : null;
  },

  signOut: async () => {
    await supabase?.auth.signOut();
  },

  adoptLocal: async () => {
    const { user } = get();
    if (user.guest || !supabase) return 0;
    const remote = remoteStore(supabase, user.id);
    let moved = 0;
    for (const meta of await localStore.listProjects()) {
      const record = await localStore.getProject(meta.id);
      if (!record) continue;
      // Ids from before UUIDs get a new one; the account only takes UUIDs
      const id = isUuid(record.id) ? record.id : newId();
      for (const kind of ["image", "audio"] as const) {
        const file = await localStore.getFile(meta.id, kind);
        if (file) await remote.putFile(id, kind, file);
      }
      await remote.putProject({ ...record, id, ownerId: user.id });
      await localStore.removeProject(meta.id); // only after the copy in the account is complete
      moved++;
    }
    for (const raw of await localStore.listTemplates()) {
      const template = raw as { id?: unknown };
      const old = typeof template.id === "string" ? template.id : null;
      const id = old && isUuid(old) ? old : newId();
      await remote.putTemplate(id, { ...template, id });
      if (old) await localStore.removeTemplate(old);
    }
    set({ localProjects: 0 });
    return moved;
  },

  dismissAdopt: () => {
    try { localStorage.setItem(ADOPT_DISMISSED, get().user.id); } catch { /* storage unavailable */ }
    set({ localProjects: 0 });
  },
}));

async function countLocal(userId: string) {
  let dismissed: string | null = null;
  try { dismissed = localStorage.getItem(ADOPT_DISMISSED); } catch { /* storage unavailable */ }
  return dismissed === userId ? 0 : (await localStore.listProjects()).length;
}

if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const account = session?.user;
    const user = account ? { id: account.id, guest: false, email: account.email } : GUEST;
    if (useSession.getState().ready && useSession.getState().user.id === user.id) return; // token refresh, same person
    set(user);
  });
}
function set(user: Session["user"]) {
  useSession.setState({ ready: true, user, localProjects: 0 });
  if (!user.guest) void countLocal(user.id).then((localProjects) => { if (useSession.getState().user.id === user.id) useSession.setState({ localProjects }); });
}

export const currentUser = (): User => useSession.getState().user;

// ---------- the storage in use ----------
let remote: { userId: string; store: Storage } | null = null;
function backend(): Storage {
  const { user } = useSession.getState();
  if (user.guest || !supabase) return localStore;
  if (remote?.userId !== user.id) remote = { userId: user.id, store: remoteStore(supabase, user.id) };
  return remote.store;
}
/** Everything is read and written here: this browser for a guest, the account once signed in. */
export const storage: Storage = {
  listProjects: () => backend().listProjects(),
  getProject: (id) => backend().getProject(id),
  putProject: (record) => backend().putProject(record),
  removeProject: (id) => backend().removeProject(id),
  getFile: (projectId, kind) => backend().getFile(projectId, kind),
  putFile: (projectId, kind, file) => backend().putFile(projectId, kind, file),
  removeFile: (projectId, kind) => backend().removeFile(projectId, kind),
  listTemplates: () => backend().listTemplates(),
  putTemplate: (id, data) => backend().putTemplate(id, data),
  removeTemplate: (id) => backend().removeTemplate(id),
};

// Handles for tests and the console, development builds only
if (import.meta.env.DEV) Object.assign(window, { __session: useSession, __supabase: supabase });
