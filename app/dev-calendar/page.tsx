"use client";

/**
 * Dev-only visual harness for AgendaView with mock data.
 * Not linked anywhere; returns 404 in production.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AgendaView } from "@/app/dashboard/AgendaView";
import type { Appointment, Business, BusinessHours, Employee, Service } from "@/lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const dstr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const today = new Date();
const todayStr = dstr(today);
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return dstr(d);
};

const iso = (dateStr: string, time: string) => `${dateStr}T${time}:00+02:00`;

const business: Business = {
  id: "dev-business",
  owner_id: null,
  name: "Salone Demo",
  slug: "demo",
  timezone: "Europe/Rome",
  phone: null,
  address: null,
  slot_step_min: 30,
  booking_lead_min: 0,
  booking_horizon_days: 60,
  onboarded: true,
  created_at: new Date().toISOString(),
};

const employees: Employee[] = [
  { id: "e1", business_id: business.id, name: "Michela", color: "#7C9A6D", sort: 0, active: true, created_at: "" },
  { id: "e2", business_id: business.id, name: "Sara", color: "#C08552", sort: 1, active: true, created_at: "" },
];

const services: Service[] = [
  { id: "s1", business_id: business.id, name: "Taglio", duration_min: 30, price_cents: 2500, sort: 0, active: true, created_at: "" },
  { id: "s2", business_id: business.id, name: "Colore", duration_min: 90, price_cents: 6500, sort: 1, active: true, created_at: "" },
];

// Mon-Fri 08-17, Sat 08-13, Sun closed (weekday 0 = Monday)
const businessHours: BusinessHours[] = [0, 1, 2, 3, 4, 5, 6].map((wd) => ({
  id: `h${wd}`,
  business_id: business.id,
  weekday: wd as BusinessHours["weekday"],
  is_closed: wd === 6,
  open_time: wd === 6 ? null : "08:00:00",
  close_time: wd === 6 ? null : wd === 5 ? "13:00:00" : "17:00:00",
  break_start: null,
  break_end: null,
}));

const holidays = [
  { id: "hol1", business_id: business.id, start_date: addDays(3), end_date: addDays(4), description: "Ferie" },
];

let seq = 0;
const mkAppt = (empId: string, dateStr: string, start: string, durMin: number, name: string, svc: string): Appointment => {
  const [h, m] = start.split(":").map(Number);
  const endTotal = h * 60 + m + durMin;
  const end = `${pad(Math.floor(endTotal / 60))}:${pad(endTotal % 60)}`;
  return {
    id: `a${++seq}`,
    business_id: business.id,
    employee_id: empId,
    service_id: null,
    customer_id: null,
    starts_at: iso(dateStr, start),
    ends_at: iso(dateStr, end),
    status: "booked",
    source: "owner",
    notes: null,
    owner_notes: null,
    service_name: svc,
    duration_min: durMin,
    price_cents: 3000,
    customer_name: name,
    customer_phone: "+391234567890",
    created_at: new Date().toISOString(),
  };
};

let appts: Appointment[] = [
  mkAppt("e1", todayStr, "09:00", 60, "Anna Bianchi", "Colore"),
  mkAppt("e2", todayStr, "09:30", 60, "Giulia Verdi", "Taglio"),
  mkAppt("e1", todayStr, "12:00", 90, "Marco Rossi", "Colore"),
  mkAppt("e2", todayStr, "16:30", 60, "Elena Neri", "Taglio"),
  mkAppt("e1", addDays(1), "10:00", 30, "Paola Blu", "Taglio"),
  mkAppt("e2", addDays(2), "11:00", 60, "Chiara Rosa", "Colore"),
  mkAppt("e1", todayStr, "07:00", 45, "Fuori Orario", "Taglio"),
];

const customActions = {
  getDayAppointments: async (date: string) =>
    appts.filter((a) => a.starts_at.slice(0, 10) === date && a.status !== "cancelled"),
  getMonthAppointments: async (year: number, month: number) =>
    appts.filter((a) => {
      const d = a.starts_at.slice(0, 10);
      return Number(d.slice(0, 4)) === year && Number(d.slice(5, 7)) === month + 1 && a.status !== "cancelled";
    }),
  getTodayStats: async () => ({
    apptsCount: appts.filter((a) => a.starts_at.slice(0, 10) === todayStr).length,
    totalRevenue: 12000,
    newCustomersCount: 2,
    todayAppts: appts.filter((a) => a.starts_at.slice(0, 10) === todayStr),
  }),
  rescheduleAppointment: async ({ id, dateStr, timeStr }: any) => {
    const a = appts.find((x) => x.id === id);
    if (!a) return { ok: false, error: "Non trovato" };
    const updated = mkAppt(a.employee_id, dateStr, timeStr, a.duration_min, a.customer_name, a.service_name);
    a.starts_at = updated.starts_at;
    a.ends_at = updated.ends_at;
    return { ok: true, whenText: `${dateStr} alle ${timeStr}`, waHref: "" };
  },
  cancelAppointment: async (id: string) => {
    const a = appts.find((x) => x.id === id);
    if (a) a.status = "cancelled";
    return { ok: true, waHref: "" };
  },
  updateOwnerNotes: async () => ({ ok: true }),
  updateCustomerNotes: async () => ({ ok: true }),
  getClients: async () => [],
  getClientHistory: async () => [],
  createOwnerAppointment: async (input: any) => {
    appts.push(mkAppt(input.employeeId, input.dateStr, input.timeStr, input.durationMin, input.customerName, input.serviceName));
    return { ok: true };
  },
};

function DevCalendarInner() {
  // ?op=1 renders the calendar exactly as operator "Michela" (e1) would see it
  const searchParams = useSearchParams();
  const asOperator = searchParams.get("op") === "1";
  return (
    <AgendaView
      business={business}
      timezone={business.timezone}
      employees={employees}
      services={services}
      todayStr={todayStr}
      holidays={holidays}
      businessHours={businessHours}
      customActions={customActions}
      restrictToEmployeeId={asOperator ? "e1" : undefined}
    />
  );
}

export default function DevCalendarPage() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <Suspense>
      <DevCalendarInner />
    </Suspense>
  );
}
