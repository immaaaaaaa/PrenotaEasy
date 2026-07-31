import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { getBookingData } from "@/lib/bookingData";
import { BookingFlow } from "@/app/prenota/[slug]/BookingFlow";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  if (!isSupabaseConfigured()) return { title: "PrenotaEasy" };
  const { slug } = await params;
  const data = await getBookingData(slug);
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
  const data = await getBookingData(slug);
  if (!data) notFound();

  const { business, services, employees, closedWeekdays, holidays, fixedSlotMeta, addonsByService } = data;
  const todayStr = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd");

  return (
    <BookingFlow
      business={business}
      services={services}
      employees={employees}
      todayStr={todayStr}
      closedWeekdays={closedWeekdays}
      holidays={holidays}
      fixedSlotMeta={fixedSlotMeta}
      addonsByService={addonsByService}
    />
  );
}
