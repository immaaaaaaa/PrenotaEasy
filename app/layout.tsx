import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DynamicFavicon } from "@/components/CalendarLogo";
import { ThemeManager } from "@/components/ThemeManager";

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
    { media: "(prefers-color-scheme: light)", color: "var(--bg)" },
    { media: "(prefers-color-scheme: dark)", color: "#191019" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a light flash */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();",
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
      <body>
        <DynamicFavicon />
        <ThemeManager />
        {children}
      </body>
    </html>
  );
}
