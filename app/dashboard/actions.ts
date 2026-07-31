"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtWhen, zonedToUtc, dayKey, weekdayMonday0 } from "@/lib/time";
import { addDaysStr } from "@/lib/days";
import {
  cancelMessage,
  normalizePhone,
  rescheduleMessage,
  serviceLabelWithAddons,
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

export async function getMonthAppointments(
  year: number,
  month: number
): Promise<Appointment[]> {
  const { supa, business } = await requireBusiness();

  const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const nextMonthYear = month === 11 ? year + 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const endStr = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;

  const startUtc = zonedToUtc(startStr, "00:00", business.timezone).toISOString();
  const endUtc = zonedToUtc(endStr, "00:00", business.timezone).toISOString();

  const { data } = await supa
    .from("appointments")
    .select("*")
    .eq("business_id", business.id)
    .neq("status", "cancelled")
    .gte("starts_at", startUtc)
    .lt("starts_at", endUtc)
    .order("starts_at");

  return (data ?? []) as Appointment[];
}

export async function getTodayStats(todayDateStr: string): Promise<{
  apptsCount: number;
  totalRevenue: number;
  newCustomersCount: number;
  todayAppts: Appointment[];
}> {
  const { supa, business } = await requireBusiness();
  const dayStart = zonedToUtc(todayDateStr, "00:00", business.timezone).toISOString();
  const dayEnd = zonedToUtc(nextDay(todayDateStr), "00:00", business.timezone).toISOString();

  const { data: todayAppts } = await supa
    .from("appointments")
    .select("*")
    .eq("business_id", business.id)
    .neq("status", "cancelled")
    .gte("starts_at", dayStart)
    .lt("starts_at", dayEnd);

  const appts = (todayAppts ?? []) as Appointment[];
  const apptsCount = appts.length;
  const totalRevenue = appts.reduce((sum, a) => sum + a.price_cents, 0);

  let newCustomersCount = 0;
  const uniquePhones = Array.from(new Set(appts.map(a => a.customer_phone).filter(Boolean)));
  
  if (uniquePhones.length > 0) {
    const { data: priorAppts } = await supa
      .from("appointments")
      .select("customer_phone")
      .eq("business_id", business.id)
      .neq("status", "cancelled")
      .lt("starts_at", dayStart)
      .in("customer_phone", uniquePhones);

    const priorPhones = new Set((priorAppts ?? []).map(p => p.customer_phone));
    newCustomersCount = uniquePhones.filter(phone => !priorPhones.has(phone)).length;
  }

  return {
    apptsCount,
    totalRevenue,
    newCustomersCount,
    todayAppts: appts,
  };
}

export async function getAnalyticsData(): Promise<{
  revenueMonth: number;
  revenueWeek: number;
  revenueToday: number;
  
  apptsMonth: number;
  apptsWeek: number;
  apptsToday: number;
  
  employeeStats: Array<{
    id: string;
    name: string;
    color: string;
    count: number;
    revenue: number;
  }>;
  
  newClientsMonth: number;
  newClientsWeek: number;
  newClientsToday: number;
  
  avgClientsPerDay: number;
}> {
  const { supa, business } = await requireBusiness();

  const todayStr = dayKey(new Date(), business.timezone);
  const currentWd = weekdayMonday0(todayStr, business.timezone);
  const mondayStr = addDaysStr(todayStr, -currentWd);
  const startOfMonthStr = `${todayStr.slice(0, 8)}01`;

  // Calculate start and end strings timezone-aware
  const startOfTodayUtc = zonedToUtc(todayStr, "00:00", business.timezone).toISOString();
  const endOfTodayUtc = zonedToUtc(addDaysStr(todayStr, 1), "00:00", business.timezone).toISOString();

  const startOfWeekUtc = zonedToUtc(mondayStr, "00:00", business.timezone).toISOString();
  const endOfWeekUtc = zonedToUtc(addDaysStr(mondayStr, 7), "00:00", business.timezone).toISOString();

  const startOfMonthUtc = zonedToUtc(startOfMonthStr, "00:00", business.timezone).toISOString();
  const [y, m] = todayStr.split("-").map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const startOfNextMonthStr = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  const endOfMonthUtc = zonedToUtc(startOfNextMonthStr, "00:00", business.timezone).toISOString();

  const earliestUtc = startOfWeekUtc < startOfMonthUtc ? startOfWeekUtc : startOfMonthUtc;
  const latestUtc = endOfMonthUtc > endOfWeekUtc ? endOfMonthUtc : endOfWeekUtc;

  // 1. Fetch all appointments within the earliest and latest threshold window
  const { data: appts } = await supa
    .from("appointments")
    .select("*")
    .eq("business_id", business.id)
    .neq("status", "cancelled")
    .gte("starts_at", earliestUtc)
    .lt("starts_at", latestUtc)
    .order("starts_at");

  const allAppts = (appts ?? []) as Appointment[];

  const startOfMonthMs = new Date(startOfMonthUtc).getTime();
  const endOfMonthMs = new Date(endOfMonthUtc).getTime();

  const startOfWeekMs = new Date(startOfWeekUtc).getTime();
  const endOfWeekMs = new Date(endOfWeekUtc).getTime();

  const startOfTodayMs = new Date(startOfTodayUtc).getTime();
  const endOfTodayMs = new Date(endOfTodayUtc).getTime();

  // Filter in memory timezone-accurately inside closed intervals
  const monthAppts = allAppts.filter(a => {
    const t = new Date(a.starts_at).getTime();
    return t >= startOfMonthMs && t < endOfMonthMs;
  });
  const weekAppts = allAppts.filter(a => {
    const t = new Date(a.starts_at).getTime();
    return t >= startOfWeekMs && t < endOfWeekMs;
  });
  const todayAppts = allAppts.filter(a => {
    const t = new Date(a.starts_at).getTime();
    return t >= startOfTodayMs && t < endOfTodayMs;
  });

  // 2. Fetch all active employees
  const { data: employeesData } = await supa
    .from("employees")
    .select("*")
    .eq("business_id", business.id)
    .eq("active", true);
  const employees = employeesData ?? [];

  // Revenue calculation
  const revenueMonth = monthAppts.reduce((sum, a) => sum + a.price_cents, 0) / 100;
  const revenueWeek = weekAppts.reduce((sum, a) => sum + a.price_cents, 0) / 100;
  const revenueToday = todayAppts.reduce((sum, a) => sum + a.price_cents, 0) / 100;

  const apptsMonth = monthAppts.length;
  const apptsWeek = weekAppts.length;
  const apptsToday = todayAppts.length;

  // Employee stats
  const employeeMap = new Map(employees.map(e => [e.id, { name: e.name, color: e.color || "#8A3D6E", count: 0, revenue: 0 }]));
  monthAppts.forEach(a => {
    const stats = employeeMap.get(a.employee_id);
    if (stats) {
      stats.count += 1;
      stats.revenue += a.price_cents / 100;
    }
  });

  const employeeStats = Array.from(employeeMap.entries()).map(([id, s]) => ({
    id,
    name: s.name,
    color: s.color,
    count: s.count,
    revenue: s.revenue
  })).sort((a, b) => b.revenue - a.revenue);

  // New customers
  const monthPhones = Array.from(new Set(monthAppts.map(a => a.customer_phone).filter(Boolean)));
  
  let newClientsMonth = 0;
  let newClientsWeek = 0;
  let newClientsToday = 0;

  if (monthPhones.length > 0) {
    const { data: priorAppts } = await supa
      .from("appointments")
      .select("customer_phone, starts_at")
      .eq("business_id", business.id)
      .neq("status", "cancelled")
      .in("customer_phone", monthPhones)
      .lt("starts_at", startOfMonthUtc);

    const recurringPhones = new Set((priorAppts ?? []).map(p => p.customer_phone));
    const newMonthPhones = monthPhones.filter(phone => !recurringPhones.has(phone));
    newClientsMonth = newMonthPhones.length;

    const newPhonesEarliestDate = new Map<string, number>();
    monthAppts.forEach(a => {
      if (newMonthPhones.includes(a.customer_phone)) {
        const timeMs = new Date(a.starts_at).getTime();
        const existing = newPhonesEarliestDate.get(a.customer_phone);
        if (!existing || timeMs < existing) {
          newPhonesEarliestDate.set(a.customer_phone, timeMs);
        }
      }
    });

    newPhonesEarliestDate.forEach((earliestMs) => {
      if (earliestMs >= startOfWeekMs && earliestMs < endOfWeekMs) {
        newClientsWeek += 1;
      }
      if (earliestMs >= startOfTodayMs && earliestMs < endOfTodayMs) {
        newClientsToday += 1;
      }
    });
  }

  // Average customers per day (number of appointments divided by count of unique days with appointments)
  const uniqueDaysWithAppts = new Set(monthAppts.map(a => dayKey(new Date(a.starts_at), business.timezone)));
  const daysCount = uniqueDaysWithAppts.size || 1;
  const avgClientsPerDay = Math.round((apptsMonth / daysCount) * 10) / 10;

  return {
    revenueMonth,
    revenueWeek,
    revenueToday,
    apptsMonth,
    apptsWeek,
    apptsToday,
    employeeStats,
    newClientsMonth,
    newClientsWeek,
    newClientsToday,
    avgClientsPerDay,
  };
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
  if (start.getTime() < Date.now()) {
    return { ok: false, error: "Non puoi spostare un appuntamento nel passato." };
  }
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
      serviceName: serviceLabelWithAddons(appt.service_name, appt.addons),
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
      serviceName: serviceLabelWithAddons(appt.service_name, appt.addons),
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

  // 1. Update appointment
  const { data: appt, error } = await supa
    .from("appointments")
    .update({ owner_notes: ownerNotes })
    .eq("id", id)
    .eq("business_id", business.id)
    .select("customer_phone")
    .maybeSingle();

  if (error) return { ok: false, error: "Impossibile salvare le note." };

  // 2. Also mirror to general customer profile notes
  if (appt?.customer_phone) {
    await supa
      .from("customers")
      .update({ notes: ownerNotes })
      .eq("business_id", business.id)
      .eq("phone", appt.customer_phone);
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateCustomerNotes(
  customerId: string,
  notes: string
): Promise<{ ok: boolean; error?: string }> {
  const { supa, business } = await requireBusiness();

  const { error } = await supa
    .from("customers")
    .update({ notes: notes })
    .eq("id", customerId)
    .eq("business_id", business.id);

  if (error) return { ok: false, error: "Impossibile salvare le note del cliente." };

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
