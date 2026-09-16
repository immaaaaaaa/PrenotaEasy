import type { Metadata } from "next";
import { AppHeader, AppPageHeading } from "@/components/app/AppChrome";
import "@/app/access-design.css";

export const metadata: Metadata = { title: "Informativa Privacy" };

/**
 * Minimal privacy notice for the public booking flow (GDPR artt. 13-14).
 * Each salon is the data controller; PrenotaEasy processes data on its
 * behalf to run the booking service.
 */
export default function PrivacyPage() {
  return (
    <div className="access-page"><AppHeader backHref="/" /><main className="privacy-page">
      <AppPageHeading eyebrow="I tuoi dati" title="Informativa sulla privacy" />
      <p className="text-sm text-[var(--ink-2)] mb-8">
        Informativa resa ai sensi degli artt. 13-14 del Regolamento (UE) 2016/679 (&quot;GDPR&quot;)
        per le persone che prenotano tramite PrenotaEasy.
      </p>

      <div className="privacy-sections">
        <section>
          <h2 className="text-lg font-bold mb-1.5">Titolare del trattamento</h2>
          <p>
            Il titolare del trattamento è l&apos;attività (salone, centro estetico o professionista)
            presso cui effettui la prenotazione, indicata nella pagina di prenotazione.
            PrenotaEasy tratta i dati per conto dell&apos;attività, in qualità di responsabile
            del trattamento, al solo fine di erogare il servizio di prenotazione.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-1.5">Dati raccolti e finalità</h2>
          <p>
            Raccogliamo nome, numero di telefono ed eventuali note che scegli di inserire,
            esclusivamente per gestire la tua prenotazione: conferma, promemoria, spostamenti
            e annullamenti. La base giuridica è l&apos;esecuzione di misure precontrattuali e
            contrattuali richieste dall&apos;interessato (art. 6.1.b GDPR).
          </p>
          <p className="mt-2 font-semibold">
            Ti chiediamo di non inserire nelle note dati relativi alla salute o altre
            informazioni di natura particolare (art. 9 GDPR).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-1.5">Conservazione</h2>
          <p>
            I dati sono conservati per il tempo necessario alla gestione degli appuntamenti e
            dello storico cliente dell&apos;attività, e comunque non oltre i termini previsti
            dalla normativa applicabile.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-1.5">I tuoi diritti</h2>
          <p>
            Puoi chiedere in qualsiasi momento l&apos;accesso, la rettifica o la cancellazione
            dei tuoi dati, la limitazione o l&apos;opposizione al trattamento, contattando
            direttamente l&apos;attività presso cui hai prenotato (i cui recapiti sono nella
            pagina di prenotazione). Hai inoltre diritto di proporre reclamo al Garante per la
            protezione dei dati personali.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-1.5">Dove sono trattati i dati</h2>
          <p>
            I dati sono ospitati su infrastrutture cloud (Supabase e Vercel) con misure di
            sicurezza tecniche e organizzative adeguate, inclusi isolamento per attività e
            cifratura in transito.
          </p>
        </section>
      </div>
    </main></div>
  );
}
