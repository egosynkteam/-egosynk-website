"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { field, label, Notice, textLink } from "./auth";
import { legacy } from "@/lib/links";

type Item = { id: number; name: string; cat?: string; size?: string; qty: number; price: number };
type Exchange = { status: string; reason: string; note?: string; items: { name: string; size?: string; newSize?: string }[] };
type Order = {
  orderId: string; items: Item[]; amount: number; paidAt: string; invoiceNumber: string | null;
  fulfilment: { status: string; courier?: string; tracking?: string; trackUrl?: string | null };
  exchange: Exchange | null;
  exchangeOptions: { reasons: { id: string; label: string; until: string }[]; sizesByItem: string[][] } | null;
};
type User = { name: string; email: string; phone?: string; emailVerified?: boolean };
type View = { state: "loading" } | { state: "error" } | { state: "ok"; user: User; orders: Order[] };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
// Tracking links come from the courier; only ever open a web address.
const safeUrl = (u?: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

const EX_STATUS: Record<string, string> = { requested: "Request received", approved: "Approved", rejected: "Not approved", completed: "Completed" };
// Size exchange on these only with the hygiene seal unbroken (netlify/lib/exchanges.js).
const HYGIENE_CATS = ["innerwear", "socks"];
const sectionTitle = "mono mb-4 text-micro uppercase tracking-[0.14em] text-rust-text";

// null = not signed in.
async function fetchAccount(): Promise<View | null> {
  try {
    const me = await fetch("/.netlify/functions/me");
    if (me.status === 401) return null;
    if (!me.ok) return { state: "error" };
    const user = (await me.json()) as User;
    const res = await fetch("/.netlify/functions/my-orders");
    const { orders } = res.ok ? ((await res.json()) as { orders: Order[] }) : { orders: [] };
    return { state: "ok", user, orders };
  } catch {
    return { state: "error" };
  }
}

export function Account() {
  const router = useRouter();
  const [view, setView] = useState<View>({ state: "loading" });

  const load = useCallback(
    () => fetchAccount().then((v) => (v ? setView(v) : router.replace(`${legacy.login}?redirect=${encodeURIComponent(legacy.account)}`))),
    [router],
  );
  useEffect(() => { load(); }, [load]);

  async function logout() {
    await fetch("/.netlify/functions/logout", { method: "POST" }).catch(() => null);
    // A full load, so the header and bag forget the signed-in customer.
    window.location.href = "/";
  }

  return (
    <section className="gutter grain relative overflow-hidden pb-24 pt-[calc(var(--header-h)+3.5rem)] md:pt-[calc(var(--header-h)+5rem)]">
      <div className="relative page max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Your account</p>
            <h1 className="display mt-3 text-display-lg">
              {view.state === "ok" ? <>Hey, <span className="text-rust">{view.user.name.split(" ")[0]}.</span></> : <>My <span className="text-rust">account</span></>}
            </h1>
          </div>
          {view.state === "ok" && <button type="button" onClick={logout} className="btn btn-ghost">Log out</button>}
        </div>

        <div className="mt-10">
          {view.state === "loading" && <p className="text-dim" role="status">Loading your account…</p>}
          {view.state === "error" && <Notice tone="error">Could not load your account. Try refreshing.</Notice>}
          {view.state === "ok" && <Loaded user={view.user} orders={view.orders} reload={load} />}
        </div>
      </div>
    </section>
  );
}

function Loaded({ user, orders, reload }: { user: User; orders: Order[]; reload: () => Promise<void> }) {
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
      <div className="order-2 md:order-1">
        <h2 className={sectionTitle}>Order history</h2>
        {orders.length === 0 ? (
          <div className="rounded-sharp border border-line bg-surface p-8 text-center text-dim">
            No orders yet. <Link href="/#gear" className={textLink}>Start shopping</Link>.
          </div>
        ) : (
          <ol className="grid gap-4">{orders.map((o) => <OrderCard key={o.orderId} order={o} reload={reload} />)}</ol>
        )}
      </div>
      <aside className="order-1 grid gap-4 md:sticky md:top-[calc(var(--header-h)+2rem)] md:order-2">
        {!user.emailVerified && <VerifyBanner />}
        <div className="rounded-sharp border border-line bg-surface p-6">
          <h2 className={sectionTitle}>Profile</h2>
          <dl className="grid gap-3 text-small">
            {([["Name", user.name], ["Email", user.email], ["Phone", user.phone || "—"]] as const).map(([k, v]) => (
              <div key={k}>
                <dt className="mono text-micro uppercase tracking-[0.12em] text-steel">{k}</dt>
                <dd className="mt-0.5 break-all text-bone">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="text-small text-dim">Need help with an order? See <a href={legacy.returns} className={textLink}>returns &amp; exchanges</a> or <a href={legacy.contact} className={textLink}>contact us</a>.</p>
      </aside>
    </div>
  );
}

function VerifyBanner() {
  const [sent, setSent] = useState<"idle" | "sending" | "sent">("idle");
  async function resend() {
    setSent("sending");
    const res = await fetch("/.netlify/functions/resend-verification", { method: "POST" }).catch(() => null);
    setSent(res?.ok ? "sent" : "idle");
  }
  return (
    <div className="rounded-sharp border border-rust/50 bg-rust-dim p-5 text-small">
      <p className="text-bone">Your email isn&apos;t verified yet.</p>
      <button type="button" onClick={resend} disabled={sent !== "idle"} className="mono mt-3 text-micro font-bold uppercase tracking-widest text-rust-text disabled:text-steel">
        {sent === "sent" ? "Sent. Check your inbox" : sent === "sending" ? "Sending…" : "Resend the email →"}
      </button>
    </div>
  );
}

function OrderCard({ order: o, reload }: { order: Order; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const f = o.fulfilment;
  const track = safeUrl(f.trackUrl);
  return (
    <li className="rounded-sharp border border-line bg-surface p-5 sm:p-6">
      <div className="mono flex flex-wrap justify-between gap-2 text-micro text-steel">
        <span>{day(o.paidAt)}</span>
        <span className="break-all">{o.orderId}</span>
      </div>
      <ul className="mt-4 grid gap-2">
        {o.items.map((i, n) => (
          <li key={n} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-small">
            <span className="text-bone">{i.name}{i.size ? ` (${i.size})` : ""} <span className="text-steel">× {i.qty}</span></span>
            <a href={`/p/${encodeURIComponent(i.id)}?review=${encodeURIComponent(o.orderId)}#reviews`} className={`text-micro ${textLink}`}>Write a review</a>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="mono text-micro uppercase tracking-[0.1em] text-dim">
          <span className="chip bg-surface-3 text-bone">{f.status}</span>
          {f.tracking && <> <span className="normal-case tracking-normal">{f.courier ? `${f.courier} ` : ""}{f.tracking}</span></>}
          {track && <> · <a href={track} target="_blank" rel="noopener noreferrer" className={textLink}>Track</a></>}
        </p>
        <div className="flex items-baseline gap-4">
          {o.invoiceNumber && <a href={`/invoice.html?id=${encodeURIComponent(o.orderId)}`} className={`mono text-micro ${textLink}`}>Invoice {o.invoiceNumber}</a>}
          <p className="mono text-lead font-bold text-bone">{inr(o.amount / 100)}</p>
        </div>
      </div>
      {o.exchange && (
        <div className="mt-4 rounded-sharp border border-line bg-ink p-4 text-small text-dim">
          <p><b className="mono text-micro uppercase tracking-[0.1em] text-bone">{EX_STATUS[o.exchange.status] || o.exchange.status}</b> · {o.exchange.reason}</p>
          {o.exchange.items.map((i, n) => <p key={n}>{i.name} ({i.size || "—"}){i.newSize ? ` → ${i.newSize}` : ""}</p>)}
          {o.exchange.note && <p className="mt-1 text-bone">{o.exchange.note}</p>}
        </div>
      )}
      {o.exchangeOptions && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="btn btn-ghost mt-4 min-h-10 px-4 text-micro">
            {open ? "Close" : "Exchange or report a problem"}
          </button>
          {open && <ExchangeForm order={o} done={reload} />}
        </>
      )}
    </li>
  );
}

// The server decides which reasons are still open (7 days for size, 48 hours for damaged or
// wrong item) and checks everything again on submit; this only catches obvious mistakes early.
function ExchangeForm({ order: o, done }: { order: Order; done: () => Promise<void> }) {
  const opts = o.exchangeOptions!;
  const [reason, setReason] = useState(opts.reasons[0]?.id || "size");
  const [picked, setPicked] = useState<boolean[]>(o.items.map(() => o.items.length === 1));
  const [sizes, setSizes] = useState<string[]>(o.items.map(() => ""));
  const [sealed, setSealed] = useState<boolean[]>(o.items.map(() => false));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isSize = reason === "size";
  const set = <T,>(arr: T[], n: number, v: T) => arr.map((x, i) => (i === n ? v : x));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const items = o.items.flatMap((i, n) => (picked[n] ? [{ index: n, newSize: sizes[n], sealed: HYGIENE_CATS.includes(i.cat || "") ? sealed[n] : undefined }] : []));
    if (!items.length) return setErr("Tick the item(s) this is about.");
    if (isSize && items.some((i) => !i.newSize)) return setErr("Pick the new size for each ticked item.");
    if (isSize && items.some((i) => i.sealed === false)) return setErr("Innerwear and socks can only be exchanged with the hygiene seal unbroken.");
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/request-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: o.orderId, reason, items, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send the request");
      await done();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send the request");
      setBusy(false);
    }
  }

  const check = "size-4 shrink-0 accent-rust";
  return (
    <form onSubmit={submit} className="mt-4 grid gap-5 rounded-sharp border border-line bg-ink p-4 sm:p-5">
      <label className="grid gap-1.5">
        <span className={label}>Reason</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
          {opts.reasons.map((r) => <option key={r.id} value={r.id}>{r.label} (until {when(r.until)})</option>)}
        </select>
      </label>
      <fieldset className="grid gap-3">
        <legend className={`${label} mb-1.5`}>Items</legend>
        {o.items.map((i, n) => {
          const others = (opts.sizesByItem[n] || []).filter((s) => s !== i.size);
          const hygiene = HYGIENE_CATS.includes(i.cat || "");
          return (
            <div key={n} className="grid gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex flex-1 items-center gap-3 text-small text-dim">
                  <input type="checkbox" checked={picked[n]} onChange={(e) => setPicked(set(picked, n, e.target.checked))} className={check} />
                  {i.name}{i.size ? ` (${i.size})` : ""} × {i.qty}
                </label>
                {isSize && (
                  <select value={sizes[n]} onChange={(e) => setSizes(set(sizes, n, e.target.value))} aria-label={`New size for ${i.name}`} className={`${field} h-10 w-auto min-w-28`}>
                    <option value="">New size</option>
                    {others.map((s) => <option key={s}>{s}</option>)}
                  </select>
                )}
              </div>
              {isSize && hygiene && (
                <label className="flex items-start gap-3 pl-7 text-micro text-dim">
                  <input type="checkbox" checked={sealed[n]} onChange={(e) => setSealed(set(sealed, n, e.target.checked))} className={`${check} mt-0.5`} />
                  The hygiene seal on {i.name} is unbroken (required for innerwear and socks)
                </label>
              )}
            </div>
          );
        })}
      </fieldset>
      <label className="grid gap-1.5">
        <span className={label}>Anything we should know? (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={`${field} h-auto py-3`} />
      </label>
      <p className="text-micro text-steel">
        {isSize
          ? "Items must be unused with tags on. Exchanges depend on stock."
          : "After you submit, reply to our email with photos of the item and packaging. We'll send a replacement or a full refund."}
      </p>
      {err && <Notice tone="error">{err}</Notice>}
      <button type="submit" disabled={busy} className="btn btn-primary justify-self-start disabled:bg-surface-3 disabled:text-steel">{busy ? "Sending…" : "Submit request"}</button>
    </form>
  );
}
