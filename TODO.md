# EGOSYNK to-do

Last updated 22 Nov 2026. The new store is live on egosynk.com (`main`). Work in progress: branch `design-system-pages` (not pushed).

## Next to build
- [ ] **Old pages onto the design system**: bulk, `shop.html`, admin (product pages done 10 Nov; policies, contact, sign-in pages, My Account and order confirmation done 22 Nov on branch `design-system-pages`, not live yet). Invoice stays a white printable page on purpose
- [ ] **LIVE BUG (main):** order-confirmation.html crashes after payment for every order with an invoice (`viewKey` used outside `init()`), so customers see "Your order couldn't load" and the purchase isn't tracked. Payment itself is fine. Fixed on `design-system-pages`; ship that branch or hotfix main before real orders
- [ ] On the preview, signed in: check My Account (orders, tracking, exchange form) and one full test checkout to the new confirmation page
- [ ] Before merging `design-system-pages`: one real password reset and one sign-up on the preview (the forms post to the live functions, so I didn't submit them)
- [ ] EAA product page (needs the formula, flavour, size and a render)
- [x] Phone review (22 Nov): hero product art no longer sits behind the text on phones; menu, bag, policy, sign-in, product, HYDRO and BOLD pages checked at 360/390 px
- [ ] After `main` has the product-page JSON mode, remove the old-HTML fallback in `src/lib/product.ts`
- [x] Merge `storefront-next` → `main` (14 Nov) and publish (pushed 22 Nov)

## Waiting on you
- [x] **Turn off the BOLD 50 ml / 100 ml listings on the live site** (hidden 22 Nov; product pages now 404) (Admin → Products → untick "Visible on the store"): they can be bought, but the product doesn't exist yet
- [ ] One small real test order on the preview (the only checkout step not tested)
- [ ] HYDRO tub render: the label shows "200" but the launch tub is HYDRO 150. Wrong label?
- [ ] Logo pick (options A–F in `BRAND/LOGO OPTIONS`); trademark filing is missing class 3 (perfume, for BOLD)
- [ ] Real prices: HYDRO tub, shaker, bundles (now ₹299 / ₹1,799 / ₹4,199, shown as "Indicative"), BOLD 30 ml and 100 ml
- [ ] Launch date: set it in Admin → Settings → Launch countdown once the admin update is live
- [ ] EAA details: formula, flavour, pack size, servings
- [ ] WhatsApp number in Admin → Settings → Social (the chat button stays hidden until then)
- [ ] Turn on auto-renew for egosynk.com in GoDaddy
- [ ] Tell the manufacturer the batch code format, e.g. `H150-2702-01`, stamped at filling. The label's QR opens egosynk.com/batch (files in `BRAND/3d/hydro-launch/label/qr/`)
- [ ] Blender: open `BRAND/3d/hydro-launch/renders/hydro-tub-v2.blend` → File → External Data → Unpack Resources → Remove packed files → save
- [ ] After publishing: refresh link previews in Facebook's Sharing Debugger for `/hydro` and `/bold`
- [ ] Contact page: the grievance officer is "EGOSYNK Support". The e-commerce rules ask for a named person; add your name if you want to be safe
- [ ] Optional: remove the test entry egosynkteam@gmail.com in Admin → Drop lists

## Done (10 Nov 2026)
- [x] **Product pages** (`/p/<slug>`) rebuilt in the new storefront: gallery, per-size stock, size guide with "Find my size", offers, wishlist, back-in-stock alerts, delivery estimate, reviews and the review form, sticky buy bar on phones, related products. Real 308 for renamed products and real 404 for removed ones (`src/proxy.ts`), and a branded 404 page
- [x] BOLD scent page (`/bold`) and its share image; HYDRO share image rebuilt (the old one was cropped)
- [x] Launch countdown (Admin → Settings → Launch countdown)
- [x] Bag and checkout in the new storefront (drawer, codes, address, Razorpay, restore links); add to bag from product pages
- [x] Hero overlap fixes; adaptive layout and design tokens; `tests/brand.test.js` blocks hard-coded values

## Done (8 Nov 2026)
- [x] New homepage and HYDRO 150 page (Next.js), live catalog, motion, 3D tub on tap
- [x] Drop lists: admin tab, CSV, confirmation email, leave-the-list link
- [x] Email: Resend set up and egosynk.com verified (DNS at GoDaddy)
- [x] Search, WhatsApp button, star ratings
- [x] Batch lab reports: /batch pages, admin tab, PDF upload, QR on the label
- [x] Launch bundles on the HYDRO page, editable in the admin
- [x] 11 earlier updates and a security fix pushed to GitHub `main` (waiting for Netlify to publish)
