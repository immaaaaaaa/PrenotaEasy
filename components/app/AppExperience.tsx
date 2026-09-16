"use client";

import { usePathname } from "next/navigation";
import { LiquidGlassScene } from "simple-liquid-glass/backdrop";

/** One backdrop provider for each interior route; business state stays in its own view. */
export function AppExperience({ children, fontEmbedCSS }: { children: React.ReactNode; fontEmbedCSS: string }) {
  const pathname = usePathname();
  if (pathname === "/") return <>{children}</>;
  return (
    <LiquidGlassScene className="app-ui" fontEmbedCSS={fontEmbedCSS} maxCacheBytes={32 * 1024 * 1024}>
      {children}
    </LiquidGlassScene>
  );
}
