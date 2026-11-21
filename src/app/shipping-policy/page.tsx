import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getCatalog, SHIPPING_FALLBACK } from "@/lib/catalog";
import { legacy } from "@/lib/links";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export async function generateMetadata(): Promise<Metadata> {
  const { fee, freeOver } = await shipping();
  return {
    title: "Shipping policy",
    description: `EGOSYNK shipping: free delivery over ${inr(freeOver)}, ${inr(fee)} below, 3–7 business days across India.`,
    alternates: { canonical: legacy.shipping },
  };
}

// The fee and the free-shipping line come from Admin → Settings, so this page always matches
// what the bag charges.
async function shipping() {
  const { settings } = await getCatalog();
  return {
    fee: settings.shippingFee ?? SHIPPING_FALLBACK.shippingFee,
    freeOver: settings.freeShippingThreshold ?? SHIPPING_FALLBACK.freeShippingThreshold,
  };
}

export default async function ShippingPolicy() {
  const { fee, freeOver } = await shipping();
  return (
    <LegalPage
      path={legacy.shipping}
      eyebrow="Help · Shipping"
      title={<>Shipping <span className="text-rust">policy</span></>}
      updated="18 October 2026"
      intro={`Free delivery across India on orders of ${inr(freeOver)} and above. Packed in 1–2 business days, with you in 3–7.`}
    >
      <h2>Where we ship</h2>
      <p>We deliver across India to any serviceable pincode. We don&apos;t ship internationally yet.</p>

      <h2>Shipping charges</h2>
      <table>
        <thead><tr><th>Order value (after discounts)</th><th>Shipping</th></tr></thead>
        <tbody>
          <tr><td>{inr(freeOver)} and above</td><td>Free</td></tr>
          <tr><td>Below {inr(freeOver)}</td><td>{inr(fee)}</td></tr>
        </tbody>
      </table>
      <p>The exact charge is shown in your bag before you pay and on your GST invoice.</p>

      <h2>Delivery time</h2>
      <ul>
        <li>Orders are packed and dispatched within <strong>1–2 business days</strong>.</li>
        <li>Delivery usually takes <strong>3–7 business days</strong> after dispatch, depending on your location.</li>
        <li>Remote areas, public holidays and courier delays can add time. We&apos;ll keep you posted.</li>
      </ul>

      <h2>Tracking</h2>
      <p>Once your order ships, the courier name and tracking number appear in <a href={legacy.account}>My Account → Orders</a>.</p>

      <h2>Payment</h2>
      <p>All orders are prepaid online via Razorpay (UPI, cards, netbanking, wallets). Cash on delivery isn&apos;t available at the moment.</p>

      <h2>Failed or returned deliveries</h2>
      <p>If a parcel comes back to us because the address was wrong or nobody was available after the courier&apos;s attempts, we&apos;ll contact you to re-ship it. Re-shipping may be charged at {inr(fee)}.</p>
    </LegalPage>
  );
}
