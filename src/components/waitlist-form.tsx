"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { WAITLIST_ENDPOINT, legacy } from "@/lib/links";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; position?: number } | { kind: "error"; message: string };

// "Join the drop" for a product that isn't on sale yet. Posts to the drop-waitlist Netlify
// function, which stores one record per email per product.
export function WaitlistForm({ product, label = "Join the drop" }: { product: string; label?: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState({ kind: "sending" });
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, email: f.get("email"), phone: f.get("phone") || "", consent: f.get("consent") === "on", website: f.get("website") || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add you. Try again in a minute.");
      setState({ kind: "done", position: data.position });
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Could not add you. Try again in a minute." });
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state.kind === "done" ? (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2px] border border-rust bg-rust-dim/40 p-7" role="status">
          <p className="display text-3xl">You&apos;re in.</p>
          <p className="mt-3 text-dim">
            We&apos;ll email you before the drop goes live, with early access before anyone else.
            {state.position ? ` You're number ${state.position.toLocaleString("en-IN")} on the list.` : ""}
          </p>
        </motion.div>
      ) : (
        <motion.form key="form" onSubmit={submit} exit={{ opacity: 0 }} className="grid gap-3" noValidate={false}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">Email</span>
              <input id={`wl-email-${product}`} name="email" type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com"
                className="h-[52px] rounded-[2px] border border-line bg-ink px-4 text-bone placeholder:text-steel focus:border-dim focus:outline-none" />
            </label>
            <label className="grid gap-1.5">
              <span className="mono text-[11px] uppercase tracking-[0.12em] text-dim">WhatsApp number <span className="text-steel">(optional)</span></span>
              <input id={`wl-phone-${product}`} name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98xxx xxxxx" pattern="[0-9+\s-]{10,16}"
                className="h-[52px] rounded-[2px] border border-line bg-ink px-4 text-bone placeholder:text-steel focus:border-dim focus:outline-none" />
            </label>
          </div>
          {/* Hidden from people; bots fill it in, and the function drops those sign-ups. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />
          <label className="flex items-start gap-3 text-sm text-dim">
            <input id={`wl-consent-${product}`} name="consent" type="checkbox" className="mt-1 size-4 accent-[#c41e3a]" />
            <span>Also send me other launches and offers from EGOSYNK. Without this, we only email you about this drop. Unsubscribe any time. See our <a href={legacy.privacy} className="underline decoration-rust underline-offset-4">privacy policy</a>.</span>
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <button type="submit" disabled={state.kind === "sending"} className="btn btn-primary min-w-[200px] disabled:opacity-60">
              {state.kind === "sending" ? "Adding you…" : `${label} →`}
            </button>
            {state.kind === "error" && <p role="alert" className="text-sm text-rust-bright">{state.message}</p>}
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
