"use client";

import { useEffect, useState } from "react";

const MONTHS_ABBR = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];

/** Milliseconds until just past the next local midnight. */
function msUntilNextMidnight(from: Date): number {
  const next = new Date(from);
  next.setHours(24, 0, 5, 0);
  return Math.max(1000, next.getTime() - from.getTime());
}

/**
 * Live calendar-page logo: accent band with the current month, big current
 * day below. Re-renders itself at midnight. Colors come from the palette
 * CSS variables, so dark mode is handled for free.
 */
export function CalendarLogo({ size = 48, className = "" }: { size?: number; className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Midnight timer, plus a refresh when the tab becomes visible again:
    // browsers throttle background timers, so the timer alone could fire late.
    const t = setTimeout(() => setNow(new Date()), msUntilNextMidnight(now));
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const fresh = new Date();
        if (fresh.getDate() !== now.getDate() || fresh.getMonth() !== now.getMonth()) {
          setNow(fresh);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [now]);

  return (
    <div
      role="img"
      aria-label="PrenotaEasy"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.22),
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "inset 0 0 0 1px var(--line)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      <div
        suppressHydrationWarning
        style={{
          height: "32%",
          background: "var(--accent)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(size * 0.19),
          fontWeight: 500,
          letterSpacing: size * 0.02,
          lineHeight: 1,
        }}
      >
        {MONTHS_ABBR[now.getMonth()]}
      </div>
      <div
        suppressHydrationWarning
        style={{
          flex: 1,
          background: "var(--surface)",
          color: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.round(size * 0.44),
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {now.getDate()}
      </div>
    </div>
  );
}

/**
 * Renders nothing: draws the same calendar icon on a canvas and keeps the
 * browser-tab favicon in sync with today's date. Redraws just after local
 * midnight and whenever the tab becomes visible again.
 */
export function DynamicFavicon() {
  useEffect(() => {
    let timer: number | undefined;

    const draw = () => {
      const now = new Date();
      const S = 64;
      const canvas = document.createElement("canvas");
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Rounded-square clip (fallback to a plain square on old browsers)
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(0, 0, S, S, S * 0.22);
      } else {
        ctx.rect(0, 0, S, S);
      }
      ctx.clip();

      // Body + accent band (palette colors, light variant for contrast on any tab bar)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = "#8A3D6E";
      ctx.fillRect(0, 0, S, S * 0.32);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "500 13px -apple-system, 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(MONTHS_ABBR[now.getMonth()], S / 2, S * 0.17);
      ctx.fillStyle = "#3E1B33";
      ctx.font = "800 30px -apple-system, 'Segoe UI', system-ui, sans-serif";
      ctx.fillText(String(now.getDate()), S / 2, S * 0.64);

      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-dynamic]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.setAttribute("data-dynamic", "true");
        document.head.appendChild(link);
      }
      link.type = "image/png";
      link.href = canvas.toDataURL("image/png");

      timer = window.setTimeout(draw, msUntilNextMidnight(now));
    };

    draw();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timer);
        draw();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
