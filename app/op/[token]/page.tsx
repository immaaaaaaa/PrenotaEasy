import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { getOperatorAgendaData } from "../actions";
import { OperatorClientView } from "./OperatorClientView";
import { AppHeader, AppPageHeading } from "@/components/app/AppChrome";

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
        <>
          <AppHeader />
          <main className="app-status-page">
            <AppPageHeading eyebrow="Accesso operatore" title="Agenda in pausa." description="L’agenda del team richiede un abbonamento premium attivo." />
            <p className="text-[var(--ink-2)]">Contatta l’amministratore dell’attività per riattivare il servizio.</p>
          </main>
        </>
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
