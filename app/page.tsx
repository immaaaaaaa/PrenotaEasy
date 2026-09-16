import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import localFont from "next/font/local";
import { LandingPage } from "@/components/landing/LandingPage";
import "./landing.css";
import "./landing-chapters.css";

const dmSans = localFont({
  src: "../public/fonts/dm-sans-latin.woff2",
  variable: "--font-landing-sans",
  weight: "400 700",
  display: "swap",
});

// Give the refractive backdrop its local font without scanning unrelated remote CSS.
const backdropFontCSS = `@font-face {
  font-family: ${dmSans.style.fontFamily.split(",")[0]};
  font-style: normal;
  font-weight: 400 700;
  src: url(data:font/woff2;base64,${readFileSync(join(process.cwd(), "public/fonts/dm-sans-latin.woff2")).toString("base64")}) format("woff2");
}`;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: "PrenotaEasy — Più tempo per il tuo talento",
  description:
    "Il tuo salone, con un ritmo diverso. Prenotazioni online con QR code, agenda per ogni operatore e comunicazioni WhatsApp. Scopri PrenotaEasy.",
  openGraph: {
    title: "PrenotaEasy — Più tempo per il tuo talento",
    description:
      "Meno telefonate. Più spazio a quello che ami. Le prenotazioni del tuo salone, finalmente semplici.",
    locale: "it_IT",
    type: "website",
    images: [
      {
        url: "/images/salon-editorial.jpg",
        width: 1024,
        height: 1536,
        alt: "Un salone luminoso, pronto ad accogliere i suoi clienti",
      },
    ],
  },
};

export default function Home() {
  return (
    <div className={dmSans.variable}>
      <LandingPage backdropFontCSS={backdropFontCSS} />
    </div>
  );
}
