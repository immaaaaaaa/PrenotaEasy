"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtWhen, zonedToUtc, dayKey } from "@/lib/time";
import { addDaysStr } from "@/lib/days";
import {
  cancelMessage,
  normalizePhone,
  rescheduleMessage,
  waLink,
} from "@/lib/whatsapp";
import type { Appointment, Employee, Service } from "@/lib/types";

function nextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Internal helper to verify token is valid and returns operator context */
async function verifyOperatorToken(token: string) {
  const adminSupa = createAdminClient();
  const { data: employee, error: empError } = await adminSupa
    .from("employees")
    .select("*")
    .eq("access_token", token)
    .single<Employee>();

  if (empError || !employee) {
    throw new Error("Token non valido o operatore non trovato.");
  }

  const { data: business, error: bizError } = await adminSupa
    .from("businesses")
    .select("*")
    .eq("id", employee.business_id)
    .single();

  if (bizError || !business || !business.operator_pages_enabled) {
    throw new Error("Funzionalità premium non abilitata per questa attività.");
  }

  return { employee, business, adminSupa };
}

export async function getOperatorAgendaData(
  token: string,
  dateStr: string,
): Promise<{
  business: any;
  employee: Employee;
  employees: Employee[];
  services: Service[];
  appointments: Appointment[];
}> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    // Fetch all active employees for scheduling columns layout
    const { data: employees } = await adminSupa
      .from("employees")
      .select("*")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort");

    // Fetch active services
    const { data: services } = await adminSupa
      .from("services")
      .select("*")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("sort");

    // Fetch day appointments ONLY for this operator
    const dayStart = zonedToUtc(dateStr, "00:00", business.timezone).toISOString();
    const dayEnd = zonedToUtc(nextDay(dateStr), "00:00", business.timezone).toISOString();

    const { data: appointments } = await adminSupa
      .from("appointments")
      .select("*")
      .eq("business_id", business.id)
      .eq("employee_id", employee.id)
      .neq("status", "cancelled")
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd)
      .order("starts_at");

    return {
      business,
      employee,
      employees: (employees ?? []) as Employee[],
      services: (services ?? []) as Service[],
      appointments: (appointments ?? []) as Appointment[],
    };
  } catch (error: any) {
    console.error("getOperatorAgendaData error:", error);
    throw new Error(error.message || "Errore di caricamento.");
  }
}

export async function getOperatorMonthAppointments(
  token: string,
  year: number,
  month: number,
): Promise<Appointment[]> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    const startStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const endStr = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;

    const startUtc = zonedToUtc(startStr, "00:00", business.timezone).toISOString();
    const endUtc = zonedToUtc(endStr, "00:00", business.timezone).toISOString();

    const { data } = await adminSupa
      .from("appointments")
      .select("*")
      .eq("business_id", business.id)
      .eq("employee_id", employee.id)
      .neq("status", "cancelled")
      .gte("starts_at", startUtc)
      .lt("starts_at", endUtc)
      .order("starts_at");

    return (data ?? []) as Appointment[];
  } catch (error) {
    console.error("getOperatorMonthAppointments error:", error);
    return [];
  }
}

export async function getOperatorTodayStats(
  token: string,
  todayDateStr: string,
): Promise<{
  apptsCount: number;
  totalRevenue: number;
  newCustomersCount: number;
  todayAppts: Appointment[];
}> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    const dayStart = zonedToUtc(todayDateStr, "00:00", business.timezone).toISOString();
    const dayEnd = zonedToUtc(nextDay(todayDateStr), "00:00", business.timezone).toISOString();

    const { data: todayAppts } = await adminSupa
      .from("appointments")
      .select("*")
      .eq("business_id", business.id)
      .eq("employee_id", employee.id)
      .neq("status", "cancelled")
      .gte("starts_at", dayStart)
      .lt("starts_at", dayEnd);

    const appts = (todayAppts ?? []) as Appointment[];
    const apptsCount = appts.length;

    // Hardcoded to 0 for operator view privacy
    const totalRevenue = 0;

    let newCustomersCount = 0;
    const uniquePhones = Array.from(new Set(appts.map(a => a.customer_phone).filter(Boolean)));
    
    if (uniquePhones.length > 0) {
      const { data: priorAppts } = await adminSupa
        .from("appointments")
        .select("customer_phone")
        .eq("business_id", business.id)
        .eq("employee_id", employee.id)
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
  } catch (error) {
    console.error("getOperatorTodayStats error:", error);
    return { apptsCount: 0, totalRevenue: 0, newCustomersCount: 0, todayAppts: [] };
  }
}

