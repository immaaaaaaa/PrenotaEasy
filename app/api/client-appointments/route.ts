import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET: Fetch client's appointment history by phone and business slug
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const phone = p.get("phone");
  const slug = p.get("slug");

  if (!phone || !slug) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  const supa = createAdminClient();

  const { data: business } = await supa
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!business) {
    return NextResponse.json({ error: "Attività non trovata" }, { status: 404 });
  }

  const queryResult = await supa
    .from("appointments")
    .select("id, employee_id, starts_at, ends_at, service_name, duration_min, price_cents, status, notes, owner_notes")
    .eq("business_id", business.id)
    .eq("customer_phone", phone)
    .order("starts_at", { ascending: false });

  // Handle case where database migration for owner_notes has not run yet
  if (queryResult.error && queryResult.error.message.includes("owner_notes")) {
    const fallbackResult = await supa
      .from("appointments")
      .select("id, employee_id, starts_at, ends_at, service_name, duration_min, price_cents, status, notes")
      .eq("business_id", business.id)
      .eq("customer_phone", phone)
      .order("starts_at", { ascending: false });

    if (fallbackResult.error) {
      return NextResponse.json({ error: fallbackResult.error.message }, { status: 500 });
    }
    return NextResponse.json({ appointments: fallbackResult.data ?? [] });
  }

  if (queryResult.error) {
    return NextResponse.json({ error: queryResult.error.message }, { status: 500 });
  }

  return NextResponse.json({ appointments: queryResult.data ?? [] });
}

// POST: Securely cancel or reschedule appointment from the client view
export async function POST(req: NextRequest) {
  try {
    const { appointmentId, phone, action, newStartUtc } = await req.json();

    if (!appointmentId || !phone) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const supa = createAdminClient();

    // Verify appointment phone number matches
    const { data: appt, error: findError } = await supa
      .from("appointments")
      .select("id, customer_phone, duration_min, status")
      .eq("id", appointmentId)
      .single();

    if (findError || !appt) {
      return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
    }

    // Normalize phone numbers to perform matching
    const normalize = (p: string) => p.replace(/\D/g, "");
    if (normalize(appt.customer_phone) !== normalize(phone)) {
      return NextResponse.json({ error: "Operazione non autorizzata" }, { status: 403 });
    }

    if (action === "reschedule") {
      if (!newStartUtc) {
        return NextResponse.json({ error: "Parametri di riprogrammazione mancanti" }, { status: 400 });
      }

      const start = new Date(newStartUtc);
      const end = new Date(start.getTime() + appt.duration_min * 60 * 1000);

      const { error: updateError } = await supa
        .from("appointments")
        .update({
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          status: "booked"
        })
        .eq("id", appointmentId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } else {
      // Default: Cancel appointment
      const { error: updateError } = await supa
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }
  } catch (err) {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
