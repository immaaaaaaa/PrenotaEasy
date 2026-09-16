import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { InvitationMessage } from "./InvitationMessage";
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
      title="Il tuo invito, un nuovo inizio."
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
      <InvitationMessage />
    </AuthLayout>
  );
}
