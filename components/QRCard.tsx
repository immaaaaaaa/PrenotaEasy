"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "./ui/Button";

export function QRCard({
  url,
  businessSlug,
}: {
  url: string;
  businessSlug: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function download() {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${businessSlug}.png`;
    a.click();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="card p-5 text-center">
      {/* Always dark-on-white so it scans regardless of theme. */}
      <div ref={ref} className="mx-auto w-fit rounded-[var(--r-md)] bg-[var(--surface)] p-3">
        <QRCodeCanvas value={url} size={196} level="M" marginSize={0} />
      </div>
      <p className="text-caption mt-3 break-all">{url}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" fullWidth onClick={copy}>
          {copied ? "Copiato!" : "Copia link"}
        </Button>
        <Button variant="secondary" fullWidth onClick={download}>
          Scarica QR
        </Button>
      </div>
    </div>
  );
}
