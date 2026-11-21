import type { Product } from "./catalog-shared";

// The Christmas season on the storefront: snow on the hero, the gift guide (/gifts), its
// homepage section and the "Gifts" link in the header. All of it switches itself off after
// Boxing Day, so nothing needs undoing.
export const SEASON = { from: Date.parse("2026-11-22T00:00:00+05:30"), to: Date.parse("2026-12-26T23:59:59+05:30") };
export const isFestive = (now: number) => now >= SEASON.from && now <= SEASON.to;

// Last day to order for delivery before Christmas: 1–2 days to dispatch + 3–7 to deliver
// (shipping policy) from the 16th still lands by the 25th for most pincodes.
export const ORDER_BY = Date.parse("2026-12-16T23:59:59+05:30");
export const ORDER_BY_LABEL = "16 December";

// Gift guide sections, built from the live catalog by rule (no product ids hardcoded), so
// new products, price changes and sold-out items flow in by themselves.
export type GiftSection = { id: string; eyebrow: string; title: string; body: string; pick: (p: Product) => boolean; max: number };
export const GIFT_SECTIONS: GiftSection[] = [
  { id: "fillers", eyebrow: "Under ₹1,000", title: "Stocking fillers", body: "Small, useful, actually worn. Grip socks, wraps, sleeves and grips.",
    pick: (p) => p.price < 1000, max: 8 },
  { id: "lifter", eyebrow: "For the heavy lifter", title: "Built for the big three", body: "Belts, grips, wraps and compression sleeves for the one who lives under a barbell.",
    pick: (p) => p.cat === "accessories" || p.cat === "sleeves", max: 8 },
  { id: "regular", eyebrow: "For the gym regular", title: "Kit they'll wear every session", body: "Compression tees, leggings, shorts and trunks that go from warm-up to last set.",
    pick: (p) => ["compression", "bottoms", "innerwear"].includes(p.cat), max: 8 },
  { id: "big", eyebrow: "Go big", title: "The ones they'll remember", body: "Our best pieces. Spend over the free-gift line and a shaker comes free in the box.",
    pick: (p) => p.price >= 1400, max: 8 },
];
