import { useSession } from "./session";
import { useEditor } from "./store";

// Screens have addresses, so the browser's back button, a reload and (later) a
// link to a project all work:
//   #/            the landing page
//   #/projects    the project list
//   #/p/<id>      a project open in the editor
//   #/sign-in     signing in
//   #/account     the signed-in user's account
// The hash form needs nothing from the server, which matters on static hosting.

const pathOf = (screen: string, projectId: string | null) =>
  screen === "editor" && projectId ? `#/p/${projectId}` : screen === "welcome" ? "#/" : screen === "signin" ? "#/sign-in" : screen === "account" ? "#/account" : "#/projects";

const PLAIN: Record<string, "welcome" | "home" | "signin" | "account"> = { "#/": "welcome", "#/projects": "home", "#/sign-in": "signin", "#/account": "account" };

/** Resolves once the saved sign-in has been checked, so a project address opens from the right storage. */
const sessionReady = () => new Promise<void>((resolve) => {
  if (useSession.getState().ready) { resolve(); return; }
  const stop = useSession.subscribe((session) => { if (session.ready) { stop(); resolve(); } });
});

/** Keeps the address bar and the app's current screen in step. Call once. */
export function startRouter() {
  const store = useEditor;
  let busy = false; // a navigation started from the address is still loading

  const follow = async () => {
    const hash = window.location.hash;
    const state = store.getState();
    if (hash === pathOf(state.screen, state.projectId)) return;
    busy = true;
    try {
      const project = /^#\/p\/([\w-]{1,80})$/.exec(hash)?.[1];
      if (project) {
        if (state.screen === "editor") await state.closeProject();
        await store.getState().openProject(project);
      } else if (hash in PLAIN || hash === "") {
        if (state.screen === "editor") await state.closeProject();
        // No address at all keeps the screen the app chose to start on. The account page needs someone signed in.
        const screen = PLAIN[hash];
        if (screen) store.getState().showScreen(screen === "account" && useSession.getState().user.guest ? "signin" : screen);
      }
    } finally {
      busy = false;
      show();
    }
  };

  /** Put the current screen into the address bar (a project that failed to open ends up on the list). */
  const show = () => {
    if (busy) return;
    const state = store.getState();
    const path = pathOf(state.screen, state.projectId);
    if (window.location.hash === path) return;
    // The very first address replaces the empty one, so "back" does not land on a blank hash
    if (window.location.hash === "") window.history.replaceState(null, "", path);
    else window.location.hash = path;
  };

  window.addEventListener("hashchange", follow);
  const unsubscribe = store.subscribe((state, previous) => {
    if (state.screen !== previous.screen || state.projectId !== previous.projectId) show();
  });
  void sessionReady().then(follow);
  return () => { window.removeEventListener("hashchange", follow); unsubscribe(); };
}
