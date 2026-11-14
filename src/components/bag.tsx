"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { STATES, bagServerSnapshot, bagSnapshot, mediaUrl, parseBag, readBag, stateForPin, subscribeBag, totals, writeBag, type BagLine, type Coupon, type ShopProduct } from "@/lib/bag";
import { inr, track } from "@/lib/catalog-shared";
import { legacy } from "@/lib/links";
import { BRAND } from "@/lib/brand";

type Toast = { text: string; action?: { label: string; run: () => void } };
type Bag = {
  lines: BagLine[]; count: number; open: () => void;
  // Adds to the bag (merging with the same product and size) and confirms with a toast.
  add: (line: Omit<BagLine, "lineId">) => void;
  say: (text: string, action?: Toast["action"]) => void;
};
const BagContext = createContext<Bag>({ lines: [], count: 0, open: () => {}, add: () => {}, say: () => {} });
// A code copied from a product page's offers; the bag offers it in the discount field.
const OFFER_KEY = "egosynk_offer";
export const useBag = () => useContext(BagContext);

type RazorpayOptions = Record<string, unknown> & { handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void };
declare global {
  interface Window { Razorpay?: new (o: RazorpayOptions) => { open: () => void; on: (e: string, f: () => void) => void } }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

async function requestCoupon(code: string, lines: BagLine[]): Promise<Coupon> {
  const res = await fetch("/.netlify/functions/apply-coupon", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, cart: lines.map((l) => ({ id: l.id, qty: l.qty })) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not apply that code");
  return data;
}

// One bag for the whole storefront: the header button opens it, /#bag opens it (product,
// account and policy pages link there), and /?restore=<token> from reminder emails refills it.
export function BagProvider({ products, ship, children }: { products: ShopProduct[]; ship: { fee: number; freeOver: number }; children: React.ReactNode }) {
  const saved = useSyncExternalStore(subscribeBag, bagSnapshot, bagServerSnapshot);
  const lines = useMemo(() => parseBag(saved), [saved]);
  const [isOpen, setOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [applied, setCoupon] = useState<Coupon | null>(null);
  const coupon = lines.length ? applied : null;
  const [couponError, setCouponError] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const say = useCallback((text: string, action?: Toast["action"]) => {
    setToast({ text, action });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 4000 : 2600);
  }, []);

  const save = useCallback((next: BagLine[]) => writeBag(next), []);

  // /#bag opens the bag, on arrival or when the hash changes.
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#bag") { setOpen(true); history.replaceState(null, "", location.pathname + location.search); }
    };
    const t = setTimeout(onHash, 0);
    addEventListener("hashchange", onHash);
    return () => { clearTimeout(t); removeEventListener("hashchange", onHash); };
  }, []);

  // Reminder emails: put the items back, priced from the live catalog, then open the bag.
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("restore");
    if (!t) return;
    history.replaceState(null, "", location.pathname);
    (async () => {
      try {
        const res = await fetch("/.netlify/functions/restore-cart?t=" + encodeURIComponent(t));
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { say(data.error || "That link has expired"); return; }
        const next = readBag();
        let added = 0;
        for (const it of data.items as { id: number; size: string; qty: number }[]) {
          const p = products.find((x) => x.id === it.id);
          if (!p || !p.available) continue;
          const lineId = `${p.id}-${it.size}`;
          const line = next.find((l) => l.lineId === lineId);
          if (line) line.qty = Math.max(line.qty, it.qty);
          else next.push({ lineId, id: p.id, name: p.name, cat: p.cat, price: p.price, size: it.size, qty: it.qty, image: p.image });
          added++;
        }
        save(next);
        if (data.coupon && added) { try { setCoupon(await requestCoupon(data.coupon, next)); } catch { /* code no longer valid */ } }
        setOpen(true);
        say(added ? "Your bag is back" : "Those items are no longer available");
      } catch { say("Could not restore your bag"); }
    })();
  }, [products, save, say]);

  // The saving depends on what's in the bag, so check the code again when the bag changes.
  const code = coupon?.code;
  useEffect(() => {
    if (!code || !lines.length) return;
    const t = setTimeout(async () => {
      try { setCoupon(await requestCoupon(code, lines)); }
      catch (err) { setCoupon(null); setCouponError(err instanceof Error ? err.message : "That code no longer applies"); }
    }, 400);
    return () => clearTimeout(t);
  }, [lines, code]);

  const sum = totals(lines, coupon, ship);
  const add = useCallback((line: Omit<BagLine, "lineId">) => {
    const next = readBag();
    const lineId = `${line.id}-${line.size}`;
    const existing = next.find((l) => l.lineId === lineId);
    if (existing) existing.qty += line.qty;
    else next.push({ ...line, lineId });
    writeBag(next);
    track("add_to_cart", { currency: "INR", value: line.price * line.qty, items: [{ item_id: line.id, item_name: line.name, item_variant: line.size, price: line.price, quantity: line.qty }] });
    say("Added to bag", { label: "View bag", run: () => setOpen(true) });
  }, [say]);
  const value = useMemo(() => ({ lines, count: sum.count, open: () => setOpen(true), add, say }), [lines, sum.count, add, say]);

  const changeQty = (lineId: string, d: number) => save(lines.flatMap((l) => (l.lineId !== lineId ? [l] : l.qty + d > 0 ? [{ ...l, qty: l.qty + d }] : [])));
  const remove = (lineId: string) => save(lines.filter((l) => l.lineId !== lineId));

  return (
    <BagContext.Provider value={value}>
      {children}
      <BagDrawer open={isOpen} onClose={() => setOpen(false)} lines={lines} sum={sum} ship={ship} coupon={coupon} couponError={couponError}
        onQty={changeQty} onRemove={remove}
        onCoupon={async (c) => { setCouponError(""); try { setCoupon(await requestCoupon(c, lines)); return true; } catch (err) { setCouponError(err instanceof Error ? err.message : "Could not apply that code"); return false; } }}
        onRemoveCoupon={() => setCoupon(null)}
        onCheckout={() => { if (!lines.length) { say("Your bag is empty"); return; } setCheckingOut(true); }} />
      <CheckoutDialog open={checkingOut} onClose={() => setCheckingOut(false)} lines={lines} coupon={coupon} total={sum.total} say={say} />
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-(--z-toast) flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              className="pointer-events-auto flex items-center gap-4 rounded-sharp border border-line bg-surface px-5 py-3 text-sm shadow-2xl">
              <p>{toast.text}</p>
              {toast.action && (
                <button type="button" onClick={() => { toast.action?.run(); setToast(null); }}
                  className="mono -my-1 text-micro font-bold uppercase tracking-[0.12em] text-rust-text underline-offset-4 hover:underline pointer-coarse:py-3">{toast.action.label}</button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BagContext.Provider>
  );
}

// Closes on Escape, keeps the page behind from scrolling, and puts focus inside when it opens.
function useModal(open: boolean, onClose: () => void, focusRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    const t = setTimeout(() => focusRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", onKey);
    return () => { clearTimeout(t); html.style.overflow = before; removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose, focusRef]);
}

type Sum = ReturnType<typeof totals>;

function BagDrawer(props: {
  open: boolean; onClose: () => void; lines: BagLine[]; sum: Sum; ship: { fee: number; freeOver: number };
  coupon: Coupon | null; couponError: string; onQty: (id: string, d: number) => void; onRemove: (id: string) => void;
  onCoupon: (code: string) => Promise<boolean>; onRemoveCoupon: () => void; onCheckout: () => void;
}) {
  const { open, onClose, lines, sum, ship, coupon } = props;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [code, setCode] = useState("");
  // Prefill a code copied from a product page's offers (it stays editable).
  useEffect(() => {
    if (!open || coupon) return;
    let saved = "";
    try { saved = localStorage.getItem(OFFER_KEY) || ""; } catch { /* storage blocked */ }
    if (saved) { const t = setTimeout(() => setCode((c) => c || saved), 0); return () => clearTimeout(t); }
  }, [open, coupon]);
  const [applying, setApplying] = useState(false);
  useModal(open, onClose, closeRef);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-(--z-drawer)">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside role="dialog" aria-modal="true" aria-labelledby="bag-h"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-ink pb-[env(safe-area-inset-bottom,0px)]"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
            <div className="flex h-(--header-h) items-center justify-between border-b border-line px-5">
              <h2 id="bag-h" className="display text-2xl">Your bag{sum.count ? <span className="mono ml-2 text-sm text-dim">({sum.count})</span> : null}</h2>
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close bag" className="grid size-10 pointer-coarse:size-11 place-items-center rounded-sharp border border-line hover:border-dim">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
            </div>

            {lines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
                <p className="display text-3xl">Your bag is empty.</p>
                <p className="text-dim">Add something built to last.</p>
                <Link href="/#gear" onClick={onClose} className="btn btn-primary">Shop gear →</Link>
              </div>
            ) : (
              <>
                <div className="border-b border-line px-5 py-4">
                  <p className="text-sm text-dim">{sum.toFree > 0 ? <>Add <b className="text-bone">{inr(sum.toFree)}</b> more for free shipping</> : <b className="text-bone">You&apos;ve unlocked free shipping</b>}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                    <motion.div className="h-full bg-rust" initial={false} animate={{ width: `${Math.min(100, ((sum.subtotal - sum.discount) / Math.max(1, ship.freeOver)) * 100)}%` }} />
                  </div>
                </div>
                <ul className="flex-1 divide-y divide-line overflow-y-auto overscroll-contain px-5">
                  <AnimatePresence initial={false}>
                    {lines.map((l) => (
                      <motion.li key={l.lineId} layout exit={{ opacity: 0, x: 40 }} className="flex gap-4 py-5">
                        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-sharp border border-line bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {l.image ? <img src={mediaUrl(l.image)} alt="" className="size-full object-cover" /> : <span className="mono text-xs text-steel">ES</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold leading-snug">{l.name}</p>
                            <p className="mono shrink-0 font-bold tabular-nums">{inr(l.price * l.qty)}</p>
                          </div>
                          {l.size && <p className="mono mt-1 text-xs uppercase text-dim">Size · {l.size}</p>}
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center rounded-sharp border border-line">
                              <button type="button" onClick={() => props.onQty(l.lineId, -1)} aria-label={`One fewer ${l.name}`} className="grid size-9 pointer-coarse:size-11 place-items-center text-dim hover:text-bone">−</button>
                              <span className="mono w-8 text-center text-sm tabular-nums" aria-label={`Quantity ${l.qty}`}>{l.qty}</span>
                              <button type="button" onClick={() => props.onQty(l.lineId, 1)} aria-label={`One more ${l.name}`} className="grid size-9 pointer-coarse:size-11 place-items-center text-dim hover:text-bone">+</button>
                            </div>
                            <button type="button" onClick={() => props.onRemove(l.lineId)} className="mono text-xs uppercase tracking-[0.1em] text-steel underline-offset-4 hover:text-bone hover:underline">Remove</button>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>

                <div className="border-t border-line bg-surface px-5 pb-5 pt-4">
                  {coupon ? (
                    <div className="flex items-center justify-between gap-3 rounded-sharp border border-ok/50 px-3 py-2.5 text-sm">
                      <span><span className="mono font-bold">{coupon.code}</span> applied · you save {inr(sum.discount)}{coupon.firstOrderOnly ? " · first orders only" : ""}</span>
                      <button type="button" onClick={props.onRemoveCoupon} className="mono text-xs uppercase text-dim hover:text-bone">Remove</button>
                    </div>
                  ) : (
                    <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!code.trim()) return; setApplying(true); if (await props.onCoupon(code.trim())) setCode(""); setApplying(false); }}>
                      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Discount code" aria-label="Discount code" autoComplete="off"
                        className="h-11 min-w-0 flex-1 rounded-sharp border border-line bg-ink px-3 uppercase placeholder:normal-case placeholder:text-steel focus:border-dim focus:outline-none" />
                      <button type="submit" disabled={applying} className="btn btn-ghost h-11 px-4 disabled:opacity-60">{applying ? "…" : "Apply"}</button>
                    </form>
                  )}
                  {props.couponError && !coupon && <p role="alert" className="mt-2 text-sm text-rust-text">{props.couponError}</p>}

                  <dl className="mt-4 space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-dim">Subtotal</dt><dd className="mono tabular-nums">{inr(sum.subtotal)}</dd></div>
                    {sum.discount > 0 && <div className="flex justify-between"><dt className="text-dim">Discount ({coupon?.code})</dt><dd className="mono tabular-nums text-ok">−{inr(sum.discount)}</dd></div>}
                    <div className="flex justify-between"><dt className="text-dim">Shipping</dt><dd className="mono tabular-nums">{sum.shipping ? inr(sum.shipping) : "Free"}</dd></div>
                    <div className="flex justify-between border-t border-line pt-2.5 text-base"><dt className="font-semibold">Total</dt><dd className="display text-xl tabular-nums">{inr(sum.total)}</dd></div>
                  </dl>
                  <button type="button" onClick={props.onCheckout} className="btn btn-primary mt-4 w-full">Checkout · {inr(sum.total)}</button>
                  <p className="mono mt-3 text-center text-micro uppercase tracking-[0.1em] text-steel">Secure checkout via Razorpay · UPI, cards, netbanking</p>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

type Me = { name?: string; email?: string; phone?: string; addresses?: { address1?: string; address2?: string; city?: string; state?: string; pincode?: string }[] };

function CheckoutDialog({ open, onClose, lines, coupon, total, say }: { open: boolean; onClose: () => void; lines: BagLine[]; coupon: Coupon | null; total: number; say: (m: string) => void }) {
  const firstRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState("");
  const [pinHint, setPinHint] = useState("");
  const [autoState, setAutoState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useModal(open, onClose, firstRef);

  // Signed-in customers get their saved details filled in; an account is never required.
  useEffect(() => {
    if (!open || me) return;
    fetch("/.netlify/functions/me").then((r) => (r.ok ? r.json() : null)).then((u: Me | null) => {
      if (!u) return;
      setMe(u);
      const saved = u.addresses?.[0]?.state?.trim().toLowerCase();
      const match = STATES.find((s) => s.toLowerCase() === saved);
      if (match) setState(match);
    }).catch(() => {});
  }, [open, me]);

  const addr = me?.addresses?.[0];

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const shipping = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!/^[6-9]\d{9}$/.test(shipping.phone)) { setError("Enter a valid 10-digit mobile number."); return; }
    if (!/^\d{6}$/.test(shipping.pincode)) { setError("Enter a valid 6-digit pincode."); return; }
    track("begin_checkout", { currency: "INR", value: lines.reduce((s, l) => s + l.price * l.qty, 0), coupon: coupon?.code,
      items: lines.map((l) => ({ item_id: l.id, item_name: l.name, item_variant: l.size, price: l.price, quantity: l.qty })) });
    setBusy(true);
    try {
      // The server prices the order from its own catalog; the bag only supplies ids and quantities.
      const [res] = await Promise.all([
        fetch("/.netlify/functions/create-order", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cart: lines.map((l) => ({ id: l.id, name: l.name, size: l.size, qty: l.qty })), couponCode: coupon?.code || null, shipping }),
        }),
        loadRazorpay(),
      ]);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not start checkout. Try again.");
      const rzp = new window.Razorpay!({
        key: data.keyId, order_id: data.orderId, amount: data.amount, currency: "INR", name: "EGOSYNK",
        description: "Fuel, gear and scent for lifters",
        prefill: { name: shipping.name, contact: shipping.phone, email: shipping.email || "" },
        theme: { color: BRAND.rust },
        handler: (r) => {
          // The confirmation page verifies the payment and clears the bag. The proof goes in
          // sessionStorage, not the URL, so it never lands in history or analytics.
          try { sessionStorage.setItem("egosynk_payment", JSON.stringify({ order: r.razorpay_order_id, payment_id: r.razorpay_payment_id, signature: r.razorpay_signature })); } catch { /* ignore */ }
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a static page outside the app
          location.href = `/order-confirmation.html?order=${encodeURIComponent(r.razorpay_order_id)}`;
        },
        modal: { ondismiss: () => say("Checkout cancelled") },
      });
      rzp.on("payment.failed", () => say("Payment failed. Please try again."));
      onClose();
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-12 w-full rounded-sharp border border-line bg-ink px-3.5 text-bone placeholder:text-steel focus:border-dim focus:outline-none";
  const label = "mono text-micro uppercase tracking-[0.12em] text-dim";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-(--z-dialog) grid place-items-end sm:place-items-center">
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div role="dialog" aria-modal="true" aria-labelledby="co-h"
            className="relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain border border-line bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-xl sm:rounded-sharp sm:p-8"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="co-h" className="display text-3xl">Delivery details</h2>
                <p className="mt-1 text-sm text-dim">Where should we send your order?{!me && <> <a href={legacy.account} className="underline decoration-rust underline-offset-4">Sign in</a> to fill this in.</>}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 pointer-coarse:size-11 shrink-0 place-items-center rounded-sharp border border-line hover:border-dim">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" /></svg>
              </button>
            </div>
            <form key={me ? "me" : "guest"} onSubmit={pay} className="mt-6 grid gap-4">
              <label className="grid gap-1.5"><span className={label}>Full name</span>
                <input ref={firstRef} name="name" autoComplete="shipping name" required defaultValue={me?.name || ""} className={field} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5"><span className={label}>Mobile</span>
                  <input name="phone" type="tel" inputMode="numeric" autoComplete="shipping tel-national" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile" required defaultValue={me?.phone || ""} className={field} /></label>
                <label className="grid gap-1.5"><span className={label}>Email</span>
                  <input name="email" type="email" autoComplete="email" required defaultValue={me?.email || ""} className={field} /></label>
              </div>
              <label className="grid gap-1.5"><span className={label}>Address line 1</span>
                <input name="address1" autoComplete="shipping address-line1" required defaultValue={addr?.address1 || ""} className={field} /></label>
              <label className="grid gap-1.5"><span className={label}>Address line 2 <span className="text-steel">(optional)</span></span>
                <input name="address2" autoComplete="shipping address-line2" defaultValue={addr?.address2 || ""} className={field} /></label>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_0.8fr]">
                <label className="grid gap-1.5"><span className={label}>City</span>
                  <input name="city" autoComplete="shipping address-level2" required defaultValue={addr?.city || ""} className={field} /></label>
                <label className="grid gap-1.5"><span className={label}>State</span>
                  <select name="state" autoComplete="shipping address-level1" required value={state} onChange={(e) => { setState(e.target.value); setAutoState(false); setPinHint(""); }} className={field}>
                    <option value="">Select state</option>
                    {STATES.map((s) => <option key={s}>{s}</option>)}
                  </select></label>
                <label className="grid gap-1.5"><span className={label}>Pincode</span>
                  <input name="pincode" inputMode="numeric" autoComplete="shipping postal-code" pattern="[0-9]{6}" maxLength={6} required defaultValue={addr?.pincode || ""} className={field}
                    onChange={(e) => {
                      const pin = e.target.value.replace(/\D/g, "").slice(0, 6);
                      if (pin !== e.target.value) e.target.value = pin;
                      const st = stateForPin(pin);
                      if (st && (!state || autoState)) { setState(st); setAutoState(true); setPinHint(`State set to ${st} from your pincode. Change it if that's wrong.`); }
                      else if (pin.length < 6 && autoState) setPinHint("");
                    }} /></label>
              </div>
              <p aria-live="polite" className="-mt-2 min-h-[1em] text-xs text-dim">{pinHint}</p>
              {error && <p role="alert" className="text-sm text-rust-text">{error}</p>}
              <button type="submit" disabled={busy} className="btn btn-primary w-full disabled:opacity-60">{busy ? "Opening payment…" : `Pay ${inr(total)} →`}</button>
              <p className="text-center text-xs text-steel">You&apos;ll pay in Razorpay&apos;s secure window. The final total, including shipping, is confirmed there.</p>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
