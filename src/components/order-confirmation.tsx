"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BAG_KEY, writeBag } from "@/lib/bag";
import { legacy } from "@/lib/links";
import { SUPPORT_EMAIL } from "./legal-page";

type Item = { id: number; name: string; size?: string; qty: number; price: number };
type Order = {
  orderId: string; items: Item[]; amount: number; shippingFee?: number | null; discount: number; coupon: string | null;
  gift?: { name: string } | null;
  invoiceNumber: string | null;
  shipping: { name: string; email?: string; phone: string; address1: string; address2?: string; city: string; state: string; pincode: string };
};
type View =
  | { state: "loading" }
  | { state: "error"; text: React.ReactNode }
  | { state: "ok"; order: Order; viewKey: string | null };


const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const support = <a href={`mailto:${SUPPORT_EMAIL}`} className="text-bone underline decoration-rust underline-offset-4">{SUPPORT_EMAIL}</a>;

// After Razorpay's popup: verify the payment signature on the server (the single point where an
// order is marked paid), clear the bag, then show the receipt. Also opened later from the
// confirmation email, with ?order= and a view key (?k=).
async function load(): Promise<View> {
  const params = new URLSearchParams(location.search);
  const orderId = params.get("order");
  // Payment proof from checkout (sessionStorage; older links carried it in the URL).
  let pay: { order?: string; payment_id?: string; signature?: string } = {};
  try { pay = JSON.parse(sessionStorage.getItem("egosynk_payment") || "{}"); } catch { /* ignore */ }
  if (pay.order !== orderId) pay = {};
  const paymentId = pay.payment_id || params.get("payment_id");
  const signature = pay.signature || params.get("signature");
  // Keep only the order id in the address bar before analytics loads.
  if (params.get("payment_id") || params.get("signature") || params.get("k")) {
    history.replaceState(null, "", location.pathname + (orderId ? `?order=${encodeURIComponent(orderId)}` : ""));
  }
  if (!orderId) {
    return { state: "error", text: <>This link doesn&apos;t include an order. Your confirmation email has the right link, and signed-in customers can see every order in <a href={legacy.account} className="text-bone underline decoration-rust underline-offset-4">My account</a>.</> };
  }
  const viewKeyName = `egosynk_view_${orderId}`;
  let viewKey = params.get("k");
  try { viewKey = viewKey || sessionStorage.getItem(viewKeyName); } catch { /* ignore */ }

  if (paymentId && signature) {
    const res = await fetch("/.netlify/functions/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature }),
    });
    const result = await res.json().catch(() => ({}));
    if (!result.verified) {
      return { state: "error", text: <>Payment could not be verified. If money was deducted, email {support} with this order ID: <span className="mono text-bone">{orderId}</span></> };
    }
    try { sessionStorage.removeItem("egosynk_payment"); sessionStorage.removeItem(BAG_KEY); } catch { /* ignore */ }
    writeBag([]); // also empties the bag drawer on this page
    viewKey = result.k || viewKey;
    try { if (viewKey) sessionStorage.setItem(viewKeyName, viewKey); } catch { /* ignore */ }
  }

  const res = await fetch(`/.netlify/functions/get-order?id=${encodeURIComponent(orderId)}${viewKey ? `&k=${encodeURIComponent(viewKey)}` : ""}`);
  if (!res.ok) {
    return { state: "error", text: <>We can&apos;t find this order yet. If you just paid, refresh in a few seconds. Still missing? Email {support} and we&apos;ll check.</> };
  }
  return { state: "ok", order: (await res.json()) as Order, viewKey };
}

// Reported once per order: reloading the page must not count the purchase twice.
function reportPurchase(order: Order) {
  const send = () => {
    try {
      const k = `egosynk_tracked_${order.orderId}`;
      if (localStorage.getItem(k) || !window.egoTrack) return;
      window.egoTrack("purchase", {
        transaction_id: order.orderId, currency: "INR", value: order.amount / 100, shipping: order.shippingFee || 0, coupon: order.coupon || undefined,
        items: order.items.map((i) => ({ item_id: i.id, item_name: i.name, item_variant: i.size, price: i.price, quantity: i.qty })),
      });
      localStorage.setItem(k, "1");
    } catch { /* ignore */ }
  };
  // consent.js (which defines egoTrack) loads after the page; wait for it if needed.
  if (document.readyState === "complete") send(); else addEventListener("load", send, { once: true });
}

