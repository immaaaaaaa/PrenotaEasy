import Link from "next/link";
import { AppHeader } from "@/components/app/AppChrome";
import "@/app/access-design.css";

/** Friendly placeholder shown until the Supabase env vars are filled in. */
export function NotConfigured() {
  return (
    <div className="access-page">
      <AppHeader backHref="/" />
      <main className="access-state">
        <span className="access-state-icon material-symbols-outlined" aria-hidden="true">power</span>
        <span className="access-eyebrow">PrenotaEasy</span>
        <h1>Quasi pronto.</h1>
        <p>Stiamo preparando il tuo spazio per le prenotazioni. La configurazione del servizio deve essere completata.</p>
        <details className="access-setup-details">
          <summary>Indicazioni per l&apos;amministratore</summary>
          <p>Collega il database Supabase: inserisci le chiavi del progetto nel file <code>.env.local</code> e riavvia il server. Le istruzioni complete sono in <strong>README.md</strong>.</p>
        </details>
        <Link className="access-primary-link" href="/">Torna alla pagina iniziale <span aria-hidden="true">↗</span></Link>
      </main>
    </div>
  );
}
