import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { QRCard } from "@/components/QRCard";
import { AppHeader, AppNav, AppPageHeading } from "@/components/app/AppChrome";
import "@/app/management-design.css";

export const metadata: Metadata = { title: "Condividi" };
export const dynamic = "force-dynamic";

export default async function SharePage() {
  const { business } = await requireBusiness();
  const url = `${siteUrl()}/b/${business.slug}`;

  return (
    <>
      <AppHeader backHref="/dashboard" />
      <AppNav label="Report e condivisione" items={[
        { label: "Analisi", icon: "insights", href: "/dashboard/analytics" },
        { label: "Condividi", icon: "qr_code_2", href: "/dashboard/share", active: true },
      ]} />
      <main className="management-page share-page">
        <AppPageHeading eyebrow={business.name} title="Un link. Porte aperte." description="Il tuo salone è a una scansione di distanza. Condividi il link o esponi il QR alla cassa." />
        <div className="share-layout">
          <QRCard url={url} businessSlug={business.slug} />
          <section className="share-instructions management-panel" aria-labelledby="sharing-title">
            <span className="management-eyebrow">PRENOTARE È SEMPLICE</span>
            <h2 id="sharing-title">Dal QR alla tua agenda.</h2>
            <ul className="share-steps">
              <li><span className="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span><div><h3>Inquadra.</h3><p>Il cliente apre la fotocamera e scansiona il codice.</p></div></li>
              <li><span className="material-symbols-outlined" aria-hidden="true">event_available</span><div><h3>Sceglie.</h3><p>Servizio, operatore e orario, in base alle disponibilità.</p></div></li>
              <li><span className="material-symbols-outlined" aria-hidden="true">check_circle</span><div><h3>È in agenda.</h3><p>Conferma con nome e numero. La prenotazione compare nel salone.</p></div></li>
            </ul>
            <a className="management-action share-preview-link" href={url} target="_blank" rel="noreferrer">Apri la pagina di prenotazione<span className="material-symbols-outlined" aria-hidden="true">north_east</span><span className="sr-only"> in una nuova scheda</span></a>
          </section>
        </div>
      </main>
    </>
  );
}
