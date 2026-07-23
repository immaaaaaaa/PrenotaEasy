import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSlots, type DayHours } from "@/lib/availability";
import { dayKey, fmtWhen, weekdayMonday0 } from "@/lib/time";
import { normalizePhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida" }, { status: 400 });
  }

  const slug = String(body.slug ?? "");
  const serviceId = String(body.serviceId ?? "");
  const employeeParam = String(body.employeeId ?? "any");
  const startUtc = String(body.startUtc ?? "");
  const name = String(body.name ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  const notes = body.notes ? String(body.notes).trim() : null;

  if (!slug || !serviceId || !startUtc || !name || !phoneRaw) {
    return NextResponse.json({ error: "Compila tutti i campi." }, { status: 400 });
  }

  const start = new Date(startUtc);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Orario non valido." }, { status: 400 });
  }
  if (start.getTime() < Date.now() - 60_000) {
    return NextResponse.json(
      { error: "Questo orario non è più disponibile." },
      { status: 409 },
    );
  }

  const supa = createAdminClient();

  const { data: business } = await supa
    .from("businesses")
    .select("id, name, timezone")
    .eq("slug", slug)
    .single();
  if (!business) {
    return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
  }

  const { data: service } = await supa
    .from("services")
    .select("id, name, duration_min, price_cents")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .single();
  if (!service) {
    return NextResponse.json({ error: "Servizio non trovato" }, { status: 404 });
  }

  const end = new Date(start.getTime() + service.duration_min * 60_000);
  const dateStr = dayKey(start, business.timezone);

  // Validate the slot really falls inside opening hours and is properly aligned.
  const weekday = weekdayMonday0(dateStr, business.timezone);
  const { data: hoursRow } = await supa
    .from("business_hours")
    .select("is_closed, open_time, close_time, break_start, break_end")
    .eq("business_id", business.id)
    .eq("weekday", weekday)
    .maybeSingle();

  if (!hoursRow || hoursRow.is_closed || !hoursRow.open_time || !hoursRow.close_time) {
    return NextResponse.json({ error: "Siamo chiusi in questo giorno." }, { status: 409 });
  }

  const hours: DayHours = {
    isClosed: false,
    open: hoursRow.open_time,
    close: hoursRow.close_time,
    breakStart: hoursRow.break_start,
    breakEnd: hoursRow.break_end,
  };
  const validStarts = new Set(
    computeSlots({
      dateStr,
      tz: business.timezone,
      hours,
      durationMin: service.duration_min,
      stepMin: 1, // finest grid — we only need to know the instant is legal
      busy: [],
      nowMs: 0,
      leadMin: 0,
    }).map((s) => s.startUtc),
  );
  if (!validStarts.has(start.toISOString())) {
    return NextResponse.json({ error: "Orario non disponibile." }, { status: 409 });
  }

  // Determine candidate employees.
  let candidateIds: string[];
  if (employeeParam === "any") {
    const { data: emps } = await supa
      .from("employees")
      .select("id")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort");
    candidateIds = (emps ?? []).map((e) => e.id);
  } else {
    const { data: emp } = await supa
      .from("employees")
      .select("id")
      .eq("id", employeeParam)
      .eq("business_id", business.id)
      .eq("active", true)
      .maybeSingle();
    candidateIds = emp ? [emp.id] : [];
  }
  if (candidateIds.length === 0) {
    return NextResponse.json({ error: "Nessun operatore disponibile." }, { status: 409 });
  }

  // Pick an employee with no overlap at [start, end).
  const { data: overlaps } = await supa
    .from("appointments")
    .select("employee_id")
    .eq("business_id", business.id)
    .in("employee_id", candidateIds)
    .neq("status", "cancelled")
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString());
  const taken = new Set((overlaps ?? []).map((o) => o.employee_id));
  const chosen = candidateIds.find((id) => !taken.has(id));
  if (!chosen) {
    return NextResponse.json(
      { error: "Questo orario è appena stato prenotato. Scegline un altro." },
      { status: 409 },
    );
  }

  const phone = normalizePhone(phoneRaw);

  const { data: customer } = await supa
    .from("customers")
    .upsert(
      { business_id: business.id, name, phone },
      { onConflict: "business_id,phone" },
    )
    .select("id")
    .single();

  const { data: appt, error } = await supa
    .from("appointments")
    .insert({
      business_id: business.id,
      employee_id: chosen,
      service_id: service.id,
      customer_id: customer?.id ?? null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      source: "client",
      service_name: service.name,
      duration_min: service.duration_min,
      price_cents: service.price_cents,
      customer_name: name,
      customer_phone: phone,
      notes,
    })
    .select("id")
    .single();

  if (error) {
    // 23P01 = exclusion_violation → someone booked the same slot in the meantime.
    if (error.code === "23P01") {
      return NextResponse.json(
        { error: "Questo orario è appena stato prenotato. Scegline un altro." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Errore durante la prenotazione." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: appt.id,
    whenText: fmtWhen(start, business.timezone),
    serviceName: service.name,
    businessName: business.name,
  });
}
