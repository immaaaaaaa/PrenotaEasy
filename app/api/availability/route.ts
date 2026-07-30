import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeSlots,
  unionSlots,
  type BusyInterval,
  type DayHours,
} from "@/lib/availability";
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
    .select("id, duration_min")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .single();
  if (!service) {
    return NextResponse.json({ error: "Servizio non trovato" }, { status: 404 });
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
      durationMin: service.duration_min,
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
