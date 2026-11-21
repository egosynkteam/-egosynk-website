import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { legacy } from "@/lib/links";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "Terms of sale for purchases on egosynk.com.",
  alternates: { canonical: legacy.terms },
};

export default function Terms() {
  return (
    <LegalPage
      path={legacy.terms}
      eyebrow="Legal · Terms"
      title={<>Terms <span className="text-rust">&amp; conditions</span></>}
      updated="18 October 2026"
      intro="These terms apply when you use egosynk.com or buy from us. By placing an order you agree to them."
    >
      <h2>Who we are</h2>
      <p>egosynk.com is operated by EGOSYNK, a sole proprietorship registered in Maharashtra, India (GSTIN 27AKHPY6964E1ZI). See the bottom of this page for contact details.</p>

      <h2>Products and pricing</h2>
      <ul>
        <li>All prices are in Indian Rupees and <strong>include GST</strong>. Shipping is shown separately at checkout (see our <a href={legacy.shipping}>Shipping Policy</a>).</li>
        <li>We try to show products, colours and sizes accurately; small variations from screen colours are normal.</li>
        <li>We may correct pricing errors. If an item was priced wrongly, we&apos;ll contact you before shipping and you can cancel for a full refund.</li>
      </ul>

      <h2>Orders and payment</h2>
      <ul>
        <li>Your order is confirmed once payment succeeds through Razorpay. You&apos;ll get an order ID and a GST tax invoice.</li>
        <li>We may cancel an order (with a full refund) if an item is out of stock, can&apos;t be delivered to your pincode, or the order looks fraudulent.</li>
        <li>We never see or store your card, UPI or bank details. Razorpay handles them.</li>
      </ul>

      <h2>Shipping, returns and refunds</h2>
      <p>Covered by our <a href={legacy.shipping}>Shipping Policy</a> and <a href={legacy.returns}>Returns, Exchanges &amp; Refunds</a> policy, which form part of these terms.</p>

      <h2>Accounts</h2>
      <p>Keep your password private. You&apos;re responsible for orders placed from your account. We may suspend accounts used for fraud or abuse.</p>

      <h2>Use of the site</h2>
      <p>All content on this site (logo, designs, photos, text) belongs to EGOSYNK. Don&apos;t copy or reuse it without permission. Don&apos;t misuse the site, for example by trying to break its security or scraping it.</p>

      <h2>Liability</h2>
      <p>Our liability for any order is limited to the amount you paid for it, except where the law doesn&apos;t allow such a limit. Nothing in these terms affects your rights under the Consumer Protection Act, 2019.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by Indian law. Courts in Mumbai, Maharashtra have jurisdiction.</p>

      <h2>Questions or complaints</h2>
      <p>See <a href={legacy.contact}>Contact &amp; Grievances</a>.</p>
    </LegalPage>
  );
}
