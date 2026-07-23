"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtWhen, zonedToUtc } from "@/lib/time";
import {
  cancelMessage,
  normalizePhone,
  rescheduleMessage,
  waLink,
} from "@/lib/whatsapp";
import type { Appointment } from "@/lib/types";

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export async function getDayAppointments(dateStr: string): Promise<Appointment[]> {
  const { supa, business } = await requireBusiness();
  const dayStart = zonedToUtc(dateStr, "00:00", business.timezone).toISOString();
  const dayEnd = zonedToUtc(nextDay(dateStr), "00:00", business.timezone).toISOString();

  const { data } = await supa
    .from("appointments")
    .select("*")
    .eq("business_id", business.id)
    .neq("status", "cancelled")
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd)
    .order("starts_at");

  return (data ?? []) as Appointment[];
}

export async function rescheduleAppointment(input: {
  id: string;
  dateStr: string;
  timeStr: string;
  employeeId: string;
}): Promise<{ ok: boolean; error?: string; waHref?: string; whenText?: string }> {
  const { supa, business } = await requireBusiness();

  const { data: appt } = await supa
    .from("appointments")
    .select("*")
    .eq("id", input.id)
    .eq("business_id", business.id)
    .single<Appointment>();
  if (!appt) return { ok: false, error: "Appuntamento non trovato." };

  const start = zonedToUtc(input.dateStr, input.timeStr, business.timezone);
  const end = new Date(start.getTime() + appt.duration_min * 60_000);

  const { error } = await supa
    .from("appointments")
    .update({
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      employee_id: input.employeeId,
      source: "owner",
    })
    .eq("id", input.id)
    .eq("business_id", business.id);

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "L'operatore ha già un appuntamento in quell'orario." };
    }
    return { ok: false, error: "Impossibile spostare l'appuntamento." };
  }

  revalidatePath("/dashboard");
  const whenText = fmtWhen(start, business.timezone);
  const waHref = waLink(
    normalizePhone(appt.customer_phone),
    rescheduleMessage({
      customerName: appt.customer_name,
      businessName: business.name,
      serviceName: appt.service_name,
      when: whenText,
    }),
  );
  return { ok: true, whenText, waHref };
}

export async function cancelAppointment(
  id: string,
): Promise<{ ok: boolean; error?: string; waHref?: string }> {
  const { supa, business } = await requireBusiness();

  const { data: appt } = await supa
    .from("appointments")
    .select("*")
    .eq("id", id)
    .eq("business_id", business.id)
    .single<Appointment>();
  if (!appt) return { ok: false, error: "Appuntamento non trovato." };

  const { error } = await supa
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile annullare l'appuntamento." };

  revalidatePath("/dashboard");
  const waHref = waLink(
    normalizePhone(appt.customer_phone),
    cancelMessage({
      customerName: appt.customer_name,
      businessName: business.name,
      serviceName: appt.service_name,
      when: fmtWhen(new Date(appt.starts_at), business.timezone),
    }),
  );
  return { ok: true, waHref };
}

export async function createOwnerAppointment(input: {
  employeeId: string;
  serviceId: string | null;
  serviceName: string;
  durationMin: number;
  priceCents: number;
  dateStr: string;
  timeStr: string;
  customerName: string;
  customerPhone: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { supa, business } = await requireBusiness();

  if (!input.customerName.trim()) return { ok: false, error: "Inserisci il nome del cliente." };

  const start = zonedToUtc(input.dateStr, input.timeStr, business.timezone);
  const end = new Date(start.getTime() + input.durationMin * 60_000);
  const phone = normalizePhone(input.customerPhone);

  let customerId: string | null = null;
  if (phone) {
    const { data: c } = await supa
      .from("customers")
      .upsert(
        { business_id: business.id, name: input.customerName.trim(), phone },
        { onConflict: "business_id,phone" },
      )
      .select("id")
      .single();
    customerId = c?.id ?? null;
  }

  const { error } = await supa.from("appointments").insert({
    business_id: business.id,
    employee_id: input.employeeId,
    service_id: input.serviceId,
    customer_id: customerId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    source: "owner",
    service_name: input.serviceName,
    duration_min: input.durationMin,
    price_cents: input.priceCents,
    customer_name: input.customerName.trim(),
    customer_phone: phone,
    notes: input.notes?.trim() || null,
  });

  if (error) {
    if (error.code === "23P01") {
      return { ok: false, error: "L'operatore è occupato in quell'orario." };
    }
    return { ok: false, error: "Impossibile creare l'appuntamento." };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateOwnerNotes(
  id: string,
  ownerNotes: string
): Promise<{ ok: boolean; error?: string }> {
  const { supa, business } = await requireBusiness();

  const { error } = await supa
    .from("appointments")
    .update({ owner_notes: ownerNotes })
    .eq("id", id)
    .eq("business_id", business.id);

  if (error) return { ok: false, error: "Impossibile salvare le note." };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function getClients(): Promise<any[]> {
  const { supa, business } = await requireBusiness();
  const { data } = await supa
    .from("customers")
    .select("*")
    .eq("business_id", business.id)
    .order("name");
  return data ?? [];
}

export async function getClientHistory(phone: string): Promise<Appointment[]> {
  const { supa, business } = await requireBusiness();
  const { data } = await supa
    .from("appointments")
    .select("*")
    .eq("business_id", business.id)
    .eq("customer_phone", phone)
    .order("starts_at", { ascending: false });
  return (data ?? []) as Appointment[];
}

export async function logout() {
  const supa = await createClient();
  await supa.auth.signOut();
  redirect("/login");
}
