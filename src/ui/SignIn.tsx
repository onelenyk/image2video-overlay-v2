import { useState } from "react";
import { useEditor } from "../editor/store";
import { useSession } from "../editor/session";
import { Logo } from "./Logo";
import { Button, Icon, IconButton } from "./kit";

/** One screen for signing in and signing up: an email with a link, no password. */
export function SignIn() {
  const showScreen = useEditor((s) => s.showScreen);
  const { sendLink, available } = useSession();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setError(null);
    setState("sending");
    const problem = await sendLink(email);
    setError(problem);
    setState(problem ? "idle" : "sent");
  };

  return (
    <div className="min-h-dvh flex flex-col px-4 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between max-w-md w-full mx-auto">
        <Logo size="sm" />
        <IconButton icon="close" label="Back to projects" onClick={() => showScreen("home")} className="-mr-2" />
      </header>
      <main className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto py-8 space-y-4">
        {state === "sent" ? (
          <>
            <span className="w-12 h-12 grid place-items-center rounded-full bg-chip-active text-success"><Icon name="check" /></span>
            <h1 className="text-title font-bold">Check your email</h1>
            <p className="text-body text-fg-muted">We sent a sign-in link to <span className="text-fg font-semibold break-all">{email.trim()}</span>. Open it on this device and you are in. It can take a minute to arrive.</p>
            <Button onClick={() => setState("idle")} className="w-full">Use another email</Button>
          </>
        ) : (
          <>
            <h1 className="text-display font-bold text-balance">Sign in to keep your projects <span className="text-brand">everywhere.</span></h1>
            <p className="text-body text-fg-muted">Phone, laptop, another browser. No password: we email you a link.</p>
            <form onSubmit={submit} className="space-y-2 pt-2">
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!available}
                className="w-full h-12 px-3 rounded-control bg-raised border border-line text-[16px] text-fg placeholder:text-fg-subtle"
              />
              <button type="submit" disabled={!available || state === "sending"} className="w-full h-12 rounded-control bg-brand hover:bg-brand-hover text-on-brand text-[15px] font-bold disabled:opacity-50">
                {state === "sending" ? "Sending…" : "Email me a sign-in link"}
              </button>
              {error && <p role="alert" className="text-label text-danger">{error}</p>}
              {!available && <p className="text-label text-fg-muted">Accounts are not set up in this build.</p>}
            </form>
            <button type="button" onClick={() => showScreen("home")} className="w-full h-11 rounded-control text-label font-semibold text-fg-muted hover:bg-chip-hover">Continue without an account</button>
          </>
        )}
      </main>
    </div>
  );
}
