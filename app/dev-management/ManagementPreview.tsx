"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";
import { MasterView } from "@/app/master/MasterView";
import type { ActivityItem } from "@/app/master/actions";
import { AnalyticsView, type AnalyticsStats } from "@/app/dashboard/analytics/AnalyticsView";
import { AppHeader, AppPageHeading } from "@/components/app/AppChrome";
import { QRCard } from "@/components/QRCard";
import "@/app/management-design.css";

// Deliberately invalid IDs and URLs; this preview never reads a business record.
const activities: ActivityItem[] = [
  {
    id: "preview-activity-do-not-save-1", owner_id: null,
    name: "Atelier Luce · Anteprima", slug: "__preview-atelier-luce__",
    owner_email: "giulia@example.invalid", timezone: "Europe/Rome",
    phone: null, address: null, slot_step_min: 30, booking_lead_min: 0,
    booking_horizon_days: 45, onboarded: true, operator_pages_enabled: true,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "preview-activity-do-not-save-2", owner_id: null,
    name: "Studio Bellezza e Benessere di Alessandra · Anteprima",
    slug: "__preview-studio-bellezza-e-benessere__",
    owner_email: "alessandra.studio.benessere@example.invalid", timezone: "Europe/Rome",
    phone: null, address: null, slot_step_min: 30, booking_lead_min: 0,
    booking_horizon_days: 45, onboarded: false, operator_pages_enabled: false,
    created_at: "2026-01-01T00:00:00Z",
  },
];
const populatedStats: AnalyticsStats = {
  revenueMonth: 12480, revenueWeek: 3280, revenueToday: 465,
  apptsMonth: 208, apptsWeek: 54, apptsToday: 8,
  employeeStats: [
    { id: "preview-employee-1", name: "Giulia", color: "#82627a", count: 112, revenue: 6820 },
    { id: "preview-employee-2", name: "Alessandra Maria", color: "#bb8993", count: 96, revenue: 5660 },
  ],
  newClientsMonth: 26, newClientsWeek: 8, newClientsToday: 2,
  avgClientsPerDay: 9.5,
};
const emptyStats: AnalyticsStats = {
  revenueMonth: 0, revenueWeek: 0, revenueToday: 0,
  apptsMonth: 0, apptsWeek: 0, apptsToday: 0, employeeStats: [],
  newClientsMonth: 0, newClientsWeek: 0, newClientsToday: 0, avgClientsPerDay: 0,
};
const views = [
  { value: "master", label: "Attività" },
  { value: "analytics", label: "Analisi" },
  { value: "qr", label: "QR" },
];

export function ManagementPreview({ view, empty }: { view: string; empty: boolean }) {
  const selectedView = views.some((item) => item.value === view) ? view : "master";
  const [blocked, setBlocked] = useState(false);

  function preventAction(event: SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    setBlocked(true);
  }

  return (
    <div
      onSubmitCapture={preventAction}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        const link = target.closest("a");
        if (link && !link.getAttribute("href")?.startsWith("/dev-management")) {
          preventAction(event);
          return;
        }
        const button = target.closest("button");
        if (!button) return;
        // An explicit allowlist keeps server-backed buttons inert, including operator
        // loading, logout and any future management action added to MasterView.
        const visibleButton = button.cloneNode(true) as HTMLElement;
        visibleButton.querySelectorAll('[aria-hidden="true"]').forEach((icon) => icon.remove());
        const label = (button.getAttribute("aria-label") || visibleButton.textContent || "").replace(/\s+/g, " ").trim();
        const localButton = /^(Nuova attività|Crea un’attività|Annulla|Chiudi|Copia link|Copiato!|Scarica QR)$/i.test(label);
        if (!localButton) preventAction(event);
      }}
    >
      <aside style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }}>
        <p style={{ marginBottom: 12 }}><strong>Anteprima di sviluppo.</strong> Dati illustrativi. Salvataggi, accessi operatore e navigazione verso attività reali sono bloccati.</p>
        <nav aria-label="Viste di anteprima gestione" style={{ display: "flex", flexWrap: "wrap", gap: "10px 24px" }}>
          {views.map((item) => <Link key={item.value} href={`/dev-management?view=${item.value}${empty ? "&empty=1" : ""}`} aria-current={selectedView === item.value ? "page" : undefined} style={{ textDecoration: "underline", textUnderlineOffset: 4, fontWeight: selectedView === item.value ? 700 : 400 }}>{item.label}</Link>)}
          <Link href={`/dev-management?view=${selectedView}${empty ? "" : "&empty=1"}`} style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>{empty ? "Mostra dati" : "Stato vuoto"}</Link>
        </nav>
        {blocked && <p role="status" style={{ marginTop: 12 }}>Azione bloccata nell’anteprima: nessuna richiesta è stata inviata.</p>}
      </aside>
      {selectedView === "master" && <MasterView initialActivities={empty ? [] : activities} />}
      {selectedView === "analytics" && <AnalyticsView stats={empty ? emptyStats : populatedStats} />}
      {selectedView === "qr" && <>
        <AppHeader backHref="/dev-management" />
        <main className="management-page">
          <AppPageHeading eyebrow="CONDIVISIONE · ANTEPRIMA" title="Un link. Porte aperte." description="QR illustrativo, senza collegamenti a un’attività reale." />
          <div style={{ maxWidth: 640 }}><QRCard url="https://example.invalid/b/__visual-preview__" businessSlug="__visual-preview__" /></div>
        </main>
      </>}
    </div>
  );
}
