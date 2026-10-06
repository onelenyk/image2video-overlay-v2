import { useEditor } from "./editor/store";
import { Editor } from "./ui/Editor";
import { Home } from "./ui/Home";
import { Welcome } from "./ui/Welcome";

function App() {
  const screen = useEditor((s) => s.screen);
  const toast = useEditor((s) => s.toast);
  if (screen === "editor") return <Editor />;
  return (
    <>
      {screen === "welcome" ? <Welcome /> : <Home />}
      {toast && (
        <div role="status" className={`fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-control text-label font-semibold max-w-[calc(100%-2rem)] ${toast.kind === "error" ? "bg-danger text-white" : "bg-raised text-fg"} shadow-xl`}>
          {toast.text}
        </div>
      )}
    </>
  );
}

export default App;
