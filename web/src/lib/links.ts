// The existing store pages (product pages, bag, account, policies) keep running from the
// original site. In production they share the domain, so plain paths work. In local dev,
// next.config.ts proxies any path Next doesn't own to egosynk.com, so the same paths work.
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
