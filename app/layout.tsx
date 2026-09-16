import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./interior.css";
import { DynamicFavicon } from "@/components/CalendarLogo";
import { AppExperience } from "@/components/app/AppExperience";
import { productFont, productBackdropFontCSS } from "@/lib/typography";

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
  colorScheme: "light",
  themeColor: "#faf8f4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* Clear legacy theme preferences; the app now always uses light mode. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.remove('dark');try{localStorage.removeItem('theme');}catch(e){}",
          }}
        />
        {/* Only the icon font: the old CSS @import also pulled two unused text fonts
            and blocked first paint on every page */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className={productFont.variable}>
        <DynamicFavicon />
        <AppExperience fontEmbedCSS={productBackdropFontCSS}>{children}</AppExperience>
      </body>
    </html>
  );
}
