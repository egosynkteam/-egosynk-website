import type { Metadata } from "next";
import { LegalPage, Mail } from "@/components/legal-page";
import { legacy } from "@/lib/links";

export const metadata: Metadata = {
  title: "Returns, exchanges & refunds",
  description: "EGOSYNK returns: 7-day size exchange on unused items; refunds for damaged or wrong items.",
  alternates: { canonical: legacy.returns },
};

// The windows here (7 days, 48 hours) are the ones netlify/lib/exchanges.js enforces.
export default function RefundPolicy() {
  return (
    <LegalPage
      path={legacy.returns}
      eyebrow="Help · Returns"
      title={<>Returns, exchanges <span className="text-rust">&amp; refunds</span></>}
      updated="20 October 2026"
      intro="Wrong size? Swap it within 7 days. Damaged or wrong item? Tell us within 48 hours and we replace it or refund you in full."
    >
      <h2>7-day size exchange</h2>
      <p>Wrong size? You can exchange it for another size of the same product within <strong>7 days of delivery</strong>, as long as the item is:</p>
      <ul>
        <li>unused, unwashed and in its original condition</li>
        <li>with all original tags and packaging</li>
      </ul>
      <p>Exchanges depend on stock. If your size isn&apos;t available, we&apos;ll offer a different product of the same value or a refund.</p>
      <p><strong>Innerwear</strong> (trunks) and <strong>socks</strong> can be size-exchanged only if the <strong>hygiene seal is unbroken</strong>. Once the seal is opened they can&apos;t be exchanged or returned, for hygiene reasons. We check the seal when the item reaches us.</p>

      <h2>Not eligible for return or exchange</h2>
      <ul>
        <li><strong>Innerwear</strong> (trunks) and <strong>socks</strong> with the hygiene seal opened</li>
        <li>Fragrances once the seal is broken</li>
        <li>Items that have been used, washed or damaged after delivery</li>
      </ul>

      <h2>Damaged, defective or wrong item</h2>
      <p>If something arrives damaged or isn&apos;t what you ordered, email <Mail subject="Damaged or wrong item" /> within <strong>48 hours of delivery</strong> with your order ID and photos. We&apos;ll send a replacement or give a <strong>full refund</strong>, including shipping. This applies to every product, including innerwear and socks.</p>

      <h2>How to request an exchange</h2>
      <ol>
        <li>Go to <a href={legacy.account}>My Orders</a> and choose “Exchange or report a problem”. Checked out as a guest? Email <Mail subject="Exchange request" /> with your order ID and the size you need.</li>
        <li>We&apos;ll confirm and arrange a pickup or share the return address.</li>
        <li>Once we receive and check the item, we ship the new size.</li>
      </ol>

      <h2>Refunds</h2>
      <p>Approved refunds go back to your original payment method through Razorpay within <strong>5–7 business days</strong> of approval. Your bank may take a little longer to show it.</p>

      <h2>Cancellations</h2>
      <p>You can cancel an order for a full refund before it ships. Email us as soon as possible with your order ID. Once it has shipped, the exchange policy above applies.</p>
    </LegalPage>
  );
}
