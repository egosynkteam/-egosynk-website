// The original store pages (bag, account, policies) are published from public/ by
// scripts/copy-legacy.mjs; product pages come from the product-page function.
export const legacy = {
  product: (slug: string) => `/p/${encodeURIComponent(slug)}`,
  // The bag, coupons and checkout stay on the original store page, served at /shop.html.
  shop: "/shop.html",
  bag: "/shop.html#bag",
  account: "/account.html",
  shipping: "/shipping-policy.html",
  returns: "/refund-policy.html",
  terms: "/terms.html",
  privacy: "/privacy-policy.html",
  contact: "/contact.html",
  bulk: "/bulk.html",
};

export const WAITLIST_ENDPOINT = "/.netlify/functions/drop-waitlist";
