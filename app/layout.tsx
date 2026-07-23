import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PrenotaEasy",
    template: "%s · PrenotaEasy",
  },
  description: "Prenota il tuo appuntamento in pochi secondi.",
  applicationName: "PrenotaEasy",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PrenotaEasy",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
