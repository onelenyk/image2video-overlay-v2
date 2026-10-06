import { useEditor } from "../editor/store";
import { useSession } from "../editor/session";
import { Button, IconButton } from "./kit";

/** Who is signed in, where their work is kept, and the way out. */
export function Account() {
  const { showScreen, projects, notify } = useEditor();
  const { user, signOut } = useSession();
  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  const row = "flex items-center justify-between gap-3 min-h-12 px-4 border-b border-line last:border-b-0 text-label";

  const leave = async () => {
    await signOut();
    showScreen("home");
    notify("Signed out. Projects in your account are safe; this device now shows its own.");
  };

  return (
    <div className="min-h-dvh px-4 sm:px-8 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto space-y-5">
        <header className="flex items-center gap-1 h-12 -ml-2">
          <IconButton icon="back" label="Back to projects" onClick={() => showScreen("home")} />
          <h1 className="text-heading font-bold">Account</h1>
        </header>
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-12 h-12 grid place-items-center rounded-full bg-chip-active text-heading font-bold">{initial}</span>
          <div className="min-w-0">
            <p className="truncate text-label font-semibold">{user.email}</p>
            <p className="text-caption text-fg-subtle">Signed in</p>
          </div>
        </div>
        <div className="rounded-card bg-raised">
          <div className={row}><span>Projects</span><span className="text-fg-muted">{projects.length}</span></div>
          <div className={row}><span>Kept in</span><span className="text-success">Your account</span></div>
        </div>
        <Button onClick={leave} className="w-full">Sign out</Button>
        <p className="text-caption text-fg-subtle">To delete your account and everything in it, write to us from this email address.</p>
      </div>
    </div>
  );
}