export function OrderConfirmation() {
  const [view, setView] = useState<View>({ state: "loading" });
  // Verifying spends the payment proof; never send it twice (React may run this effect again).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load()
      .then((v) => { setView(v); if (v.state === "ok") reportPurchase(v.order); })
      .catch(() => setView({ state: "error", text: <>Your order couldn&apos;t load. Refresh to try again, or email {support}.</> }));
  }, []);

  if (view.state === "loading") {
    return <Shell eyebrow="Checkout" title={<>Confirming your <span className="text-rust">order</span></>}><p className="text-dim" role="status">Checking your payment…</p></Shell>;
  }
  if (view.state === "error") {
    return <Shell eyebrow="Checkout" title={<>Something&apos;s <span className="text-rust">off</span></>}><p role="alert" className="leading-relaxed text-dim">{view.text}</p></Shell>;
  }

  const { order, viewKey } = view;
  const s = order.shipping;
  const row = "flex justify-between gap-4 border-b border-line py-3 text-small";
  return (
    <Shell
      eyebrow="Order confirmed"
      title={<>Locked <span className="text-rust">in.</span></>}
      sub={<>Thanks for the order. We&apos;re getting it ready.{s.email && <> Your receipt is on its way to <span className="text-bone">{s.email}</span>.</>}</>}
    >
      <p className="mono inline-block break-all rounded-sharp border border-line bg-ink px-3 py-2 text-micro text-rust-text">{order.orderId}</p>

      <h2 className="mono mb-1 mt-8 text-micro uppercase tracking-[0.12em] text-steel">Items</h2>
      {order.items.map((i, n) => (
        <div key={n} className={row}>
          <div>
            <p className="text-bone">{i.name}</p>
            <p className="mono text-micro text-steel">{i.size ? `Size ${i.size} · ` : ""}Qty {i.qty}</p>
          </div>
          <p className="mono">{inr(i.price * i.qty)}</p>
        </div>
      ))}
      {order.gift && <div className={row}><p>Free gift · {order.gift.name}</p><p className="mono text-ok-bright">Free</p></div>}
      {order.discount > 0 && <div className={row}><p>Discount{order.coupon ? ` · ${order.coupon}` : ""}</p><p className="mono text-ok-bright">−{inr(order.discount)}</p></div>}
      {order.shippingFee != null && <div className={row}><p>Shipping</p><p className="mono">{order.shippingFee ? inr(order.shippingFee) : "Free"}</p></div>}
      <div className="flex justify-between pt-4 text-lead font-bold"><p>Total</p><p className="mono">{inr(order.amount / 100)}</p></div>

      <h2 className="mono mb-2 mt-8 text-micro uppercase tracking-[0.12em] text-steel">Delivering to</h2>
      <address className="text-small not-italic leading-relaxed text-dim">
        {s.name}<br />
        {s.address1}{s.address2 ? `, ${s.address2}` : ""}<br />
        {s.city}, {s.state} {s.pincode}<br />
        {s.phone}
      </address>

      <div className="mt-8 grid gap-3">
        {order.invoiceNumber && (
          <a className="btn btn-ghost" href={`/invoice.html?id=${encodeURIComponent(order.orderId)}${viewKey ? `&k=${encodeURIComponent(viewKey)}` : ""}`}>
            GST invoice · {order.invoiceNumber}
          </a>
        )}
        <Link className="btn btn-primary" href="/">Keep shopping →</Link>
      </div>
      <p className="mono mt-6 text-center text-micro text-steel">Sold by EGOSYNK · GSTIN 27AKHPY6964E1ZI · {SUPPORT_EMAIL}</p>
    </Shell>
  );
}

function Shell({ eyebrow, title, sub, children }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="gutter grain relative grid min-h-dvh place-items-center overflow-hidden pb-20 pt-[calc(var(--header-h)+3rem)]">
      <div className="relative w-full max-w-lg">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-3 text-display-sm">{title}</h1>
        {sub && <p className="mt-3 text-dim">{sub}</p>}
        <div className="mt-8 rounded-sharp border border-line bg-surface p-6 sm:p-8">{children}</div>
      </div>
    </section>
  );
}
