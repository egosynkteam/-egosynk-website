import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: { formats: ["image/avif", "image/webp"] },
  turbopack: {
    // The repo root has its own package.json for the Netlify functions; this app is web/.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Local preview only: anything Next doesn't serve (product pages, bag, account, policies,
  // the catalog function, consent.js) comes from the live site, so links can be clicked
  // through. The waitlist goes to a local stand-in so test sign-ups never reach real data.
  async rewrites() {
    if (!isDev) return [];
    return {
      beforeFiles: [
        { source: "/.netlify/functions/drop-waitlist", destination: "/dev-api/waitlist" },
        // Live site doesn't have /shop.html until netlify.toml ships; its homepage is the same page.
        { source: "/shop.html", destination: `${process.env.STORE_ORIGIN || "https://egosynk.com"}/` },
      ],
      afterFiles: [],
      fallback: [{ source: "/:path*", destination: `${process.env.STORE_ORIGIN || "https://egosynk.com"}/:path*` }],
    };
  },
};

export default nextConfig;
