import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[560px] flex-col px-6">
      <div className="flex flex-1 flex-col justify-center py-16">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[0.85rem] font-[560] text-[var(--accent)]">
          <span>Prenotazioni senza pensieri</span>
        </div>

        <h1 className="text-display max-w-[10ch]">
          Prenota in un attimo.
        </h1>
        <p className="mt-4 max-w-[38ch] text-[1.15rem] text-[var(--ink-2)]">
          I tuoi clienti inquadrano il QR code e prenotano in venti secondi.
          Tu gestisci agende e appuntamenti da un unico posto.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/b/demo"
            className="inline-flex h-[54px] items-center justify-center rounded-[var(--r-md)] bg-[var(--accent)] px-6 text-[1.05rem] font-[590] text-[var(--on-accent)] shadow-[var(--shadow-sm)] transition-transform duration-100 active:scale-[0.97]"
          >
            Prova la prenotazione
          </Link>
          <Link
            href="/login"
            className="inline-flex h-[54px] items-center justify-center rounded-[var(--r-md)] bg-[var(--surface-2)] px-6 text-[1.05rem] font-[590] transition-transform duration-100 active:scale-[0.97]"
          >
            Sono un&apos;attività
          </Link>
        </div>

        <ul className="mt-12 space-y-4">
          {[
            ["phone_iphone", "Zero app da scaricare", "Il cliente prenota dal browser, subito."],
            ["group", "Un’agenda per ogni operatore", "Ogni collaboratore vede i suoi appuntamenti."],
            ["chat", "Avvisi su WhatsApp", "Sposti un appuntamento? Il cliente lo sa subito."],
          ].map(([icon, title, desc]) => (
            <li key={title} className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-md)] bg-[var(--surface-2)] text-[var(--ink)]">
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </span>
              <div>
                <div className="text-headline">{title}</div>
                <div className="text-[var(--ink-2)]">{desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <footer className="pb-8 text-caption">
        PrenotaEasy · fatto per parrucchieri e centri estetici
      </footer>
    </main>
  );
}
