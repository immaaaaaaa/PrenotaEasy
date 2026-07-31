import { ImageResponse } from "next/og";

/**
 * Static home-screen icon (apple-touch-icon). iOS snapshots it at
 * add-to-home-screen time and never refreshes it, so this variant is
 * deliberately date-less: accent band + a minimal calendar dot grid.
 * iOS applies its own corner mask, so the artwork is full-bleed.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const DOT = 26;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
        }}
      >
        <div style={{ height: "32%", display: "flex", background: "#8A3D6E" }} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{ width: DOT, height: DOT, borderRadius: 8, background: "#3E1B33", opacity: 0.85, display: "flex" }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: DOT, height: DOT, borderRadius: 8, background: "#3E1B33", opacity: 0.85, display: "flex" }} />
            <div style={{ width: DOT, height: DOT, borderRadius: 8, background: "#8A3D6E", display: "flex" }} />
            <div style={{ width: DOT, height: DOT, borderRadius: 8, background: "#3E1B33", opacity: 0.3, display: "flex" }} />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
