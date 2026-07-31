import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { getOperatorAgendaData } from "../actions";
import { OperatorClientView } from "./OperatorClientView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  try {
    const data = await getOperatorAgendaData(token, new Date().toISOString().slice(0, 10));
    return {
      title: `Agenda: ${data.employee.name} — PrenotaEasy`,
    };
  } catch {
    return { title: "Agenda Operatore — PrenotaEasy" };
  }
}

export default async function OperatorAgendaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let data;
  const fetchedForDate = new Date().toISOString().slice(0, 10);
  try {
    data = await getOperatorAgendaData(token, fetchedForDate);
  } catch (err: any) {
    if (err.message?.includes("Premium") || err.message?.includes("premium")) {
      return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full text-center space-y-4 bg-[var(--surface)]/70 backdrop-blur-md p-8 rounded-3xl border border-[var(--ink)]/10 shadow-lg">
            <span className="material-symbols-outlined text-5xl text-[var(--accent)] animate-pulse">workspace_premium</span>
            <h1 className="font-serif text-2xl font-bold text-[var(--ink)]">Feature Premium Disattivata</h1>
            <p className="text-sm text-[var(--ink-2)] leading-relaxed">
              La visualizzazione delle agende dello staff per questa attività richiede un abbonamento premium attivo.
            </p>
            <p className="text-xs text-[var(--ink-2)]/70 italic">
              Contatta l&apos;amministratore dell&apos;attività per riattivare il servizio.
            </p>
          </div>
        </div>
      );
    }
    notFound();
  }

  const { business, employee, employees, services, businessHours, holidays } = data;
  const todayStr = formatInTimeZone(new Date(), business.timezone, "yyyy-MM-dd");

  return (
    <OperatorClientView
      token={token}
      business={business}
      employee={employee}
      employees={employees}
      services={services}
      todayStr={todayStr}
      businessHours={businessHours}
      holidays={holidays}
      initialDayAppts={fetchedForDate === todayStr ? data.appointments : undefined}
    />
  );
}
