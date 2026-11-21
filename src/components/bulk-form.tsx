"use client";

import { useState } from "react";
import Link from "next/link";
import { track, type Category } from "@/lib/catalog-shared";
import { legacy } from "@/lib/links";
import { field, label, Notice, textLink } from "./auth";

// Bulk / team enquiry (netlify/functions/bulk-enquiry.js checks everything again and emails
// the store). Same fields and rules as before; "website" is a honeypot that people never see.
const TYPES = [["gym", "Gym / studio"], ["coach", "Coach / trainer"], ["team", "Sports team / club"], ["corporate", "Corporate / event"], ["other", "Other"]];
const QUANTITIES = ["10–25", "26–50", "51–100", "100+"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function BulkForm({ categories }: { categories: Category[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) || "").trim();
    const payload = {
      name: v("name"), org: v("org"), email: v("email"), phone: v("phone").replace(/\D/g, ""),
      type: v("type"), quantity: v("quantity"), city: v("city"), message: v("message"),
      branding: f.get("branding") === "on", website: v("website"), categories: f.getAll("categories").map(String),
    };
    const missing = !payload.name ? "Enter your name"
      : !EMAIL.test(payload.email) ? "Enter a valid email"
      : !/^[6-9]\d{9}$/.test(payload.phone) ? "Enter a valid 10-digit mobile number"
      : !payload.type ? "Pick who the order is for"
      : !payload.quantity ? "Pick a rough quantity"
      : !payload.categories.length ? "Pick at least one product type" : "";
    if (missing) return setErr(missing);
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/bulk-enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send your enquiry");
      setDone(true);
      track("generate_lead", { lead_source: "bulk", quantity: payload.quantity });
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Could not send your enquiry");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-sharp border border-line bg-surface p-8" role="status">
        <p className="eyebrow">Enquiry sent</p>
        <h2 className="display mt-3 text-display-sm">We&apos;re on it.</h2>
        <p className="mt-4 text-dim">We&apos;ll reply within 1 working day with pricing and sizing. Check your inbox (and spam) for a reply from support@egosynk.com.</p>
        <Link href="/shop" className="btn btn-ghost mt-8">Browse the gear →</Link>
      </div>
    );
  }

  const select = `${field} appearance-none`;
  return (
    <form onSubmit={submit} noValidate className="relative grid gap-5 rounded-sharp border border-line bg-surface p-5 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-1.5"><span className={label}>Your name</span><input name="name" autoComplete="name" required maxLength={100} className={field} /></label>
        <label className="grid gap-1.5"><span className={label}>Gym / team / company</span><input name="org" autoComplete="organization" maxLength={120} className={field} /></label>
        <label className="grid gap-1.5"><span className={label}>Email</span><input name="email" type="email" autoComplete="email" required maxLength={200} className={field} /></label>
        <label className="grid gap-1.5"><span className={label}>Mobile</span><input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required maxLength={10} placeholder="10 digits" className={field} /></label>
        <label className="grid gap-1.5"><span className={label}>Who is it for?</span>
          <select name="type" required defaultValue="" className={select}><option value="" disabled>Choose…</option>{TYPES.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <label className="grid gap-1.5"><span className={label}>Rough quantity (pieces)</span>
          <select name="quantity" required defaultValue="" className={select}><option value="" disabled>Choose…</option>{QUANTITIES.map((q) => <option key={q}>{q}</option>)}</select></label>
      </div>

      <fieldset>
        <legend className={`${label} mb-2`}>What are you after?</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className="cursor-pointer">
              <input type="checkbox" name="categories" value={c.id} className="peer sr-only" />
              <span className="chip border border-line px-3.5 py-2 text-dim transition-colors peer-checked:border-bone peer-checked:bg-bone peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-rust-bright pointer-coarse:py-2.5">{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1.5"><span className={label}>City</span><input name="city" autoComplete="address-level2" maxLength={80} className={field} /></label>
      <label className="flex items-center gap-3 text-small text-dim">
        <input type="checkbox" name="branding" className="size-4 accent-rust" /> I&apos;d like our logo on the gear
      </label>
      <label className="grid gap-1.5"><span className={label}>Anything else? (sizes, colours, deadline)</span>
        <textarea name="message" rows={4} maxLength={1000} className={`${field} h-auto py-3`} /></label>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      {err && <Notice tone="error">{err}</Notice>}
      <button type="submit" disabled={busy} className="btn btn-primary w-full sm:w-auto sm:justify-self-start disabled:bg-surface-3 disabled:text-steel">{busy ? "Sending…" : "Send enquiry →"}</button>
      <p className="text-micro text-steel">We use these details only to reply to this enquiry. See our <Link href={legacy.privacy} className={textLink}>privacy policy</Link>. Prefer email? Write to <a href="mailto:support@egosynk.com" className={textLink}>support@egosynk.com</a>.</p>
    </form>
  );
}
