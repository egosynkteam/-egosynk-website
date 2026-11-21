# EGOSYNK to-do

Last updated 22 Nov 2026. The new store is live on egosynk.com (`main`). Work in progress: branch `design-system-pages` (not pushed).

## Next to build
- [x] **Shop page** `/shop` (22 Nov): full catalog with collections, search, size/price/in-stock filters, sort, wishlist hearts; filters in the URL (`/shop?cat=sleeves`). Old `shop.html` redirects there; header Gear and every "Shop gear" button point to it
- [x] Offer strip above the header on every page (the coupon ticked "Top bar": WELCOME250), copy + close
- [x] Bulk orders page `/bulk` in the new design (22 Nov); `bulk.html` redirects
- [x] Admin restyled to the store's design system (22 Nov): 2px corners, mono uppercase buttons/labels, ink fields, store greens, 44px touch targets on phones. CSS only. Invoice stays a printable white page (product pages done 10 Nov; policies, contact, sign-in pages, My Account and order confirmation done 22 Nov on branch `design-system-pages`, not live yet). Invoice stays a white printable page on purpose
- [ ] **LIVE BUG (main):** order-confirmation.html crashes after payment for every order with an invoice (`viewKey` used outside `init()`), so customers see "Your order couldn't load" and the purchase isn't tracked. Payment itself is fine. Fixed on `design-system-pages`; ship that branch or hotfix main before real orders
- [ ] On the preview, signed in: check My Account (orders, tracking, exchange form) and one full test checkout to the new confirmation page
- [ ] Before merging `design-system-pages`: one real password reset and one sign-up on the preview (the forms post to the live functions, so I didn't submit them)
- [ ] EAA product page (needs the formula, flavour, size and a render)
- [x] Phone review (22 Nov): hero product art no longer sits behind the text on phones; menu, bag, policy, sign-in, product, HYDRO and BOLD pages checked at 360/390 px
- [x] Old-HTML fallback removed from `src/lib/product.ts` (live function answers JSON, checked 22 Nov)
- [x] Merge `storefront-next` → `main` (14 Nov) and publish (pushed 22 Nov)

## Christmas drop (set 22 Nov)
- [x] Countdown: "Christmas gear", 24 Dec 2026 00:00 IST, homepage Gear slide (live setting)
- [x] WELCOME250: ₹250 off first orders of ₹1,500+, in the top bar and on product pages (live)
- [x] Free gift: EGOSYNK 600 ml plastic shaker on orders of ₹2,500+ after discounts (Admin → Settings → Free gift). On branch, live after the push. Not on the GST invoice; ask the CA whether a free gift needs anything on the invoice
- [x] Snowfall on the homepage hero until 26 Dec (branch); Gear chip says "Drops 24 Dec" while the countdown runs
- [ ] After the push: Admin → Settings → Announcement: "Christmas gear drops 24 Dec", "WELCOME250: ₹250 off your first order over ₹1,500", "Free shaker on orders over ₹2,500", "Free shipping over ₹999"
- [x] Steel thermal shaker listed 22 Nov: ₹1,499, Accessories, NEW, render photos, shown as **Sold out** with "Notify me" (`/p/egosynk-thermal-steel-shaker-700-ml-17`). When stock arrives: Admin → Products → Mark Available
- [ ] Steel shaker: confirm the specs in its description with the manufacturer (700 ml, double-wall, whisk ball, powder pod are from our spec, not a quote); ask the CA for its HSN/GST rate (it uses the Accessories default now)
- [ ] Plastic shaker: manufacturer quote + stock before 24 Dec (spec: BRAND/3d/plastic-shaker/SPEC.md); weigh it for Shiprocket
- [ ] WhatsApp: skipped for now (button stays hidden)
- [x] Christmas gift guide `/gifts` (22 Nov): sections from the live catalog (under ₹1,000, heavy lifter, gym regular, go big + free shaker), "order by 16 Dec" countdown, homepage section and header "Gifts" link until 26 Dec (src/lib/season.ts)
- [x] Gift note at checkout: "This is a gift" + message (200 chars), shown on the receipt, in admin orders (GIFT NOTE) and in the order emails. **Print the card when packing**
- [ ] After 26 Dec: decide whether to keep /gifts up (it shows "cut-off has passed" on its own)

## Waiting on you
- [x] **Turn off the BOLD 50 ml / 100 ml listings on the live site** (hidden 22 Nov; product pages now 404) (Admin → Products → untick "Visible on the store"): they can be bought, but the product doesn't exist yet
- [ ] One small real test order on the preview (the only checkout step not tested)
- [ ] HYDRO tub render: the label shows "200" but the launch tub is HYDRO 150. Wrong label?
- [ ] Logo pick (options A–F in `BRAND/LOGO OPTIONS`); trademark filing is missing class 3 (perfume, for BOLD)
- [ ] Real prices: HYDRO tub, shaker, bundles (now ₹299 / ₹1,799 / ₹4,199, shown as "Indicative"), BOLD 30 ml and 100 ml
- [ ] EAA details: formula, flavour, pack size, servings
- [ ] Turn on auto-renew for egosynk.com in GoDaddy
- [ ] Tell the manufacturer the batch code format, e.g. `H150-2702-01`, stamped at filling. The label's QR opens egosynk.com/batch (files in `BRAND/3d/hydro-launch/label/qr/`)
- [ ] Blender: open `BRAND/3d/hydro-launch/renders/hydro-tub-v2.blend` → File → External Data → Unpack Resources → Remove packed files → save
- [ ] After publishing: refresh link previews in Facebook's Sharing Debugger for `/hydro` and `/bold`
- [x] Contact page: grievance officer named (Ashishkumar Lalbahadur Yadav, Proprietor), 22 Nov
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
