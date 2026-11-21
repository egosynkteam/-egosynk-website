// Store addresses. The policy pages are routes in this app; the account, bulk and old shop
// pages are still the original HTML, published from public/ by scripts/copy-legacy.mjs.
export const legacy = {
  product: (slug: string) => `/p/${encodeURIComponent(slug)}`,
  // The old store page (full catalog grid) is still served at /shop.html. The bag and checkout
  // now live in this app: /#bag opens the bag drawer on any page.
  shop: "/shop.html",
  bag: "/#bag",
  account: "/account.html",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  shipping: "/shipping-policy",
  returns: "/refund-policy",
  terms: "/terms",
  privacy: "/privacy-policy",
  contact: "/contact",
  bulk: "/bulk.html",
};

export const WAITLIST_ENDPOINT = "/.netlify/functions/drop-waitlist";
