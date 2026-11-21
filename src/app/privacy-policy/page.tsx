import type { Metadata } from "next";
import { LegalPage, Mail } from "@/components/legal-page";
import { legacy } from "@/lib/links";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What personal data egosynk.com collects, why, who it's shared with, and how to have it deleted.",
  alternates: { canonical: legacy.privacy },
};

// Keep this in step with what the code does: the bag (src/lib/bag.ts), drop lists
// (netlify/lib/waitlist.js), back-in-stock alerts (netlify/lib/stock-alerts.js), bag
// reminders (netlify/lib/abandoned.js) and the cookie banner (consent.js links to #cookies).
export default function PrivacyPolicy() {
  return (
    <LegalPage
      path={legacy.privacy}
      eyebrow="Legal · Privacy"
      title={<>Privacy <span className="text-rust">policy</span></>}
      updated="22 November 2026"
      intro="What personal data we collect, why, and how it's handled. In plain terms, matching what the site actually does. We never sell your data."
    >
      <h2>What we collect</h2>
      <table>
        <thead><tr><th>When</th><th>Data</th></tr></thead>
        <tbody>
          <tr><td>Creating an account</td><td>Name, email, phone (optional), password (stored as a one-way hash, so we never see or store your actual password)</td></tr>
          <tr><td>Checking out</td><td>Name, phone, email, delivery address, order contents</td></tr>
          <tr><td>Joining a drop list</td><td>Email, phone (optional), which product, and whether you agreed to hear about other launches</td></tr>
          <tr><td>Asking to be told when something is back in stock</td><td>Email, the product and size</td></tr>
          <tr><td>Sending a bulk enquiry</td><td>Name, email, phone, organisation, city and what you&apos;d like to order</td></tr>
          <tr><td>Making a payment</td><td>Handled entirely by Razorpay. We never receive or store your card, UPI or bank details</td></tr>
          <tr><td>Browsing</td><td>Your bag is kept in your browser&apos;s local storage, not on our servers, until you check out</td></tr>
        </tbody>
      </table>

      <h2>Why we collect it</h2>
      <ul>
        <li>To process and deliver your order</li>
        <li>To reply to bulk or team enquiries</li>
        <li>To email you when a product you signed up for launches (drop lists). Every email has a link to leave the list</li>
        <li>To email you once when an item you asked about is back in stock. We delete your email from that alert as soon as it&apos;s sent</li>
        <li>If you start checkout and don&apos;t finish, to send a reminder with a link back to your bag (at most one at a time; every reminder has an unsubscribe link)</li>
        <li>To ask for a review a few days after your order arrives (once per order; every email has an unsubscribe link)</li>
        <li>To check whether a first-order discount code has been used before (we keep one-way hashes of the email and phone number of each paid order, not the details themselves)</li>
        <li>To let you log in and see your order history</li>
        <li>To email order confirmations and account-related messages (password reset, email verification)</li>
        <li>To prevent fraud and abuse (e.g. detecting repeated failed login attempts)</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li><strong>Razorpay</strong> processes your payment. See their <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener">privacy policy</a>.</li>
        <li><strong>Resend</strong> sends our emails (order confirmations, password resets, drop-list and back-in-stock emails). They only receive what&apos;s needed to send that email.</li>
        <li><strong>Google Analytics</strong> and <strong>Meta (Facebook/Instagram)</strong>, only if you accept analytics cookies. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google&apos;s</a> and <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener">Meta&apos;s</a> privacy policies.</li>
        <li><strong>Shiprocket</strong> and the courier it assigns receive your name, phone, email and delivery address to deliver your parcel.</li>
        <li><strong>Netlify</strong> and <strong>Supabase</strong> host our website, functions and database.</li>
      </ul>
      <p>We do not sell your data to anyone, ever.</p>

      <h2>How long we keep it</h2>
      <p>Account and order records are kept for as long as your account exists, or as required for tax/accounting purposes. Drop-list sign-ups are kept until you leave the list. You can request deletion at any time (see below).</p>

      <h2 id="cookies">Cookies</h2>
      <p><strong>Essential:</strong> <code>egosynk_session</code>, an HttpOnly login cookie set only if you create an account or log in. Your bag and your cookie choice are kept in your browser&apos;s local storage. These are needed for the site to work and are always on.</p>
      <p><strong>Analytics &amp; advertising (only if you accept):</strong> when you press “Accept” on our cookie banner, we load Google Analytics 4 and the Meta Pixel to understand which products people view and buy, and to measure our Instagram/Facebook ads. They set their own cookies and receive data such as pages viewed, products added to the bag and purchases (order value, not your name, address or payment details). If you press “Decline”, none of this loads. You can change your choice any time via “Cookie settings” in the footer.</p>

      <h2>Your rights</h2>
      <p>You can ask us to access, correct, or delete your personal data at any time by emailing <Mail subject="Privacy request" />. We&apos;ll respond within a reasonable timeframe.</p>

      <h2>Contact</h2>
      <p>Questions about this policy: <Mail subject="Privacy" /></p>
    </LegalPage>
  );
}
