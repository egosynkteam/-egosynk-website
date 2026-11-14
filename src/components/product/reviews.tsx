"use client";

import { useEffect, useRef, useState } from "react";
import { Stars } from "@/components/stars";
import type { Review } from "@/lib/product-shared";

const fieldCls = "w-full rounded-sharp border border-line bg-ink px-3 placeholder:text-steel focus:border-dim focus:outline-none";
const labelCls = "mono text-micro uppercase tracking-[0.12em] text-dim";

// Approved reviews, and the verified-buyer form (order ID + email). My Orders links here with
// ?review=<order id>, which opens the form with the order filled in.
export function Reviews({ productId, reviews, rating }: { productId: number; reviews: Review[]; rating: { avg: number; count: number } | null }) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const n = reviews.length;
  const avg = rating?.avg ?? (n ? reviews.reduce((a, r) => a + r.rating, 0) / n : 0);
  const dist = [5, 4, 3, 2, 1].map((k) => [k, reviews.filter((r) => r.rating === k).length] as const);

  useEffect(() => {
    const o = new URLSearchParams(location.search).get("review");
    if (!o) return;
    const t = setTimeout(() => { setOrder(o); setOpen(true); }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (open) formRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [open]);

  return (
    <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-[calc(var(--header-h)+1rem)] border-t border-line py-16 md:py-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <h2 id="reviews-h" className="display text-display-sm">Reviews</h2>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-ghost">{open ? "Close" : "Write a review"}</button>
      </div>

      {n > 0 ? (
        <div className="grid gap-6 border-y border-line py-6 sm:grid-cols-[auto_1fr] sm:gap-12">
          <div>
            <p className="display text-stat leading-none">{avg.toFixed(1)}</p>
            <div className="mt-2"><Stars avg={avg} count={n} /></div>
            <p className="mt-1 text-small text-dim">{n} verified review{n === 1 ? "" : "s"}</p>
          </div>
          <ul className="w-full max-w-md space-y-1.5" aria-label="Ratings breakdown">
            {dist.map(([k, c]) => (
              <li key={k} className="mono flex items-center gap-3 text-small">
                <span className="w-6 text-dim">{k}★</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full bg-rust-text" style={{ width: `${(c / n) * 100}%` }} /></span>
                <span className="w-6 text-right text-dim tabular-nums">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="border-y border-line py-6 text-dim">No reviews yet. Bought this? Be the first to review it.</p>
      )}

      {open && <ReviewForm ref={formRef} productId={productId} order={order} />}

      <ul className="divide-y divide-line">
        {reviews.map((r, i) => (
          <li key={`${r.createdAt}-${i}`} className="py-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3"><Stars avg={r.rating} count={1} />{r.title && <strong>{r.title}</strong>}</div>
              <time dateTime={r.createdAt} className="mono text-micro text-steel">{new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</time>
            </div>
            <p className="mt-3 max-w-prose leading-relaxed">{r.body}</p>
            <p className="mono mt-3 text-micro uppercase tracking-[0.08em] text-steel">
              {r.name} · <span className="text-ok-bright">✓ Verified buyer</span>{r.size ? ` · Size ${r.size}` : ""}
            </p>
            {r.reply && <p className="mt-4 border-l-2 border-rust pl-4 text-small text-dim"><b className="text-bone">EGOSYNK:</b> {r.reply}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewForm({ ref, productId, order }: { ref: React.Ref<HTMLFormElement>; productId: number; order: string }) {
  const [stars, setStars] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stars) { setMsg({ ok: false, text: "Pick a star rating." }); return; }
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/.netlify/functions/submit-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating: stars, title: f.get("title"), body: f.get("body"), orderId: String(f.get("orderId") || "").trim(), email: String(f.get("email") || "").trim(), name: f.get("name") }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Could not submit");
      form.reset(); setStars(0);
      setMsg({ ok: true, text: out.edited ? "Thanks. Your updated review will appear after a quick check." : "Thanks! Your review will appear after a quick check." });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not submit" }); }
    setBusy(false);
  }

  return (
    <form ref={ref} onSubmit={submit} className="scroll-mt-[calc(var(--header-h)+1rem)] my-8 grid gap-4 rounded-sharp border border-line bg-surface p-5 md:p-8">
      <fieldset>
        <legend className={labelCls}>Your rating</legend>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((k) => (
            <button key={k} type="button" role="radio" aria-checked={stars === k} aria-label={`${k} star${k > 1 ? "s" : ""}`} onClick={() => setStars(k)}
              className={`grid size-10 place-items-center text-2xl transition-colors pointer-coarse:size-11 ${k <= stars ? "text-rust-text" : "text-line hover:text-dim"}`}>★</button>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5"><span className={labelCls}>Headline (optional)</span><input name="title" maxLength={80} placeholder="Holds up under a heavy session" className={`${fieldCls} h-11`} /></label>
      <label className="grid gap-1.5"><span className={labelCls}>Your review</span><textarea name="body" rows={4} maxLength={1500} required placeholder="Fit, feel, how it held up…" className={`${fieldCls} py-2.5`} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5"><span className={labelCls}>Order ID</span><input name="orderId" required defaultValue={order} placeholder="order_…" autoComplete="off" className={`${fieldCls} h-11`} /></label>
        <label className="grid min-w-0 gap-1.5"><span className={labelCls}>Email used for the order</span><input name="email" type="email" required autoComplete="email" className={`${fieldCls} h-11`} /></label>
      </div>
      <label className="grid gap-1.5"><span className={labelCls}>Name to show (optional)</span><input name="name" maxLength={40} placeholder="Shown as first name + initial" className={`${fieldCls} h-11`} /></label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-60">{busy ? "Sending…" : "Submit review"}</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-small ${msg.ok ? "text-ok-bright" : "text-rust-text"}`}>{msg.text}</p>}
      </div>
      <p className="text-small text-steel">Only verified buyers can review. Your order ID is in your order confirmation and in My Account. Reviews appear after a quick check.</p>
    </form>
  );
}
