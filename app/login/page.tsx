import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { getSessionBusiness, isMaster } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Accedi" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const { user, business } = await getSessionBusiness();
  if (user) {
    if (isMaster(user)) {
      redirect("/master");
    } else if (!business || !business.onboarded) {
      redirect("/onboarding");
    } else {
      redirect("/dashboard");
    }
  }

  return (
    <AuthLayout
      title="Bentornato"
      subtitle="Accedi per gestire la tua attività."
      footer={
        <>
          Non hai un account?{" "}
          <Link href="/signup" className="font-[560] text-[var(--accent)]">
            Registrati
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
