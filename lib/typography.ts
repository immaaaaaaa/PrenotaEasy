import localFont from "next/font/local";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const productFont = localFont({
  src: "../public/fonts/dm-sans-latin.woff2",
  variable: "--font-product-sans",
  weight: "400 700",
  display: "swap",
});
export const productBackdropFontCSS = `@font-face {
  font-family: ${productFont.style.fontFamily.split(",")[0]};
  font-style: normal;
  font-weight: 400 700;
  src: url(data:font/woff2;base64,${readFileSync(join(process.cwd(), "public/fonts/dm-sans-latin.woff2")).toString("base64")}) format("woff2");
}`;
