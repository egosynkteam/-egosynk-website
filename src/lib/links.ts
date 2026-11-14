// The original store pages (bag, account, policies) are published from public/ by
// scripts/copy-legacy.mjs; product pages come from the product-page function.
export const legacy = {
  product: (slug: string) => `/p/${encodeURIComponent(slug)}`,
  // The old store page (full catalog grid) is still served at /shop.html. The bag and checkout
  // now live in this app: /#bag opens the bag drawer on any page.
  shop: "/shop.html",
  bag: "/#bag",
  account: "/account.html",
  shipping: "/shipping-policy.html",
  returns: "/refund-policy.html",
  terms: "/terms.html",
  privacy: "/privacy-policy.html",
  contact: "/contact.html",
  bulk: "/bulk.html",
};

export const WAITLIST_ENDPOINT = "/.netlify/functions/drop-waitlist";
