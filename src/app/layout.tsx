import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MotionRoot } from "@/components/motion-root";
import { JsonLd, ORGANIZATION } from "@/components/json-ld";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { getCatalog, whatsappLink } from "@/lib/catalog";
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

export const viewport: Viewport = { themeColor: "#0d0e10", viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { settings } = await getCatalog();
  const whatsapp = whatsappLink(settings.social?.whatsapp, "Hi EGOSYNK, I have a question");
  return (
    <html lang="en-IN" className={`${archivo.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh">
        <JsonLd data={ORGANIZATION} />
        <MotionRoot>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <WhatsAppButton href={whatsapp} />
        </MotionRoot>
        {/* The live site's cookie banner and consent settings, shared with every other page. */}
        <Script src="/consent.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
