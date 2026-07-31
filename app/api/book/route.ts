import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSlots, type DayHours } from "@/lib/availability";
import { computeFixedSlotOccurrences } from "@/lib/fixedSlots";
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
  const addonIds = Array.isArray(body.addonIds)
    ? Array.from(new Set((body.addonIds as unknown[]).map(String))).filter(Boolean)
    : [];

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
    .select("id, name, duration_min, price_cents, booking_mode")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .single();
  if (!service) {
    return NextResponse.json({ error: "Servizio non trovato" }, { status: 404 });
  }

  // Optional add-ons: recompute duration and price server-side, never trust the client
  let selectedAddons: { name: string; extra_min: number; extra_price_cents: number }[] = [];
  if (addonIds.length > 0) {
    const { data: addonRows } = await supa
      .from("service_addons")
      .select("id, name, extra_min, extra_price_cents")
      .eq("service_id", service.id)
      .eq("active", true)
      .in("id", addonIds);
    if ((addonRows ?? []).length !== addonIds.length) {
      return NextResponse.json({ error: "Supplemento non valido." }, { status: 400 });
    }
    selectedAddons = (addonRows ?? []).map((a) => ({
      name: a.name,
      extra_min: a.extra_min,
      extra_price_cents: a.extra_price_cents,
    }));
  }
  const totalDurationMin = service.duration_min + selectedAddons.reduce((s, a) => s + a.extra_min, 0);
  const totalPriceCents = service.price_cents + selectedAddons.reduce((s, a) => s + a.extra_price_cents, 0);

  const end = new Date(start.getTime() + totalDurationMin * 60_000);
  const dateStr = dayKey(start, business.timezone);

  // Load active employees once: used both for validation and candidate choice.
  const { data: activeEmps } = await supa
    .from("employees")
    .select("id")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("sort");
  const activeIds = (activeEmps ?? []).map((e) => e.id);

  let candidateIds: string[];

  if (service.booking_mode === "fixed_slots") {
    // Fixed-slot service: the instant must be one of the owner-defined
    // occurrences. Opening hours are ignored by design; holidays still block.
    const { data: holiday } = await supa
      .from("business_holidays")
      .select("id")
      .eq("business_id", business.id)
      .lte("start_date", dateStr)
      .gte("end_date", dateStr)
      .maybeSingle();
    if (holiday) {
      return NextResponse.json({ error: "Siamo chiusi in questo giorno." }, { status: 409 });
    }

    const weekday = weekdayMonday0(dateStr, business.timezone);
    const [{ data: slotRows }, { data: excRows }] = await Promise.all([
      supa.from("service_slots").select("*").eq("service_id", service.id).eq("active", true),
      supa.from("service_slot_exceptions").select("*").eq("service_id", service.id).eq("date", dateStr),
    ]);
    const occurrence = computeFixedSlotOccurrences({
      dateStr,
      tz: business.timezone,
      weekday,
      slots: (slotRows ?? []) as any[],
      exceptions: (excRows ?? []) as any[],
      nowMs: 0, // past check already done above; validate the instant only
      leadMin: 0,
    }).find((o) => o.startUtc === start.toISOString());

    if (!occurrence) {
      return NextResponse.json({ error: "Orario non disponibile." }, { status: 409 });
    }

    if (occurrence.employeeId) {
      candidateIds = activeIds.includes(occurrence.employeeId) ? [occurrence.employeeId] : [];
    } else if (employeeParam !== "any") {
      candidateIds = activeIds.includes(employeeParam) ? [employeeParam] : [];
    } else {
      candidateIds = activeIds;
    }
  } else {
    // Free availability: validate the slot really falls inside opening hours
    // and is properly aligned.
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

    candidateIds = employeeParam === "any" ? activeIds : activeIds.filter((id) => id === employeeParam);
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
      {
        error:
          selectedAddons.length > 0
            ? "Con i supplementi scelti questo orario non ha spazio sufficiente. Scegli un altro orario o togli un supplemento."
            : "Questo orario è appena stato prenotato. Scegline un altro.",
      },
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
      duration_min: totalDurationMin,
      price_cents: totalPriceCents,
      customer_name: name,
      customer_phone: phone,
      notes,
      addons: selectedAddons.length > 0 ? selectedAddons : null,
    })
    .select("id")
    .single();

  if (error) {
    // 23P01 = exclusion_violation → someone booked the same slot in the meantime.
    if (error.code === "23P01") {
      return NextResponse.json(
        {
          error:
            selectedAddons.length > 0
              ? "Con i supplementi scelti questo orario non ha spazio sufficiente. Scegli un altro orario o togli un supplemento."
              : "Questo orario è appena stato prenotato. Scegline un altro.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Errore durante la prenotazione." }, { status: 500 });
  }

  const serviceLabel =
    selectedAddons.length > 0
      ? `${service.name} + ${selectedAddons.map((a) => a.name).join(" + ")}`
      : service.name;

  return NextResponse.json({
    ok: true,
    id: appt.id,
    whenText: fmtWhen(start, business.timezone),
    serviceName: serviceLabel,
    businessName: business.name,
  });
}
