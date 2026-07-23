import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { getSessionBusiness, isMaster } from "@/lib/auth";

export const metadata: Metadata = { title: "Registrazione Riservata" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const { user } = await getSessionBusiness();
  if (user) {
    if (isMaster(user)) {
      redirect("/master");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <AuthLayout
      title="Registrazione Riservata"
      subtitle="La creazione di nuovi account è gestita dall'amministratore del servizio."
      footer={
        <>
          Hai già delle credenziali?{" "}
          <Link href="/login" className="font-[560] text-[var(--accent)]">
            Accedi
          </Link>
        </>
      }
    >
      <div className="rounded-[var(--r-lg)] bg-[var(--surface-2)] p-6 text-center">
        <div className="mb-3 text-4xl">✉️</div>
        <h3 className="text-headline font-[620]">Accesso solo su invito</h3>
        <p className="mt-2 text-[0.92rem] text-[var(--ink-2)] leading-relaxed">
          Sei un&apos;attività partner? Contatta il tuo referente amministrativo 
          per ricevere l&apos;account e iniziare la configurazione.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-11 items-center justify-center w-full rounded-[var(--r-md)] bg-[var(--accent)] text-[0.95rem] font-[590] text-[var(--on-accent)] transition-transform duration-100 active:scale-[0.98]"
        >
          Vai alla pagina di login
        </Link>
      </div>
    </AuthLayout>
  );
}
