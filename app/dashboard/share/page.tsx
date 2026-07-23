import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { QRCard } from "@/components/QRCard";

export const metadata: Metadata = { title: "Condividi" };
export const dynamic = "force-dynamic";

export default async function SharePage() {
  const { business } = await requireBusiness();
  const url = `${siteUrl()}/b/${business.slug}`;

  return (
    <main className="px-5 py-6">
      <h1 className="text-title">Condividi</h1>
      <p className="mt-2 text-[var(--ink-2)]">
        Stampa il QR e mettilo alla cassa, oppure invia il link ai clienti. Lo
        inquadrano e prenotano in autonomia.
      </p>

      <div className="mt-5">
        <QRCard url={url} businessSlug={business.slug} />
      </div>

      <div className="card mt-4 space-y-2 p-4">
        <h2 className="text-headline">Come funziona</h2>
        <ol className="ml-4 list-decimal space-y-1 text-[var(--ink-2)]">
          <li>Il cliente inquadra il QR con la fotocamera.</li>
          <li>Sceglie servizio, operatore e orario.</li>
          <li>Conferma con nome e numero. Appare subito nella tua agenda.</li>
        </ol>
      </div>
    </main>
  );
}
