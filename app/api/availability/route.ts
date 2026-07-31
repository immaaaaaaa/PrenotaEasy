import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeSlots,
  unionSlots,
  type BusyInterval,
  type DayHours,
  type Slot,
} from "@/lib/availability";
import { computeFixedSlotOccurrences } from "@/lib/fixedSlots";
import { weekdayMonday0, zonedToUtc } from "@/lib/time";

export const dynamic = "force-dynamic";

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const slug = p.get("slug");
  const serviceId = p.get("service");
  const employeeParam = p.get("employee") ?? "any";
  const date = p.get("date");

  if (!slug || !serviceId || !date) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const supa = createAdminClient();

  const { data: business } = await supa
    .from("businesses")
    .select("id, timezone, slot_step_min, booking_lead_min")
    .eq("slug", slug)
    .single();
  if (!business) {
    return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
  }

  // Check if date is a business holiday
  const { data: holiday } = await supa
    .from("business_holidays")
    .select("id")
    .eq("business_id", business.id)
    .lte("start_date", date)
    .gte("end_date", date)
    .maybeSingle();

  if (holiday) {
    return NextResponse.json({ slots: [], closed: true });
  }

  const { data: service } = await supa
    .from("services")
    .select("id, duration_min, booking_mode")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .single();
  if (!service) {
    return NextResponse.json({ error: "Servizio non trovato" }, { status: 404 });
  }

  // Optional add-ons: availability must fit base duration + selected extras
  const addonsParam = p.get("addons");
  let extraMin = 0;
  if (addonsParam) {
    const ids = addonsParam.split(",").filter(Boolean);
    if (ids.length > 0) {
      const { data: addonRows } = await supa
        .from("service_addons")
        .select("id, extra_min")
        .eq("service_id", service.id)
        .eq("active", true)
        .in("id", ids);
      extraMin = (addonRows ?? []).reduce((s, a) => s + a.extra_min, 0);
    }
  }
  const totalDurationMin = service.duration_min + extraMin;

  // Fixed-slot services: only the owner-defined occurrences are bookable.
  // They intentionally ignore opening hours; holidays were already handled above.
  if (service.booking_mode === "fixed_slots") {
    const fixedWeekday = weekdayMonday0(date, business.timezone);
    const [{ data: slotRows }, { data: excRows }, { data: emps }] = await Promise.all([
      supa
        .from("service_slots")
        .select("*")
        .eq("service_id", service.id)
        .eq("active", true),
      supa
        .from("service_slot_exceptions")
        .select("*")
        .eq("service_id", service.id)
        .eq("date", date),
      supa
        .from("employees")
        .select("id, name")
        .eq("business_id", business.id)
        .eq("active", true),
    ]);

    const occurrences = computeFixedSlotOccurrences({
      dateStr: date,
      tz: business.timezone,
      weekday: fixedWeekday,
      slots: (slotRows ?? []) as any[],
      exceptions: (excRows ?? []) as any[],
      nowMs: Date.now(),
      leadMin: business.booking_lead_min,
    });
    if (occurrences.length === 0) {
      return NextResponse.json({ slots: [], closed: false, fixed: true });
    }

    const activeEmps = emps ?? [];
    const empNameById = new Map(activeEmps.map((e) => [e.id, e.name]));
    const allIds = activeEmps.map((e) => e.id);
    if (allIds.length === 0) {
      return NextResponse.json({ slots: [], closed: false, fixed: true });
    }

    const fixedDayStart = zonedToUtc(date, "00:00", business.timezone).toISOString();
    const fixedDayEnd = zonedToUtc(nextDay(date), "00:00", business.timezone).toISOString();
    const { data: dayAppts } = await supa
      .from("appointments")
      .select("employee_id, starts_at, ends_at")
      .eq("business_id", business.id)
      .in("employee_id", allIds)
      .neq("status", "cancelled")
      .lt("starts_at", fixedDayEnd)
      .gt("ends_at", fixedDayStart);

    const busyByEmp = new Map<string, BusyInterval[]>();
    for (const a of dayAppts ?? []) {
      const list = busyByEmp.get(a.employee_id) ?? [];
      list.push({ start: new Date(a.starts_at).getTime(), end: new Date(a.ends_at).getTime() });
      busyByEmp.set(a.employee_id, list);
    }
    const durMs = totalDurationMin * 60_000;
    const isFree = (eid: string, sMs: number) =>
      !(busyByEmp.get(eid) ?? []).some((b) => sMs < b.end && sMs + durMs > b.start);

    const fixedSlots = occurrences.flatMap((o): Slot[] => {
      const sMs = new Date(o.startUtc).getTime();
      if (o.employeeId) {
        // Slot bound to one operator
        if (employeeParam !== "any" && employeeParam !== o.employeeId) return [];
        if (!empNameById.has(o.employeeId)) return []; // operator deactivated
        if (!isFree(o.employeeId, sMs)) return [];
        return [{
          time: o.time,
          startUtc: o.startUtc,
          employeeId: o.employeeId,
          employeeName: empNameById.get(o.employeeId) ?? null,
        }];
      }
      // "Any operator" slot: bookable if at least one candidate is free
      const candidates =
        employeeParam === "any" ? allIds : empNameById.has(employeeParam) ? [employeeParam] : [];
      if (!candidates.some((id) => isFree(id, sMs))) return [];
      return [{ time: o.time, startUtc: o.startUtc, employeeId: null, employeeName: null }];
    });

    return NextResponse.json({ slots: fixedSlots, closed: false, fixed: true });
  }

  const weekday = weekdayMonday0(date, business.timezone);
  const { data: hoursRow } = await supa
    .from("business_hours")
    .select("is_closed, open_time, close_time, break_start, break_end")
    .eq("business_id", business.id)
    .eq("weekday", weekday)
    .maybeSingle();

  if (
    !hoursRow ||
    hoursRow.is_closed ||
    !hoursRow.open_time ||
    !hoursRow.close_time
  ) {
    return NextResponse.json({ slots: [], closed: true });
  }

  let employeeIds: string[] = [];
  if (employeeParam === "any") {
    const { data: emps } = await supa
      .from("employees")
      .select("id")
      .eq("business_id", business.id)
      .eq("active", true);
    employeeIds = (emps ?? []).map((e) => e.id);
  } else {
    employeeIds = [employeeParam];
  }
  if (employeeIds.length === 0) {
    return NextResponse.json({ slots: [], closed: false });
  }

  const dayStart = zonedToUtc(date, "00:00", business.timezone).toISOString();
  const dayEnd = zonedToUtc(
    nextDay(date),
    "00:00",
    business.timezone,
  ).toISOString();

  const { data: appts } = await supa
    .from("appointments")
    .select("employee_id, starts_at, ends_at")
    .eq("business_id", business.id)
    .in("employee_id", employeeIds)
    .neq("status", "cancelled")
    .lt("starts_at", dayEnd)
    .gt("ends_at", dayStart);

  const hours: DayHours = {
    isClosed: false,
    open: hoursRow.open_time,
    close: hoursRow.close_time,
    breakStart: hoursRow.break_start,
    breakEnd: hoursRow.break_end,
  };

  const nowMs = Date.now();
  const perEmployee = employeeIds.map((eid) => {
    const busy: BusyInterval[] = (appts ?? [])
      .filter((a) => a.employee_id === eid)
      .map((a) => ({
        start: new Date(a.starts_at).getTime(),
        end: new Date(a.ends_at).getTime(),
      }));
    return computeSlots({
      dateStr: date,
      tz: business.timezone,
      hours,
      durationMin: totalDurationMin,
      stepMin: business.slot_step_min,
      busy,
      nowMs,
      leadMin: business.booking_lead_min,
    });
  });

  const slots =
    employeeParam === "any" ? unionSlots(perEmployee) : perEmployee[0];

  return NextResponse.json({ slots, closed: false });
}