export async function operatorRescheduleAppointment(
  token: string,
  input: {
    id: string;
    dateStr: string;
    timeStr: string;
    employeeId: string;
  },
): Promise<{ ok: boolean; error?: string; waHref?: string; whenText?: string }> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    // Safeguard: Lock reschedule to the operator themselves
    if (input.employeeId !== employee.id) {
      return { ok: false, error: "Non puoi spostare appuntamenti ad altri operatori." };
    }

    const { data: appt } = await adminSupa
      .from("appointments")
      .select("*")
      .eq("id", input.id)
      .eq("business_id", business.id)
      .eq("employee_id", employee.id)
      .single<Appointment>();

    if (!appt) return { ok: false, error: "Appuntamento non trovato." };

    const start = zonedToUtc(input.dateStr, input.timeStr, business.timezone);
    const end = new Date(start.getTime() + appt.duration_min * 60_000);

    const { error } = await adminSupa
      .from("appointments")
      .update({
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        employee_id: employee.id,
        source: "owner",
      })
      .eq("id", input.id)
      .eq("business_id", business.id)
      .eq("employee_id", employee.id);

    if (error) {
      if (error.code === "23P01") {
        return { ok: false, error: "Hai già un appuntamento in quell'orario." };
      }
      return { ok: false, error: "Impossibile spostare l'appuntamento." };
    }

    revalidatePath(`/op/${token}`);
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
  } catch (error: any) {
    console.error("operatorRescheduleAppointment error:", error);
    return { ok: false, error: error.message || "Errore." };
  }
}

export async function operatorCancelAppointment(
  token: string,
  id: string,
): Promise<{ ok: boolean; error?: string; waHref?: string }> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    const { data: appt } = await adminSupa
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("business_id", business.id)
      .eq("employee_id", employee.id)
      .single<Appointment>();

    if (!appt) return { ok: false, error: "Appuntamento non trovato." };

    const { error } = await adminSupa
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("business_id", business.id)
      .eq("employee_id", employee.id);

    if (error) return { ok: false, error: "Impossibile annullare l'appuntamento." };

    revalidatePath(`/op/${token}`);
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
  } catch (error: any) {
    console.error("operatorCancelAppointment error:", error);
    return { ok: false, error: error.message || "Errore." };
  }
}

export async function operatorUpdateOwnerNotes(
  token: string,
  id: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    const { error } = await adminSupa
      .from("appointments")
      .update({ owner_notes: notes.trim() })
      .eq("id", id)
      .eq("business_id", business.id)
      .eq("employee_id", employee.id);

    if (error) throw error;
    revalidatePath(`/op/${token}`);
    return { ok: true };
  } catch (error: any) {
    console.error("operatorUpdateOwnerNotes error:", error);
    return { ok: false, error: error.message || "Errore di salvataggio note." };
  }
}

export async function operatorGetClients(token: string): Promise<any[]> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    // Get unique phone numbers of clients booked with this employee
    const { data: bookings } = await adminSupa
      .from("appointments")
      .select("customer_phone")
      .eq("business_id", business.id)
      .eq("employee_id", employee.id);

    const phones = Array.from(new Set((bookings ?? []).map(b => b.customer_phone).filter(Boolean)));
    if (phones.length === 0) return [];

    // Select the client details for these phone numbers
    const { data: clients } = await adminSupa
      .from("customers")
      .select("*")
      .eq("business_id", business.id)
      .in("phone", phones)
      .order("name");

    return clients || [];
  } catch (error) {
    console.error("operatorGetClients error:", error);
    return [];
  }
}

