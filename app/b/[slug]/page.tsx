import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import type { Business, Employee, Service } from "@/lib/types";
import { BookingFlow } from "@/app/prenota/[slug]/BookingFlow";

export const dynamic = "force-dynamic";

async function getBusiness(slug: string) {
  const supa = createAdminClient();
  const { data: business } = await supa
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .single<Business>();
  if (!business) return null;

  const [{ data: services }, { data: employees }, { data: hours }] =
    await Promise.all([
      supa
        .from("services")
        .select("*")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("sort"),
      supa
        .from("employees")
        .select("*")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("sort"),
      supa
        .from("business_hours")
        .select("weekday, is_closed, open_time")
        .eq("business_id", business.id),
    ]);

  return {
    business,
    services: (services ?? []) as Service[],
    employees: (employees ?? []) as Employee[],
    closedWeekdays: (hours ?? [])
      .filter((h) => h.is_closed || !h.open_time)
      .map((h) => h.weekday as number),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "PrenotaEasy" };
  const { slug } = await params;
  const data = await getBusiness(slug);
  return {
    title: data ? `Prenota da ${data.business.name}` : "Prenota",
  };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isSupabaseConfigured()) return <NotConfigured />;

  const { slug } = await params;
  const data = await getBusiness(slug);
  if (!data) notFound();

  const { business, services, employees, closedWeekdays } = data;
  const todayStr = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd");

  return (
    <BookingFlow
      business={business}
      services={services}
      employees={employees}
      todayStr={todayStr}
      closedWeekdays={closedWeekdays}
    />
  );
}
