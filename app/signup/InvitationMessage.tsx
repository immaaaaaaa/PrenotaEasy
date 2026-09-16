import Link from "next/link";

export function InvitationMessage() {
  return (
      <div className="access-invite">
        <span className="access-state-icon material-symbols-outlined" aria-hidden="true">mail</span>
        <h3 className="text-headline font-[620]">Accesso solo su invito</h3>
        <p className="mt-2 text-[18px] text-[var(--ink-2)] leading-relaxed">
          Sei un&apos;attività partner? Contatta il tuo referente amministrativo
          per ricevere l&apos;account e iniziare la configurazione.
        </p>
        <Link
          href="/login"
          className="access-primary-link"
        >
          Vai alla pagina di login
        </Link>
      </div>
  );
}
