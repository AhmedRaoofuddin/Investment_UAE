import type { Metadata } from "next";
import { Inter, Fraunces, Noto_Naskh_Arabic, Noto_Serif_Display } from "next/font/google";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Arabic font stack. Noto Naskh for body copy (legible at small sizes,
// widely available on MENA devices) + Noto Serif Display as the Arabic
// analog of Fraunces for serif headlines. Both loaded lazily — Latin
// pages don't fetch the Arabic subset.
const notoNaskh = Noto_Naskh_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const notoSerifDisplay = Noto_Serif_Display({
  variable: "--font-arabic-serif",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Invest UAE | AI Investment Signal Detection",
  description:
    "An AI-powered platform by the UAE Ministry of Investment for detecting early-stage investment and expansion signals from global companies in real time.",
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    title: "Invest UAE | AI Investment Signal Detection",
    description:
      "Real-time AI signal detection across global news, press releases, and financial announcements.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${notoNaskh.variable} ${notoSerifDisplay.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
