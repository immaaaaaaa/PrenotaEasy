/** Friendly placeholder shown until the Supabase env vars are filled in. */
export function NotConfigured() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-[var(--r-lg)] bg-[var(--accent-soft)] text-3xl">
        🔌
      </div>
      <h1 className="text-title">Quasi pronto</h1>
      <p className="text-[var(--ink-2)]">
        Collega il database Supabase per attivare PrenotaEasy. Apri il file{" "}
        <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[0.85em]">
          .env.local
        </code>{" "}
        e inserisci le chiavi del progetto, poi riavvia il server.
      </p>
      <p className="text-caption">
        Le istruzioni complete sono nel file <strong>README.md</strong>.
      </p>
    </main>
  );
}
