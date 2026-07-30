import type { Metadata } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { requireBusiness } from "@/lib/auth";
import type { Employee, Service } from "@/lib/types";
import { AgendaView } from "./AgendaView";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const { supa, business } = await requireBusiness();

  const [{ data: employees }, { data: services }, { data: holidays }] = await Promise.all([
    supa
      .from("employees")
      .select("*")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort"),
    supa
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort"),
    supa
      .from("business_holidays")
      .select("*")
      .eq("business_id", business.id)
      .order("start_date"),
  ]);

  const todayStr = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd");

  return (
    <AgendaView
      business={business}
      timezone={business.timezone}
      employees={(employees ?? []) as Employee[]}
      services={(services ?? []) as Service[]}
      todayStr={todayStr}
      holidays={(holidays ?? []) as any[]}
    />
  );
}
