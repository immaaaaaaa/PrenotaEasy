import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth";
import { ALL_WEEKDAYS } from "@/lib/constants";
import type { BusinessHours, Employee, Service } from "@/lib/types";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Impostazioni" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supa, business } = await requireBusiness();

  const [{ data: hoursRows }, { data: services }, { data: employees }, { data: holidays }] =
    await Promise.all([
      supa.from("business_hours").select("*").eq("business_id", business.id),
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
        .from("business_holidays")
        .select("*")
        .eq("business_id", business.id)
        .order("start_date"),
    ]);

  const byDay = new Map(
    ((hoursRows ?? []) as BusinessHours[]).map((h) => [h.weekday, h]),
  );
  const hours = ALL_WEEKDAYS.map((w) => {
    const h = byDay.get(w);
    return {
      weekday: w,
      isClosed: h ? h.is_closed : w === 6,
      open: h?.open_time?.slice(0, 5) ?? "09:00",
      close: h?.close_time?.slice(0, 5) ?? "19:00",
      breakStart: h?.break_start?.slice(0, 5) ?? null,
      breakEnd: h?.break_end?.slice(0, 5) ?? null,
    };
  });

  return (
    <SettingsView
      business={business}
      hours={hours}
      services={(services ?? []) as Service[]}
      employees={(employees ?? []) as Employee[]}
      initialHolidays={(holidays ?? []) as any[]}
    />
  );
}
