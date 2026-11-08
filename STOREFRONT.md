# EGOSYNK storefront (Next.js)

New homepage (`/`) and HYDRO 150 launch page (`/hydro`), a Next.js app in `src/`. The
original store pages (bag and checkout at `/shop.html`, account, policies, admin) stay at the
repo root and are copied into `public/` at build time by `scripts/copy-legacy.mjs`. Product
pages `/p/…` and everything else server-side stay in `netlify/functions`.

## Run it locally

```
npm install
npm run dev        # http://localhost:3000
```

In dev, the Netlify functions, product pages and uploaded media are proxied to
https://egosynk.com (see `next.config.ts`), so the catalog, product links and the bag work. "Join the drop" posts to a local
stand-in (`src/app/dev-api/waitlist`) and never touches the real list.

`STORE_ORIGIN` overrides where the catalog is read from (default `https://egosynk.com`).

## What's where

- `src/lib/catalog.ts`: reads the live catalog from the `get-catalog` function, cached for minutes
- `src/lib/hydro.ts`: HYDRO launch copy and the draft formula (from the label artwork)
- `src/components/`: hero carousel (Embla + Motion), scroll-driven HYDRO band, gear rail,
  3D tub (react-three-fiber, loaded only on `/hydro`), waitlist form
- `public/models/hydro-150.glb`: exported from `BRAND/3d/hydro-launch/renders/hydro-tub-v2.blend`
- `netlify/functions/drop-waitlist.js` + `netlify/lib/waitlist.js`: the waitlist backend
  (store `waitlist`, one record per product + email; tests in `tests/waitlist.test.js`)

## Not done yet (before this replaces the live homepage)

- Admin view and CSV export of the waitlist.
- The bag drawer and checkout live on the old homepage; the new header's bag icon links there.
