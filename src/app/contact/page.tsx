import type { Metadata } from "next";
import { LegalPage, Mail, SUPPORT_EMAIL } from "@/components/legal-page";
import { legacy } from "@/lib/links";

export const metadata: Metadata = {
  title: "Contact & grievances",
  description: "Contact EGOSYNK support and the grievance officer.",
  alternates: { canonical: legacy.contact },
};

export default function Contact() {
  return (
    <LegalPage
      path={legacy.contact}
      eyebrow="Help · Contact"
      title={<>Contact <span className="text-rust">&amp; grievances</span></>}
      updated="20 October 2026"
      intro="One inbox for everything. Send your order ID if you have one and we reply within 1 business day, Monday to Saturday."
      actions={<>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="btn btn-primary">Email support →</a>
        <a href={legacy.bulk} className="btn btn-ghost">Bulk &amp; team orders</a>
      </>}
    >
      <h2>Customer support</h2>
      <p>Email <Mail /> with your order ID (if you have one). We reply within <strong>1 business day</strong>, Monday to Saturday.</p>

      <h2>Bulk &amp; team orders</h2>
      <p>Kitting out a gym, team or event? Use the <a href={legacy.bulk}>bulk order form</a> and we&apos;ll reply with pricing within 1 business day.</p>

      <h2>Seller details</h2>
      <table>
        <tbody>
          <tr><td>Business name</td><td>EGOSYNK</td></tr>
          <tr><td>Type</td><td>Sole proprietorship</td></tr>
          <tr><td>Address</td><td>Dadar (W), Mumbai, Maharashtra 400028, India</td></tr>
          <tr><td>GSTIN</td><td>27AKHPY6964E1ZI</td></tr>
          <tr><td>Email</td><td><Mail /></td></tr>
        </tbody>
      </table>

      <h2>Grievance officer</h2>
      <p>As required under the Consumer Protection (E-Commerce) Rules, 2020:</p>
      <table>
        <tbody>
          <tr><td>Name</td><td>EGOSYNK Support (Grievance Officer)</td></tr>
          <tr><td>Email</td><td><Mail subject="Grievance" /> (subject: “Grievance”)</td></tr>
          <tr><td>Response</td><td>Acknowledged within 48 hours, resolved within 30 days</td></tr>
        </tbody>
      </table>
    </LegalPage>
  );
}
