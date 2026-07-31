"use client";

/**
 * Dev-only visual harness for SettingsView with mock data.
 * Server actions will fail on submit (no session) — this page is for
 * checking layout and flows like the service creation wizard.
 * Renders nothing in production.
 */

import { SettingsView } from "@/app/dashboard/settings/SettingsView";
import type { Business, Employee, Service } from "@/lib/types";

const business: Business = {
  id: "dev-business",
  owner_id: null,
  name: "Salone Demo",
  slug: "demo",
  timezone: "Europe/Rome",
  phone: "+39 340 1234567",
  address: "Via Roma 1, Milano",
  slot_step_min: 30,
  booking_lead_min: 0,
  booking_horizon_days: 60,
  onboarded: true,
  created_at: new Date().toISOString(),
};

const employees: Employee[] = [
  { id: "e1", business_id: business.id, name: "Michela", color: "#8A3D6E", sort: 0, active: true, created_at: "" },
  { id: "e2", business_id: business.id, name: "Sara", color: "#B76E79", sort: 1, active: true, created_at: "" },
];

const services: Service[] = [
  { id: "s1", business_id: business.id, name: "Taglio", duration_min: 30, price_cents: 2500, sort: 0, active: true, created_at: "", booking_mode: "auto" },
  { id: "s2", business_id: business.id, name: "Microblading", duration_min: 120, price_cents: 28000, sort: 1, active: true, created_at: "", booking_mode: "fixed_slots" },
];

const hours = [0, 1, 2, 3, 4, 5, 6].map((w) => ({
  weekday: w,
  isClosed: w === 6,
  open: "08:00",
  close: w === 5 ? "13:00" : "17:00",
  breakStart: w < 5 ? "13:00" : null,
  breakEnd: w < 5 ? "14:00" : null,
}));

export default function DevSettingsPage() {
  if (process.env.NODE_ENV === "production") return null;
  return (
    <SettingsView
      business={business}
      hours={hours}
      services={services}
      employees={employees}
      initialHolidays={[]}
    />
  );
}
