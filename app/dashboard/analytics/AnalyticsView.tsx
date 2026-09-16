import { AppHeader, AppNav, AppPageHeading } from "@/components/app/AppChrome";
import type { getAnalyticsData } from "../actions";
import "@/app/management-design.css";

export type AnalyticsStats = Awaited<ReturnType<typeof getAnalyticsData>>;

export function AnalyticsView({ stats }: { stats: AnalyticsStats }) {
  const periods = [
    { label: "Oggi", revenue: stats.revenueToday, appointments: stats.apptsToday, newClients: stats.newClientsToday },
    { label: "Settimana", revenue: stats.revenueWeek, appointments: stats.apptsWeek, newClients: stats.newClientsWeek },
    { label: "Mese", revenue: stats.revenueMonth, appointments: stats.apptsMonth, newClients: stats.newClientsMonth },
  ];
  const maxRevenue = Math.max(...periods.map((period) => period.revenue), 1);
  const formatEuro = (value: number) => new Intl.NumberFormat("it-IT", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(value);

  return (
    <>
      <AppHeader backHref="/dashboard" />
      <AppNav label="Report e condivisione" items={[
        { label: "Analisi", icon: "insights", href: "/dashboard/analytics", active: true },
        { label: "Condividi", icon: "qr_code_2", href: "/dashboard/share" },
      ]} />
      <main className="management-page analytics-page">
        <AppPageHeading eyebrow="IL SALONE, IN NUMERI" title="Una visione chiara." description="Appuntamenti, ricavi stimati e nuovi clienti. Tutto a colpo d’occhio." />
        <div className="analytics-overview">
          <section className="analytics-spotlight management-panel" aria-labelledby="daily-average-title">
            <span className="management-eyebrow">QUESTO MESE</span>
            <h2 id="daily-average-title">Il ritmo del salone.</h2>
            <div className="analytics-hero-number">{new Intl.NumberFormat("it-IT").format(stats.avgClientsPerDay)}</div>
            <p className="analytics-hero-unit">appuntamenti al giorno</p>
            <p className="management-note">Media sui giorni con appuntamenti nel mese corrente.</p>
            <div className="analytics-month-total"><span>Appuntamenti del mese</span><strong>{stats.apptsMonth}</strong></div>
          </section>
          <section className="analytics-revenue management-panel" aria-labelledby="revenue-title">
            <div className="management-panel-heading">
              <div><span className="management-eyebrow">VALORE DELLE PRENOTAZIONI</span><h2 id="revenue-title">Ricavi stimati.</h2></div>
              <span className="material-symbols-outlined" aria-hidden="true">show_chart</span>
            </div>
            <figure className="revenue-chart">
              <div className="revenue-bars" aria-hidden="true">
                {periods.map((period, index) => (
                  <div key={period.label} className="revenue-bar-track">
                    <div className={`revenue-bar revenue-bar-${index}`} style={{ height: `${Math.max(0, period.revenue / maxRevenue * 100)}%` }} />
                  </div>
                ))}
              </div>
              <dl className="revenue-values">
                {periods.map((period) => <div key={period.label}><dt>{period.label}</dt><dd>{formatEuro(period.revenue)}</dd></div>)}
              </dl>
              <figcaption className="management-note">Prezzi degli appuntamenti non cancellati nei periodi correnti, inclusi quelli futuri.</figcaption>
            </figure>
          </section>
        </div>
        <div className="analytics-detail-grid">
          <section className="management-panel analytics-team" aria-labelledby="team-report-title">
            <div className="management-panel-heading"><div><span className="management-eyebrow">QUESTO MESE</span><h2 id="team-report-title">Il tuo team.</h2></div></div>
            <p className="management-note">Collaboratori attivi, ordinati per ricavi stimati.</p>
            {stats.employeeStats.length === 0 ? (
              <div className="management-empty"><span className="material-symbols-outlined" aria-hidden="true">group</span><p>Nessun collaboratore attivo.</p></div>
            ) : (
              <ul className="analytics-team-list">
                {stats.employeeStats.map((employee) => (
                  <li key={employee.id}>
                    <div className="analytics-employee">
                      <span className="analytics-avatar" style={{ borderColor: employee.color }} aria-hidden="true">{employee.name.charAt(0).toUpperCase()}</span>
                      <div><h3>{employee.name}</h3><p>{formatEuro(employee.revenue)} stimati</p></div>
                    </div>
                    <div className="analytics-employee-count"><strong>{employee.count}</strong><span>appuntamenti</span></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="management-panel analytics-clients" aria-labelledby="new-clients-title">
            <span className="management-eyebrow">NUOVI INCONTRI</span>
            <h2 id="new-clients-title">Chi arriva.</h2>
            <p className="management-note">Nuovi clienti nel tuo salone.</p>
            <dl className="analytics-client-counts">
              {periods.map((period) => <div key={period.label}><dt>{period.label}</dt><dd>{period.newClients}</dd></div>)}
            </dl>
          </section>
        </div>
        <section className="management-section" aria-labelledby="appointments-report-title">
          <div className="management-section-heading"><h2 id="appointments-report-title">In agenda.</h2><p>Appuntamenti non cancellati</p></div>
          <dl className="management-metrics analytics-appointments">
            {periods.map((period) => <div key={period.label} className="management-metric"><dt>{period.label}</dt><dd>{period.appointments}</dd></div>)}
          </dl>
        </section>
      </main>
    </>
  );
}
