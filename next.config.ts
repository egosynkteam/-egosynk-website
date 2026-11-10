import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const LIVE = process.env.STORE_ORIGIN || "https://egosynk.com";

// The original store pages, published from public/ by scripts/copy-legacy.mjs. The live site
// has served them without ".html" (Netlify's pretty URLs), and those addresses are in emails,
// search results and old links, so both forms keep working.
const PAGES = [
  "account", "admin", "admin-orders", "bulk", "contact", "forgot-password", "invoice", "login",
  "order-confirmation", "privacy-policy", "refund-policy", "reset-password", "shipping-policy",
  "signup", "terms", "verify-email", "shop",
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: { formats: ["image/avif", "image/webp"] },
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    const pretty = PAGES.map((p) => ({ source: `/${p}`, destination: `/${p}.html` }));
    if (!isDev) return { beforeFiles: pretty, afterFiles: [], fallback: [] };
    // Local preview only. The Netlify functions don't run under `next dev`, so function calls
    // and uploaded media come from the live site. The waitlist goes to a local
    // stand-in so test sign-ups never reach real data.
    return {
      beforeFiles: [{ source: "/.netlify/functions/drop-waitlist", destination: "/dev-api/waitlist" }, ...pretty],
      afterFiles: [],
      fallback: [
        { source: "/.netlify/functions/:path*", destination: `${LIVE}/.netlify/functions/:path*` },
        { source: "/media/:key", destination: `${LIVE}/media/:key` },
        { source: "/og-image", destination: `${LIVE}/og-image` },
      ],
    };
  },
};

export default nextConfig;
