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

## Bag and checkout

`src/components/bag.tsx` is the bag drawer and checkout on every page of the app (header bag
button, `/#bag`, and `/?restore=<token>` from reminder emails). It uses the same
`egosynk_cart` localStorage bag as the product pages and the same functions as before
(`apply-coupon`, `me`, `create-order`, Razorpay, `/order-confirmation.html`). The old store
page is still served at `/shop.html`.

## Launch countdown

Admin → Settings → Launch countdown (date in IST, name, page). `src/components/countdown.tsx`
shows it on that page's hero slide on the homepage and on the page itself; it's hidden
while the date is empty and once it has passed.

## Design system (keep to these)

All values live as tokens in `src/app/globals.css`; components use the classes, never raw values.
`tests/brand.test.js` fails `npm test` on a hex colour, a px font size or a `vw` size in `src/`.

- **Colour:** `ink`, `surface`, `surface-2/3`, `line`, `line-2`, `bone`, `dim`, `steel`, `rust`,
  `rust-bright`, `rust-text` (small red text), `rust-dim`, `ember`, `ok`, `ok-bright`, `whatsapp`.
  Code that needs a value (Razorpay, three.js, theme colour) imports `BRAND` from `src/lib/brand.ts`.
- **Type:** rem-based, so it follows the visitor's browser text size. `text-nano/micro/small/body/lead`
  for UI; `text-display-xl/lg/md/sm`, `text-statement`, `text-stat` for headings. Display sizes are
  fluid in `cqi`: they size to the page column (`.page`, a container), not the screen.
  The hero uses `text-display-hero`, which is also capped by screen height.
- **Layout:** wrap section content in `.page` (centred, max `--container-page`, the type container)
  inside a `.gutter` section (fluid side padding, safe-area aware). Use `rounded-sharp` for corners,
  `h-(--header-h)` for the header height and the `--z-*` scale for stacking (`z-(--z-drawer)`).
- **Devices:** decide by capability, not width alone. Icon buttons add `pointer-coarse:size-11` (44px
  touch target on touch screens); `hover:` styles only apply on devices that can hover; motion
  respects `prefers-reduced-motion`; full-height sections use `dvh`.
