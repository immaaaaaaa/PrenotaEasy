"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { LiquidGlass } from "simple-liquid-glass";

const DESKTOP_GLASS = "(min-width: 1001px) and (pointer: fine)";
function subscribeToDesktopGlass(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_GLASS);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getDesktopGlass = () => window.matchMedia(DESKTOP_GLASS).matches;
const getServerDesktopGlass = () => false;

/** Keep the optical layer separate so native links, focus rings and type stay crisp. */
export function LandingGlass({
  children,
  className = "",
  tone = "light",
  radius = 999,
  floating = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
  radius?: number;
  floating?: boolean;
}) {
  const dark = tone === "dark";
  const desktop = useSyncExternalStore(
    subscribeToDesktopGlass,
    getDesktopGlass,
    getServerDesktopGlass,
  );
  const active = floating || desktop;
  return (
    <div
      className={`landing-glass landing-glass-${tone} ${className}`}
      data-liquid-glass-ignore={active ? "" : undefined}
      data-glass-active={active}
      style={{ borderRadius: radius }}
    >
      {active && (
        <LiquidGlass
          className="landing-glass-optics"
          aria-hidden="true"
          material="clear"
          radius={radius}
          refraction="lens"
          lensProfile="player"
          displacementScale={72}
          effectMode="auto"
          renderer={desktop ? "auto" : "webgl"}
          blur={floating ? 3 : 0.4}
          iosMinBlur={3}
          saturation={125}
          frost={0}
          glassColor={
            floating
              ? dark ? "rgba(28, 16, 27, 0.28)" : "rgba(255, 250, 247, 0.38)"
              : dark ? "rgba(28, 16, 27, 0.16)" : "rgba(255, 250, 247, 0.16)"
          }
          borderColor="rgba(255, 255, 255, 0.82)"
          aberrationIntensity={0.08}
          dispersion={35}
          quality={desktop ? "standard" : "low"}
          autoTextColor={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      )}
      <div className="landing-glass-content">{children}</div>
    </div>
  );
}
