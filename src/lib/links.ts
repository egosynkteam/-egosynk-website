// Store addresses. The policy pages are routes in this app; the account, bulk and old shop
// pages are still the original HTML, published from public/ by scripts/copy-legacy.mjs.
export const legacy = {
  product: (slug: string) => `/p/${encodeURIComponent(slug)}`,
  // The full catalog with filters (src/app/shop). The bag and checkout live in this app:
  // /#bag opens the bag drawer on any page.
  shop: "/shop",
  bag: "/#bag",
  account: "/account",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  shipping: "/shipping-policy",
  returns: "/refund-policy",
  terms: "/terms",
  privacy: "/privacy-policy",
  contact: "/contact",
  bulk: "/bulk",
};

export const WAITLIST_ENDPOINT = "/.netlify/functions/drop-waitlist";
