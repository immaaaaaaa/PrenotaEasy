"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "./ui/Button";
import "@/app/management-design.css";

export function QRCard({ url, businessSlug }: { url: string; businessSlug: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  function download() {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `qr-${businessSlug}.png`;
    anchor.click();
  }

  async function copy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  return (
    <section className="qr-share-card" aria-label="Il tuo link di prenotazione">
      <div className="qr-share-topline"><span className="management-eyebrow">IL TUO QR</span><span className="material-symbols-outlined" aria-hidden="true">qr_code_2</span></div>
      <div className="qr-share-art">
        <div ref={ref} className="qr-share-code">
          <QRCodeCanvas value={url} size={480} level="M" marginSize={4} bgColor="#ffffff" fgColor="#392534" role="img" aria-label="QR code per prenotare nel tuo salone" />
        </div>
      </div>
      <div className="qr-share-caption"><h2>Inquadra. Prenota.</h2><p>Nessuna app da scaricare.</p></div>
      <div className="qr-share-link"><span>Link di prenotazione</span><a href={url} target="_blank" rel="noreferrer">{url}<span className="sr-only">, si apre in una nuova scheda</span></a></div>
      <div className="qr-share-actions">
        <Button variant="primary" onClick={copy}><span className="material-symbols-outlined" aria-hidden="true">{copied ? "check" : "content_copy"}</span>{copied ? "Copiato!" : "Copia link"}</Button>
        <Button variant="secondary" onClick={download}><span className="material-symbols-outlined" aria-hidden="true">download</span>Scarica QR</Button>
      </div>
      <p className={`qr-share-feedback ${copyError ? "is-error" : ""}`} role="status">{copyError ? "Copia non disponibile. Seleziona e copia il link qui sopra." : copied ? "Link copiato negli appunti." : "Pronto da condividere o stampare."}</p>
    </section>
  );
}