export async function operatorGetClientHistory(
  token: string,
  phone: string,
): Promise<Appointment[]> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    const { data } = await adminSupa
      .from("appointments")
      .select("*")
      .eq("business_id", business.id)
      .eq("employee_id", employee.id)
      .eq("customer_phone", phone)
      .order("starts_at", { ascending: false });

    return (data ?? []) as Appointment[];
  } catch (error) {
    console.error("operatorGetClientHistory error:", error);
    return [];
  }
}

export async function operatorUpdateCustomerNotes(
  token: string,
  customerId: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    // Verify client belongs to business
    const { data: client } = await adminSupa
      .from("customers")
      .select("phone")
      .eq("id", customerId)
      .eq("business_id", business.id)
      .single();

    if (!client) return { ok: false, error: "Cliente non trovato." };

    // Verify operator has booked with this client phone
    const { data: hasBooking } = await adminSupa
      .from("appointments")
      .select("id")
      .eq("business_id", business.id)
      .eq("employee_id", employee.id)
      .eq("customer_phone", client.phone)
      .limit(1)
      .maybeSingle();

    if (!hasBooking) {
      return { ok: false, error: "Non autorizzato ad aggiornare note per questo cliente." };
    }

    const { error } = await adminSupa
      .from("customers")
      .update({ notes: notes.trim() })
      .eq("id", customerId)
      .eq("business_id", business.id);

    if (error) throw error;
    return { ok: true };
  } catch (error: any) {
    console.error("operatorUpdateCustomerNotes error:", error);
    return { ok: false, error: error.message || "Errore." };
  }
}

export async function operatorCreateOwnerAppointment(
  token: string,
  input: {
    employeeId: string;
    serviceId: string | null;
    serviceName: string;
    durationMin: number;
    priceCents: number;
    dateStr: string;
    timeStr: string;
    customerName: string;
    customerPhone: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { employee, business, adminSupa } = await verifyOperatorToken(token);

    // Safeguard: Lock creation to the operator themselves
    if (input.employeeId !== employee.id) {
      return { ok: false, error: "Non puoi creare appuntamenti per altri operatori." };
    }

    if (!input.customerName.trim()) return { ok: false, error: "Inserisci il nome del cliente." };

    const start = zonedToUtc(input.dateStr, input.timeStr, business.timezone);
    const end = new Date(start.getTime() + input.durationMin * 60_000);
    const phone = normalizePhone(input.customerPhone);

    let customerId: string | null = null;
    if (phone) {
      const { data: c } = await adminSupa
        .from("customers")
        .upsert(
          { business_id: business.id, name: input.customerName.trim(), phone },
          { onConflict: "business_id,phone" },
        )
        .select("id")
        .single();
      if (c) customerId = c.id;
    }

    const { error } = await adminSupa.from("appointments").insert({
      business_id: business.id,
      employee_id: employee.id,
      service_id: input.serviceId,
      customer_id: customerId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: "booked",
      source: "owner",
      customer_name: input.customerName.trim(),
      customer_phone: phone,
      service_name: input.serviceName,
      duration_min: input.durationMin,
      price_cents: input.priceCents,
    });

    if (error) {
      if (error.code === "23P01") {
        return { ok: false, error: "Hai già un appuntamento in quell'orario." };
      }
      return { ok: false, error: "Impossibile creare l'appuntamento." };
    }

    revalidatePath(`/op/${token}`);
    return { ok: true };
  } catch (error: any) {
    console.error("operatorCreateOwnerAppointment error:", error);
    return { ok: false, error: error.message || "Errore." };
  }
}
