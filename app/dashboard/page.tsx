import type { Metadata } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { requireBusiness } from "@/lib/auth";
import { zonedToUtc } from "@/lib/time";
import type { Appointment, BusinessHours, Employee, Service } from "@/lib/types";
import { AgendaView } from "./AgendaView";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const { supa, business } = await requireBusiness();

  const todayStr = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd");

  // Current-month boundaries for the initial appointments prefetch
  const y = Number(todayStr.slice(0, 4));
  const m = Number(todayStr.slice(5, 7));
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const monthStartUtc = zonedToUtc(`${y}-${String(m).padStart(2, "0")}-01`, "00:00", business.timezone).toISOString();
  const monthEndUtc = zonedToUtc(`${nextY}-${String(nextM).padStart(2, "0")}-01`, "00:00", business.timezone).toISOString();

  const [{ data: employees }, { data: services }, { data: holidays }, { data: businessHours }, { data: monthData }] = await Promise.all([
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
    supa
      .from("business_hours")
      .select("*")
      .eq("business_id", business.id)
      .order("weekday"),
    supa
      .from("appointments")
      .select("*")
      .eq("business_id", business.id)
      .neq("status", "cancelled")
      .gte("starts_at", monthStartUtc)
      .lt("starts_at", monthEndUtc)
      .order("starts_at"),
  ]);

  // Derive today's list and stats server-side: the dashboard paints with data, no client waterfall
  const initialMonthAppts = (monthData ?? []) as Appointment[];
  const initialDayAppts = initialMonthAppts.filter(
    (a) => formatInTimeZone(new Date(a.starts_at), business.timezone, "yyyy-MM-dd") === todayStr,
  );

  let newCustomersCount = 0;
  const uniquePhones = Array.from(new Set(initialDayAppts.map((a) => a.customer_phone).filter(Boolean)));
  if (uniquePhones.length > 0) {
    const dayStartUtc = zonedToUtc(todayStr, "00:00", business.timezone).toISOString();
    const { data: prior } = await supa
      .from("appointments")
      .select("customer_phone")
      .eq("business_id", business.id)
      .neq("status", "cancelled")
      .lt("starts_at", dayStartUtc)
      .in("customer_phone", uniquePhones);
    const priorSet = new Set((prior ?? []).map((p) => p.customer_phone));
    newCustomersCount = uniquePhones.filter((p) => !priorSet.has(p)).length;
  }

  const initialTodayStats = {
    apptsCount: initialDayAppts.length,
    totalRevenue: initialDayAppts.reduce((sum, a) => sum + (a.price_cents ?? 0), 0),
    newCustomersCount,
    todayAppts: initialDayAppts,
  };

  return (
    <AgendaView
      business={business}
      timezone={business.timezone}
      employees={(employees ?? []) as Employee[]}
      services={(services ?? []) as Service[]}
      todayStr={todayStr}
      holidays={(holidays ?? []) as any[]}
      businessHours={(businessHours ?? []) as BusinessHours[]}
      initialDayAppts={initialDayAppts}
      initialMonthAppts={initialMonthAppts}
      initialTodayStats={initialTodayStats}
    />
  );
}
