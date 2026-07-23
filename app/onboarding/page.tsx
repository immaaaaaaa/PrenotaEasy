import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionBusiness } from "@/lib/auth";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata: Metadata = { title: "Configura la tua attività" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const { user, business } = await getSessionBusiness();
  if (!user) redirect("/login");
  if (business && business.onboarded) redirect("/dashboard");

  return <OnboardingWizard baseUrl={siteUrl()} initialBusiness={business} />;
}
