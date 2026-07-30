"use server";

import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";

type Result = { ok: boolean; error?: string };

export async function updateBusinessInfo(input: {
  name: string;
  phone: string;
  address: string;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (input.name.trim().length < 2) return { ok: false, error: "Nome troppo corto." };
  const { error } = await supa
    .from("businesses")
    .update({
      name: input.name.trim(),
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
    })
    .eq("id", business.id);
  if (error) return { ok: false, error: "Impossibile salvare." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateHours(
  hours: {
    weekday: number;
    isClosed: boolean;
    open: string;
    close: string;
    breakStart: string | null;
    breakEnd: string | null;
  }[],
): Promise<Result> {
  const { supa, business } = await requireBusiness();
  const rows = hours.map((h) => ({
    business_id: business.id,
    weekday: h.weekday,
    is_closed: h.isClosed,
    open_time: h.isClosed ? null : h.open,
    close_time: h.isClosed ? null : h.close,
    break_start: h.isClosed ? null : h.breakStart || null,
    break_end: h.isClosed ? null : h.breakEnd || null,
  }));
  const { error } = await supa
    .from("business_hours")
    .upsert(rows, { onConflict: "business_id,weekday" });
  if (error) return { ok: false, error: "Impossibile salvare gli orari." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addService(input: {
  name: string;
  durationMin: number;
  priceCents: number;
  description?: string;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (!input.name.trim()) return { ok: false, error: "Nome mancante." };
  const { error } = await supa.from("services").insert({
    business_id: business.id,
    name: input.name.trim(),
    duration_min: input.durationMin,
    price_cents: input.priceCents,
    description: input.description?.trim() || null,
    sort: Math.floor(Date.now() / 1000),
  });
  if (error) return { ok: false, error: "Impossibile aggiungere il servizio." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateService(input: {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  description?: string;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  const { error } = await supa
    .from("services")
    .update({
      name: input.name.trim(),
      duration_min: input.durationMin,
      price_cents: input.priceCents,
      description: input.description?.trim() || null,
    })
    .eq("id", input.id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile salvare." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteService(id: string): Promise<Result> {
  const { supa, business } = await requireBusiness();
  // Soft-delete: keeps the definition out of lists without touching history.
  const { error } = await supa
    .from("services")
    .update({ active: false })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile eliminare." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addEmployee(name: string): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (!name.trim()) return { ok: false, error: "Nome mancante." };
  // Pick a colour based on how many the business already has.
  const { count } = await supa
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);
  const { EMPLOYEE_COLORS } = await import("@/lib/constants");
  const color = EMPLOYEE_COLORS[(count ?? 0) % EMPLOYEE_COLORS.length];
  const { error } = await supa.from("employees").insert({
    business_id: business.id,
    name: name.trim(),
    color,
    sort: Math.floor(Date.now() / 1000),
  });
  if (error) return { ok: false, error: "Impossibile aggiungere l'operatore." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateEmployee(input: {
  id: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  const { error } = await supa
    .from("employees")
    .update({ 
      name: input.name.trim(),
      avatar_url: input.avatarUrl || null
    })
    .eq("id", input.id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile salvare." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<Result> {
  const { supa, business } = await requireBusiness();
  // Soft-delete so existing appointments (ON DELETE CASCADE) are preserved.
  const { error } = await supa
    .from("employees")
    .update({ active: false })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile eliminare." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addHoliday(input: {
  startDate: string;
  endDate?: string;
  description?: string;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (!input.startDate) return { ok: false, error: "Data d'inizio mancante." };

  const start = input.startDate;
  const end = input.endDate || input.startDate;

  if (end < start) {
    return { ok: false, error: "La data di fine non può essere precedente alla data d'inizio." };
  }

  const { error } = await supa.from("business_holidays").insert({
    business_id: business.id,
    start_date: start,
    end_date: end,
    description: input.description?.trim() || null,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Questo periodo è già configurato come festivo." };
    }
    return { ok: false, error: "Impossibile aggiungere il giorno festivo." };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteHoliday(id: string): Promise<Result> {
  const { supa, business } = await requireBusiness();
  const { error } = await supa
    .from("business_holidays")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile eliminare." };
  revalidatePath("/dashboard");
  return { ok: true };
}
