# EGOSYNK to-do

Last updated 8 Nov 2026. Preview of the new store: https://storefront-next--egosynk.netlify.app (branch `storefront-next`).

## Next to build
- [ ] **BOLD scent page (`/bold`)**: hero "WEAR YOUR EGO." with the 100 ml ruby bottle and a "Notify me" drop list; the design story (three-fin E cap, clear glass, ruby juice, ml gauge); 30 ml vs 100 ml; unboxing (rigid flap box with red reveal, 30 ml carton); scent notes "revealed at launch"; FAQ. No made-up notes or prices. Then point Scent links, search and the drop-list email to `/bold`.
  - New bottle renders need Blender (heavy on memory). Ask before running, or use the existing BOLD images.
- [ ] EAA product page (needs the formula, flavour, size and a render)
- [ ] Full review of the preview on a phone
- [x] BOLD scent page (`/bold`), built 10 Nov
- [x] Launch countdown: set the date in Admin → Settings → Launch countdown
- [x] Bag and checkout moved into the new storefront (drawer, codes, address, Razorpay, restore links)

## Waiting on you
- [ ] **15 Nov:** Netlify credits reset. Publish the 12 waiting updates to egosynk.com (or upgrade Netlify to Personal, $9/month), then put the new store live in "coming soon" mode
- [ ] Real prices: HYDRO tub, shaker, and the three bundles (now ₹299 / ₹1,799 / ₹4,199, shown as "Indicative")
- [ ] Launch date (for the countdown)
- [ ] WhatsApp number in Admin → Settings → Social (the chat button stays hidden until then)
- [ ] **Turn off the BOLD 50 ml / 100 ml listings on the live site**: they can be bought, but the product doesn't exist yet
- [ ] Turn on auto-renew for egosynk.com in GoDaddy
- [ ] Optional: remove the test entry egosynkteam@gmail.com in Admin → Drop lists
- [ ] Blender: open `BRAND/3d/hydro-launch/renders/hydro-tub-v2.blend` → File → External Data → Unpack Resources → Remove packed files → save (so it uses the new label with the QR)
- [ ] Tell the manufacturer the batch code format, e.g. `H150-2702-01`, stamped at filling. The label's QR opens egosynk.com/batch (files in `BRAND/3d/hydro-launch/label/qr/`)

## Done (8 Nov 2026)
- [x] New homepage and HYDRO 150 page (Next.js), live catalog, motion, 3D tub on tap
- [x] Bag, cart-restore and "Shop" links keep working; SEO tags and share images
- [x] Drop lists: admin tab, CSV, confirmation email, leave-the-list link
- [x] Email: Resend set up and egosynk.com verified (DNS at GoDaddy)
- [x] Search, WhatsApp button, star ratings
- [x] Batch lab reports: /batch pages, admin tab, PDF upload, QR on the label
- [x] Launch bundles on the HYDRO page, editable in the admin
- [x] 11 earlier updates and a security fix pushed to GitHub `main` (waiting for Netlify to publish)
