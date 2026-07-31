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
  bookingMode?: "auto" | "fixed_slots";
}): Promise<Result & { id?: string }> {
  const { supa, business } = await requireBusiness();
  if (!input.name.trim()) return { ok: false, error: "Nome mancante." };
  const { data, error } = await supa
    .from("services")
    .insert({
      business_id: business.id,
      name: input.name.trim(),
      duration_min: input.durationMin,
      price_cents: input.priceCents,
      description: input.description?.trim() || null,
      booking_mode: input.bookingMode ?? "auto",
      sort: Math.floor(Date.now() / 1000),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "Impossibile aggiungere il servizio." };
  revalidatePath("/dashboard");
  return { ok: true, id: data?.id };
}

export async function updateService(input: {
  id: string;
  name: string;
  durationMin: number;
  priceCents: number;
  description?: string;
  bookingMode?: "auto" | "fixed_slots";
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  const { error } = await supa
    .from("services")
    .update({
      name: input.name.trim(),
      duration_min: input.durationMin,
      price_cents: input.priceCents,
      description: input.description?.trim() || null,
      ...(input.bookingMode ? { booking_mode: input.bookingMode } : {}),
    })
    .eq("id", input.id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile salvare." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ---- Optional add-ons ---- */

export async function getServiceAddons(serviceId: string): Promise<any[]> {
  const { supa, business } = await requireBusiness();
  const { data } = await supa
    .from("service_addons")
    .select("*")
    .eq("service_id", serviceId)
    .eq("business_id", business.id)
    .eq("active", true)
    .order("sort");
  return data ?? [];
}

export async function addServiceAddon(input: {
  serviceId: string;
  name: string;
  extraMin: number;
  extraPriceCents: number;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (!input.name.trim()) return { ok: false, error: "Nome del supplemento mancante." };
  if (input.extraMin < 0 || input.extraPriceCents < 0) {
    return { ok: false, error: "Valori non validi." };
  }
  const { error } = await supa.from("service_addons").insert({
    business_id: business.id,
    service_id: input.serviceId,
    name: input.name.trim(),
    extra_min: input.extraMin,
    extra_price_cents: input.extraPriceCents,
    sort: Math.floor(Date.now() / 1000),
  });
  if (error) return { ok: false, error: "Impossibile aggiungere il supplemento." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateServiceAddon(input: {
  id: string;
  name: string;
  extraMin: number;
  extraPriceCents: number;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (!input.name.trim()) return { ok: false, error: "Nome del supplemento mancante." };
  const { error } = await supa
    .from("service_addons")
    .update({
      name: input.name.trim(),
      extra_min: input.extraMin,
      extra_price_cents: input.extraPriceCents,
    })
    .eq("id", input.id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile salvare il supplemento." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteServiceAddon(id: string): Promise<Result> {
  const { supa, business } = await requireBusiness();
  // Soft-delete: booked appointments keep their snapshot anyway.
  const { error } = await supa
    .from("service_addons")
    .update({ active: false })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile eliminare il supplemento." };
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ---- Fixed slots (recurring pattern + per-date exceptions) ---- */

export async function getServiceSlotData(serviceId: string): Promise<{
  slots: any[];
  exceptions: any[];
}> {
  const { supa, business } = await requireBusiness();
  const [{ data: slots }, { data: exceptions }] = await Promise.all([
    supa
      .from("service_slots")
      .select("*")
      .eq("service_id", serviceId)
      .eq("business_id", business.id)
      .eq("active", true)
      .order("weekday")
      .order("start_time"),
    supa
      .from("service_slot_exceptions")
      .select("*")
      .eq("service_id", serviceId)
      .eq("business_id", business.id)
      .order("date"),
  ]);
  return { slots: slots ?? [], exceptions: exceptions ?? [] };
}

export async function addServiceSlot(input: {
  serviceId: string;
  weekday: number;
  startTime: string; // 'HH:mm'
  employeeId: string | null;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (!/^\d{2}:\d{2}$/.test(input.startTime)) return { ok: false, error: "Orario non valido." };
  if (input.weekday < 0 || input.weekday > 6) return { ok: false, error: "Giorno non valido." };
  const { error } = await supa.from("service_slots").insert({
    business_id: business.id,
    service_id: input.serviceId,
    weekday: input.weekday,
    start_time: input.startTime,
    employee_id: input.employeeId,
  });
  if (error) return { ok: false, error: "Impossibile aggiungere lo slot." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteServiceSlot(id: string): Promise<Result> {
  const { supa, business } = await requireBusiness();
  const { error } = await supa
    .from("service_slots")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile eliminare lo slot." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addSlotException(input: {
  serviceId: string;
  date: string; // YYYY-MM-DD
  kind: "removed" | "extra";
  slotId?: string | null;
  startTime?: string | null; // 'HH:mm' for 'extra'
  employeeId?: string | null;
}): Promise<Result> {
  const { supa, business } = await requireBusiness();
  if (!input.date) return { ok: false, error: "Data mancante." };
  if (input.kind === "removed" && !input.slotId) {
    return { ok: false, error: "Scegli quale slot rimuovere." };
  }
  if (input.kind === "extra" && !/^\d{2}:\d{2}$/.test(input.startTime ?? "")) {
    return { ok: false, error: "Orario non valido." };
  }
  const { error } = await supa.from("service_slot_exceptions").insert({
    business_id: business.id,
    service_id: input.serviceId,
    date: input.date,
    kind: input.kind,
    slot_id: input.kind === "removed" ? input.slotId : null,
    start_time: input.kind === "extra" ? input.startTime : null,
    employee_id: input.kind === "extra" ? (input.employeeId ?? null) : null,
  });
  if (error) return { ok: false, error: "Impossibile salvare l'eccezione." };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteSlotException(id: string): Promise<Result> {
  const { supa, business } = await requireBusiness();
  const { error } = await supa
    .from("service_slot_exceptions")
    .delete()
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) return { ok: false, error: "Impossibile eliminare l'eccezione." };
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
