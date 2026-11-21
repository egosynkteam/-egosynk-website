import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MotionRoot } from "@/components/motion-root";
import { JsonLd, ORGANIZATION } from "@/components/json-ld";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { PromoBar } from "@/components/promo-bar";
import { offerShort, offerText } from "@/lib/product-shared";
import { getCatalog, whatsappLink, SHIPPING_FALLBACK, GIFT_FALLBACK } from "@/lib/catalog";
import { BagProvider } from "@/components/bag";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const archivo = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://egosynk.com"),
  title: { default: "EGOSYNK · Fuel, gear and scent for lifters", template: "%s · EGOSYNK" },
  description:
    "EGOSYNK makes performance gear, pre-workout and fragrance for lifters who train past the point everyone else stops. Forged in Mumbai.",
  openGraph: { siteName: "EGOSYNK", type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: BRAND.ink, viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { settings, products, offers } = await getCatalog();
  // The one coupon the admin ticked "Top bar", shown in the strip above the header.
  const top = offers?.find((o) => o.topBar);
  // Just what the bag needs to re-price a restored bag; the rest of the catalog stays on the server.
  const shop = products.map((p) => ({ id: p.id, name: p.name, cat: p.cat, price: p.price, image: p.images?.[0] || null, available: p.available !== false }));
  const fg = settings.freeGift ?? GIFT_FALLBACK;
  const ship = {
    fee: settings.shippingFee ?? SHIPPING_FALLBACK.shippingFee,
    freeOver: settings.freeShippingThreshold ?? SHIPPING_FALLBACK.freeShippingThreshold,
    // Shown in the bag only; create-order decides the gift from the server's own settings.
    gift: fg?.enabled !== false && fg?.name && fg.threshold ? { name: fg.name, threshold: fg.threshold } : null,
  };
  const whatsapp = whatsappLink(settings.social?.whatsapp, "Hi EGOSYNK, I have a question");
  return (
    <html lang="en-IN" data-promo={top ? "" : undefined} className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        <JsonLd data={ORGANIZATION} />
        <MotionRoot>
          <BagProvider products={shop} ship={ship}>
            {top && <PromoBar code={top.code} text={offerText(top)} short={offerShort(top)} />}
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
            <WhatsAppButton href={whatsapp} />
          </BagProvider>
        </MotionRoot>
        {/* The live site's cookie banner and consent settings, shared with every other page. */}
        <Script src="/consent.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
