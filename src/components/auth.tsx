import { EMark } from "./logo";

// Shared pieces of the sign-in pages (log in, sign up, forgot / reset password, verify email):
// one narrow card on the brand background, with the same fields and buttons as checkout.

export const field = "h-12 w-full rounded-sharp border border-line bg-ink px-3.5 text-bone placeholder:text-steel focus:border-dim focus:outline-none";
export const label = "mono text-micro uppercase tracking-[0.12em] text-dim";

export function AuthShell({ eyebrow, title, sub, children, footer }: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="gutter grain relative grid min-h-dvh place-items-center overflow-hidden pb-20 pt-[calc(var(--header-h)+3rem)]">
      <EMark className="pointer-events-none absolute -bottom-32 -left-24 hidden w-130 text-surface md:block" accent="var(--color-rust-dim)" />
      <div className="relative w-full max-w-md">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-3 text-display-sm">{title}</h1>
        {sub && <p className="mt-3 text-dim">{sub}</p>}
        <div className="mt-8 rounded-sharp border border-line bg-surface p-6 sm:p-8">{children}</div>
        {footer && <div className="mt-6 space-y-2 text-center text-small text-dim">{footer}</div>}
      </div>
    </section>
  );
}

export function Field({ label: text, hint, ...input }: { label: string; hint?: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5">
      <span className={label}>{text}</span>
      <input {...input} className={field} />
      {hint && <span className="text-micro text-steel">{hint}</span>}
    </label>
  );
}

export function Submit({ busy, busyText, children }: { busy: boolean; busyText: string; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-steel">
      {busy ? busyText : children}
    </button>
  );
}

// An error or a confirmation above the form. role=alert so screen readers announce it.
export function Notice({ tone, children }: { tone: "error" | "ok"; children: React.ReactNode }) {
  const look = tone === "error" ? "border-rust/50 bg-rust-dim text-bone" : "border-ok/40 bg-ok/15 text-ok-bright";
  return <p role={tone === "error" ? "alert" : "status"} className={`rounded-sharp border px-3.5 py-3 text-small ${look}`}>{children}</p>;
}

export const textLink = "text-bone underline decoration-rust underline-offset-4 transition-colors hover:text-rust-text";

// POST JSON to a Netlify function; never throws, so callers show one message on failure.
export async function postJson(fn: string, body: unknown): Promise<{ ok: boolean; data: { error?: string; message?: string; ok?: boolean } }> {
  try {
    const res = await fetch(`/.netlify/functions/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Something went wrong. Try again." } };
  }
}
