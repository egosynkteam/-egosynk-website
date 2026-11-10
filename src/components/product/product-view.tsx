"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useBag } from "@/components/bag";
import { Stars } from "@/components/stars";
import { mediaUrl } from "@/lib/bag";
import { inr, track } from "@/lib/catalog-shared";
import { legacy } from "@/lib/links";
import {
  defaultSize, deliveryWindow, isFreeSize, isHygiene, isPincode, left, maxQty, offerText, percentOff, soldOutSizes, specChips,
  type Offer, type PdpData,
} from "@/lib/product-shared";
import { SizeGuideDialog } from "./size-guide";

// Saved for later: the same localStorage list the old shop page uses, synced to the account.
const SAVED_KEY = "egosynk_saved";
const readSaved = (): number[] => { try { return (JSON.parse(localStorage.getItem(SAVED_KEY) || "[]") as unknown[]).filter(Number.isInteger) as number[]; } catch { return []; } };
const savedSubscribe = (cb: () => void) => { addEventListener("storage", cb); addEventListener("egosynk-saved", cb); return () => { removeEventListener("storage", cb); removeEventListener("egosynk-saved", cb); }; };
const store = { get: (k: string) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } } };

export function ProductView({ data }: { data: PdpData }) {
  const { product: p, category, sizeGuide, settings } = data;
  const { add, say } = useBag();
  const [size, setSize] = useState<string | null>(() => defaultSize(p));
  const [qty, setQty] = useState(1);
  const [hint, setHint] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const sizesRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const soldOut = p.available === false;
  const freeSize = isFreeSize(p);
  const images = p.images || [];

  // A size in the link (?size=M, from emails and the size finder) preselects it; ?review= opens the form.
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("size");
    const t = setTimeout(() => { if (q && p.sizes.includes(q) && left(p, q) > 0) setSize(q); }, 0);
    track("view_item", { currency: "INR", value: p.price, items: [{ item_id: p.id, item_name: p.name, item_category: category?.name, price: p.price }] });
    return () => clearTimeout(t);
  }, [p, category]);

  const pick = (s: string) => {
    setSize(s);
    setQty((q) => Math.max(1, Math.min(q, maxQty(p, s))));
    const n = left(p, s);
    setHint(n <= 5 && n > 0 ? `Only ${n} left in ${s}` : "");
  };

  const addToBag = () => {
    if (soldOut) return;
    if (!size) {
      sizesRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      setHint("Pick a size first");
      return;
    }
    add({ id: p.id, name: p.name, cat: p.cat, price: p.price, size, qty, image: images[0] || null });
  };

  const label = soldOut ? "Sold out" : size ? "Add to bag" : "Select a size";
  const off = percentOff(p);

  return (
    <>
      <nav aria-label="Breadcrumb" className="mono mb-6 text-micro uppercase tracking-[0.12em] text-steel">
        <Link href="/#gear" className="hover:text-bone">Shop</Link>
        {category && <> <span aria-hidden="true">/</span> <span>{category.name}</span></>}
        <span aria-hidden="true"> / </span><span className="text-dim" aria-current="page">{p.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-14">
        <Gallery images={images} name={p.name} badge={soldOut ? "Sold out" : p.tag} />

        <div className="min-w-0">
          <p className="eyebrow">{category?.name}{p.colour ? ` · ${p.colour}` : ""}</p>
          <h1 className="display mt-3 text-display-sm">{p.name}</h1>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="display text-3xl tabular-nums">{inr(p.price)}</span>
            {off > 0 && <><span className="mono text-steel line-through">{inr(p.mrp!)}</span><span className="chip bg-ok/15 text-ok-bright">{off}% off</span></>}
          </p>
          <p className="mt-1 text-small text-steel">Inclusive of all taxes</p>

          {p.rating && (
            <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-small text-dim hover:text-bone">
              <Stars avg={p.rating.avg} count={p.rating.count} />
              <span className="underline underline-offset-4">Read reviews</span>
            </a>
          )}

          {specChips(p).length > 0 && (
            <ul aria-label="Product specs" className="mt-5 flex flex-wrap gap-2">
              {specChips(p).map((c) => <li key={c} className="chip border border-line text-dim">{c}</li>)}
            </ul>
          )}

          <Offers offers={data.offers || []} say={say} />

          {!freeSize && (
            <div ref={sizesRef} className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <p id="size-label" className="mono text-micro font-bold uppercase tracking-[0.14em] text-dim">Select size</p>
                {sizeGuide && <button type="button" onClick={() => setGuideOpen(true)} className="mono text-micro uppercase tracking-[0.12em] text-dim underline decoration-rust underline-offset-4 hover:text-bone pointer-coarse:py-2">Size guide</button>}
              </div>
              <div role="radiogroup" aria-labelledby="size-label" className="flex flex-wrap gap-2">
                {p.sizes.map((s) => {
                  const out = left(p, s) <= 0;
                  const on = size === s;
                  return (
                    <button key={s} type="button" role="radio" aria-checked={on} disabled={out} onClick={() => pick(s)} title={out ? "Sold out" : undefined}
                      className={`mono h-12 min-w-14 rounded-sharp border px-4 text-small font-bold uppercase transition-colors ${out ? "cursor-not-allowed border-line text-steel line-through opacity-50" : on ? "border-bone bg-bone text-ink" : "border-line hover:border-dim"}`}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p aria-live="polite" className="mt-3 min-h-5 text-small text-rust-text">{hint}</p>

          <Notify data={data} />

          <div className="mt-4 flex gap-2">
            <div className="flex items-center rounded-sharp border border-line">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="One fewer" className="grid h-13 w-11 place-items-center text-dim hover:text-bone">−</button>
              <span className="mono w-8 text-center tabular-nums" aria-live="polite" aria-label={`Quantity ${qty}`}>{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty(p, size), q + 1))} aria-label="One more" className="grid h-13 w-11 place-items-center text-dim hover:text-bone">+</button>
            </div>
            <button ref={addRef} type="button" onClick={addToBag} disabled={soldOut} className="btn btn-primary h-13 flex-1 disabled:cursor-not-allowed disabled:opacity-50">{label}</button>
            <SaveButton id={p.id} name={p.name} price={p.price} say={say} />
          </div>

          <DeliveryCheck />

          <ul className="mt-6 space-y-2.5 border-y border-line py-5 text-small text-dim">
            <li className="flex gap-3"><Icon d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
              {settings.freeShippingThreshold ? `Free shipping over ${inr(settings.freeShippingThreshold)} · otherwise ${inr(settings.shippingFee ?? 0)}` : "Ships across India"} · 3–7 days</li>
            <li className="flex gap-3"><Icon d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />{isHygiene(p) ? "7-day size exchange if the hygiene seal is unbroken" : "7-day size exchange"}</li>
            <li className="flex gap-3"><Icon d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />Secure payment via Razorpay · GST invoice included</li>
          </ul>

          {p.description && <p className="mt-6 leading-relaxed text-dim">{p.description}</p>}
          {(p.highlights || []).length > 0 && (
            <ul className="mt-4 space-y-2">{p.highlights!.map((h) => <li key={h} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 h-px w-3 shrink-0 bg-rust" />{h}</li>)}</ul>
          )}

          <div className="mt-6 divide-y divide-line border-y border-line">
            <Accordion title="Shipping">Dispatched in 1–2 business days, delivered in 3–7 business days across India. Tracking appears in your account once shipped. <a href={legacy.shipping} className="underline decoration-rust underline-offset-4">Shipping policy</a></Accordion>
            <Accordion title="Returns & exchanges">
              {isHygiene(p)
                ? "You can exchange it for another size within 7 days of delivery only if the hygiene seal is unbroken. Opened items can't be exchanged, but if it arrives damaged or wrong we'll replace or refund it."
                : "Exchange for another size within 7 days of delivery, unused with tags."} <a href={legacy.returns} className="underline decoration-rust underline-offset-4">Full policy</a>
            </Accordion>
          </div>
        </div>
      </div>

      {sizeGuide && (
        <SizeGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} guide={sizeGuide} product={p}
          onPick={(s) => { pick(s); setGuideOpen(false); track("size_finder", { size: s }); }} />
      )}
      <StickyBuy anchor={addRef} price={p.price} label={label} sizeText={soldOut ? "Sold out" : size ? `Size ${size}` : freeSize ? "" : "Select a size"} disabled={soldOut} onAdd={addToBag} />
    </>
  );
}

function Icon({ d }: { d: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 size-4 shrink-0"><path d={d} /></svg>;
}

function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold pointer-coarse:py-1">
        {title}<span aria-hidden="true" className="display text-xl text-rust transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-3 text-small leading-relaxed text-dim">{children}</p>
    </details>
  );
}

// Swipeable photo strip with thumbnails; scroll-snap keeps it native on touch screens.
function Gallery({ images, name, badge }: { images: string[]; name: string; badge?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return (
    <div className="min-w-0 md:sticky md:top-[calc(var(--header-h)+1.5rem)] md:self-start">
      <div className="relative overflow-hidden rounded-sharp border border-line bg-surface">
        {badge && <span className="chip absolute left-3 top-3 z-10 bg-ink/80 text-bone">{badge}</span>}
        {images.length ? (
          <div ref={track} onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
            className="flex aspect-square snap-x md:aspect-[4/5] snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]" aria-label={`${name} photos`} tabIndex={0}>
            {images.map((k, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo served by the media function
              <img key={k} src={mediaUrl(k)} alt={i ? `${name}, view ${i + 1}` : name} loading={i ? "lazy" : "eager"} fetchPriority={i ? "auto" : "high"} decoding="async"
                className="size-full shrink-0 snap-center object-cover" />
            ))}
          </div>
        ) : (
          <div className="grid aspect-square place-items-center md:aspect-[4/5]"><span className="display text-display-sm text-surface-3">ES</span></div>
        )}
        {images.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden="true">
            {images.map((k, i) => <span key={k} className={`h-1 rounded-full transition-all ${i === index ? "w-5 bg-bone" : "w-1.5 bg-bone/40"}`} />)}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((k, i) => (
            <button key={k} type="button" onClick={() => go(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}
              className={`aspect-square overflow-hidden rounded-sharp border transition-colors ${i === index ? "border-bone" : "border-line hover:border-dim"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded photo served by the media function */}
              <img src={mediaUrl(k)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Coupons marked "show on product" in the admin. Copying one also leaves it for the bag.
function Offers({ offers, say }: { offers: Offer[]; say: (t: string) => void }) {
  if (!offers.length) return null;
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); } catch { /* clipboard blocked; the bag still gets it */ }
    store.set("egosynk_offer", code);
    say(`${code} copied · it'll be ready in your bag`);
    track("select_promotion", { promotion_name: code });
  };
  return (
    <div className="mt-6 rounded-sharp border border-dashed border-line p-4">
      <p className="mono mb-2 text-micro font-bold uppercase tracking-[0.14em] text-dim">Offers</p>
      <ul className="space-y-2">
        {offers.map((o) => (
          <li key={o.code} className="flex flex-wrap items-center justify-between gap-2 text-small">
            <span>{offerText(o)}</span>
            <button type="button" onClick={() => copy(o.code)} className="mono rounded-sharp border border-line px-2.5 py-1 text-micro font-bold uppercase tracking-[0.1em] hover:border-dim pointer-coarse:py-2.5">
              {o.code} · Copy
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveButton({ id, name, price, say }: { id: number; name: string; price: number; say: (t: string) => void }) {
  const saved = useSyncExternalStore(savedSubscribe, () => readSaved().includes(id), () => false);
  const toggle = () => {
    const list = readSaved();
    const next = saved ? list.filter((x) => x !== id) : [...list, id];
    store.set(SAVED_KEY, JSON.stringify(next));
    dispatchEvent(new Event("egosynk-saved"));
    fetch("/.netlify/functions/wishlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: next }) }).catch(() => {});
    say(saved ? "Removed from saved" : "Saved for later");
    track(saved ? "remove_from_wishlist" : "add_to_wishlist", { items: [{ item_id: id, item_name: name, price }] });
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save for later"}
      className={`grid h-13 w-13 shrink-0 place-items-center rounded-sharp border transition-colors ${saved ? "border-rust text-rust-text" : "border-line text-dim hover:border-dim hover:text-bone"}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="size-5"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>
    </button>
  );
}

// Back-in-stock email: shown when the product, or one of its sizes, is sold out.
function Notify({ data }: { data: PdpData }) {
  const p = data.product;
  const whole = p.available === false;
  const sizes = soldOutSizes(p);
  const [email, setEmail] = useState("");
  // The email used last time, filled in after hydration (the server can't know it).
  useEffect(() => { const t = setTimeout(() => setEmail((e) => e || store.get("egosynk_email")), 0); return () => clearTimeout(t); }, []);
  const [size, setSize] = useState(sizes[0] || "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!whole && !sizes.length) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/.netlify/functions/stock-alert", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, size: whole ? null : size, email: email.trim() }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Could not sign you up");
      store.set("egosynk_email", email.trim());
      setMsg({ ok: true, text: `Done. We'll email ${email.trim()} when it's back${whole ? "" : ` in ${size}`}.` });
      track("stock_alert_signup", { item_id: p.id });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not sign you up" }); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="mt-2 rounded-sharp border border-line bg-surface p-4">
      <p className="text-small">
        {whole ? "Sold out right now." : <>Sold out in {sizes.length === 1 ? <b>{sizes[0]}</b> : (
          <select value={size} onChange={(e) => setSize(e.target.value)} aria-label="Size to be notified about" className="mx-1 rounded-sharp border border-line bg-ink px-2 py-1">
            {sizes.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}?</>} We&apos;ll email you once when it&apos;s back.
      </p>
      <div className="mt-3 flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" aria-label="Email for back-in-stock alert" autoComplete="email"
          className="h-11 min-w-0 flex-1 rounded-sharp border border-line bg-ink px-3 placeholder:text-steel focus:border-dim focus:outline-none" />
        <button type="submit" disabled={busy} className="btn btn-ghost min-h-11 px-4 disabled:opacity-60">Notify me</button>
      </div>
      {msg && <p aria-live="polite" className={`mt-2 text-small ${msg.ok ? "text-ok-bright" : "text-rust-text"}`}>{msg.text}</p>}
    </form>
  );
}

function DeliveryCheck() {
  const [pin, setPin] = useState("");
  const [out, setOut] = useState<{ ok: true; text: string; zone: string } | { ok: false; text: string } | null>(null);
  const check = (value: string) => {
    if (!isPincode(value)) { setOut({ ok: false, text: "Enter a valid 6-digit pincode" }); return; }
    store.set("egosynk_pincode", value);
    const w = deliveryWindow(value);
    const fmt = (d: Date) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    setOut({ ok: true, text: `Delivery by ${fmt(w.from)} – ${fmt(w.to)} to ${value}`, zone: w.zone });
    track("delivery_estimate", { zone: w.zone });
  };
  // The last pincode someone checked is remembered across products.
  useEffect(() => {
    const saved = store.get("egosynk_pincode");
    if (!saved) return;
    const t = setTimeout(() => { setPin(saved); check(saved); }, 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mt-6">
      <p className="mono mb-2 text-micro font-bold uppercase tracking-[0.14em] text-dim">Delivery estimate</p>
      <form onSubmit={(e) => { e.preventDefault(); check(pin.trim()); }} className="flex gap-2">
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="postal-code" placeholder="Enter pincode" aria-label="Pincode"
          className="h-11 w-full max-w-56 rounded-sharp border border-line bg-ink px-3 placeholder:text-steel focus:border-dim focus:outline-none" />
        <button type="submit" className="btn btn-ghost min-h-11 px-4">Check</button>
      </form>
      <p aria-live="polite" className={`mt-2 text-small ${out && !out.ok ? "text-rust-text" : "text-dim"}`}>
        {out?.ok ? <><b className="text-bone">{out.text}</b><span className="block text-micro text-steel">{out.zone} · estimate, exact date in your tracking once shipped</span></> : out?.text}
      </p>
    </div>
  );
}

// Phones: a buy bar appears once the main button has scrolled out of view.
function StickyBuy({ anchor, price, label, sizeText, disabled, onAdd }: { anchor: React.RefObject<HTMLButtonElement | null>; price: number; label: string; sizeText: string; disabled: boolean; onAdd: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = anchor.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [anchor]);
  return (
    <div aria-hidden={!show} inert={!show}
      className={`gutter fixed inset-x-0 bottom-0 z-(--z-whatsapp) border-t border-line bg-ink/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="display text-xl tabular-nums">{inr(price)}</p>
          {sizeText && <p className="mono truncate text-micro uppercase text-dim">{sizeText}</p>}
        </div>
        <button type="button" onClick={onAdd} disabled={disabled} className="btn btn-primary disabled:opacity-50">{label}</button>
      </div>
    </div>
  );
}
