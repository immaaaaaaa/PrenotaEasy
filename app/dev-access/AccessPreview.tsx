"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { LoginForm } from "@/app/login/LoginForm";
import { InvitationMessage } from "@/app/signup/InvitationMessage";
import { OnboardingWizard } from "@/app/onboarding/OnboardingWizard";
import { BookingFlow } from "@/app/prenota/[slug]/BookingFlow";
import { BookingFlow as LegacyBookingFlow } from "@/app/b/[slug]/BookingFlow";
import type { Business, Employee, Service, ServiceAddon } from "@/lib/types";

// Illustrative data only. This slug and these IDs do not refer to a real activity.
const business: Business = {
  id: "preview-business-do-not-save",
  owner_id: null,
  name: "Atelier Luce · Anteprima",
  slug: "__visual-preview-not-a-real-business__",
  timezone: "Europe/Rome",
  phone: "",
  address: "",
  slot_step_min: 30,
  booking_lead_min: 0,
  booking_horizon_days: 45,
  onboarded: false,
  created_at: "2026-01-01T00:00:00Z",
};
const services: Service[] = [
  { id: "preview-service-1", business_id: business.id, name: "Taglio e piega", description: "Una consulenza dedicata, un taglio su misura e il finish che racconta il tuo stile.", duration_min: 60, price_cents: 6500, sort: 0, active: true, created_at: "", booking_mode: "auto" },
  { id: "preview-service-2", business_id: business.id, name: "Rituale viso illuminante", description: "Un momento di cura con detersione, massaggio e trattamento illuminante.", duration_min: 75, price_cents: 8500, sort: 1, active: true, created_at: "", booking_mode: "auto" },
  { id: "preview-service-3", business_id: business.id, name: "Consulenza colore", description: "Troviamo insieme la tua sfumatura, negli orari dedicati al servizio.", duration_min: 30, price_cents: 3000, sort: 2, active: true, created_at: "", booking_mode: "fixed_slots" },
];
const employees: Employee[] = [
  { id: "preview-employee-1", business_id: business.id, name: "Giulia", color: "#82627a", sort: 0, active: true, created_at: "" },
  { id: "preview-employee-2", business_id: business.id, name: "Sofia", color: "#bb8993", sort: 1, active: true, created_at: "" },
];
const addons: ServiceAddon[] = [
  { id: "preview-addon-1", business_id: business.id, service_id: services[0].id, name: "Trattamento nutriente", extra_min: 15, extra_price_cents: 1500, sort: 0, active: true, created_at: "" },
  { id: "preview-addon-2", business_id: business.id, service_id: services[0].id, name: "Massaggio del cuoio capelluto", extra_min: 10, extra_price_cents: 1000, sort: 1, active: true, created_at: "" },
];
const previews = [
  { view: "auth", label: "Accesso" },
  { view: "invite", label: "Invito" },
  { view: "onboarding", label: "Configurazione" },
  { view: "booking", label: "Prenotazione" },
  { view: "legacy", label: "Passaggi classici" },
];

export function AccessPreview({ view, todayStr }: { view: string; todayStr: string }) {
  const [blocked, setBlocked] = useState(false);
  function preventWrite(event: SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    setBlocked(true);
  }

  const props = { business, services, employees, todayStr, closedWeekdays: [6] };
  return (
    <div
      onSubmitCapture={preventWrite}
      onClickCapture={(event) => {
        const button = (event.target as HTMLElement).closest("button");
        if (button && /Crea attività|Salva configurazione|Conferma Prenotazione|Conferma Spostamento|Disdici|Scollega account/i.test(button.textContent ?? "")) preventWrite(event);
      }}
    >
      <aside style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <p style={{ marginBottom: 12 }}><strong>Anteprima di sviluppo.</strong> Dati illustrativi; accesso, salvataggi e prenotazioni sono bloccati. La disponibilità può risultare vuota.</p>
        <nav aria-label="Viste di anteprima" style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px" }}>
          {previews.map((item) => <Link key={item.view} href={`/dev-access?view=${item.view}`} aria-current={view === item.view ? "page" : undefined} style={{ textDecoration: "underline", textUnderlineOffset: 4, fontWeight: view === item.view ? 700 : 400 }}>{item.label}</Link>)}
        </nav>
        {blocked && <p role="status" style={{ marginTop: 12 }}>Azione bloccata nell&apos;anteprima: nessun dato è stato inviato.</p>}
      </aside>
      {view === "auth" && <AuthLayout title="Bentornato" subtitle="Accedi per gestire la tua attività." footer={<>Non hai un account? <Link href="/dev-access?view=invite">Registrati</Link></>}><LoginForm /></AuthLayout>}
      {view === "invite" && <AuthLayout title="Il tuo invito, un nuovo inizio." subtitle="La creazione di nuovi account è gestita dall'amministratore del servizio." footer={<>Hai già delle credenziali? <Link href="/dev-access?view=auth">Accedi</Link></>}><InvitationMessage /></AuthLayout>}
      {view === "onboarding" && <OnboardingWizard baseUrl="https://example.invalid" initialBusiness={business} />}
      {view === "booking" && <BookingFlow {...props} addonsByService={{ [services[0].id]: addons }} fixedSlotMeta={{ [services[2].id]: { weekdays: [0, 2, 4], employeeIds: [employees[0].id], extraDates: [] } }} />}
      {view === "legacy" && <LegacyBookingFlow {...props} />}
    </div>
  );
}
