import { createAdminClient } from "@/lib/supabase/admin";
import type { Business, Employee, Service, ServiceAddon } from "@/lib/types";

/** Per-service summary of the fixed-slot pattern for the public booking UI. */
export type FixedSlotMeta = Record<
  string,
  { weekdays: number[]; employeeIds: (string | null)[]; extraDates: string[] }
>;

/** Everything the public booking pages (/prenota/[slug] and /b/[slug]) need. */
export async function getBookingData(slug: string) {
  const supa = createAdminClient();
  const { data: business } = await supa
    .from("businesses")
    .select("*")
    .eq("slug", slug)
    .single<Business>();
  if (!business) return null;

  const [{ data: services }, { data: employees }, { data: hours }, { data: holidays }, { data: slotRows }, { data: extraRows }, { data: addonRows }] =
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
      supa
        .from("business_holidays")
        .select("start_date, end_date")
        .eq("business_id", business.id)
        .order("start_date"),
      supa
        .from("service_slots")
        .select("service_id, weekday, employee_id")
        .eq("business_id", business.id)
        .eq("active", true),
      supa
        .from("service_slot_exceptions")
        .select("service_id, date")
        .eq("business_id", business.id)
        .eq("kind", "extra"),
      supa
        .from("service_addons")
        .select("*")
        .eq("business_id", business.id)
        .eq("active", true)
        .order("sort"),
    ]);

  // Summary used by the booking UI to decide whether to show the operator
  // picker for fixed-slot services and which days of the strip to enable.
  const fixedSlotMeta: FixedSlotMeta = {};
  for (const r of slotRows ?? []) {
    const m = (fixedSlotMeta[r.service_id] ??= { weekdays: [], employeeIds: [], extraDates: [] });
    if (!m.weekdays.includes(r.weekday)) m.weekdays.push(r.weekday);
    if (!m.employeeIds.includes(r.employee_id)) m.employeeIds.push(r.employee_id);
  }
  for (const r of extraRows ?? []) {
    const m = (fixedSlotMeta[r.service_id] ??= { weekdays: [], employeeIds: [], extraDates: [] });
    if (!m.extraDates.includes(r.date)) m.extraDates.push(r.date);
  }

  // Active add-ons grouped by service
  const addonsByService: Record<string, ServiceAddon[]> = {};
  for (const a of (addonRows ?? []) as ServiceAddon[]) {
    (addonsByService[a.service_id] ??= []).push(a);
  }

  return {
    business,
    services: (services ?? []) as Service[],
    employees: (employees ?? []) as Employee[],
    closedWeekdays: (hours ?? [])
      .filter((h) => h.is_closed || !h.open_time)
      .map((h) => h.weekday as number),
    holidays: (holidays ?? []) as { start_date: string; end_date: string }[],
    fixedSlotMeta,
    addonsByService,
  };
}
