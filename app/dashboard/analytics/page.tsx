import type { Metadata } from "next";
import Link from "next/link";
import { CalendarLogo } from "@/components/CalendarLogo";
import { getAnalyticsData } from "../actions";

export const metadata: Metadata = { title: "Analisi e Report - PrenotaEasy" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const stats = await getAnalyticsData();

  // Find max value to scale the vertical bars nicely
  const maxRevenue = Math.max(stats.revenueMonth, stats.revenueWeek, stats.revenueToday, 1);
  const monthHeight = Math.max((stats.revenueMonth / maxRevenue) * 100, 8);
  const weekHeight = Math.max((stats.revenueWeek / maxRevenue) * 100, 8);
  const todayHeight = Math.max((stats.revenueToday / maxRevenue) * 100, 8);

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="bg-[var(--bg)] text-[var(--ink)] min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        .bar-grow {
            animation: grow 1s ease-out forwards;
            transform-origin: bottom;
        }
        @keyframes grow {
            from { transform: scaleY(0); }
            to { transform: scaleY(1); }
        }
      `}} />

      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-40 flex justify-between items-center px-6 py-4 bg-[var(--bg)]/80 backdrop-blur-md transition-opacity duration-200 border-b border-[var(--line-strong)]/20">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hover:opacity-80 transition-opacity active:scale-95 duration-200 cursor-pointer mr-1">
            <span className="material-symbols-outlined text-[var(--ink-2)]">arrow_back</span>
          </Link>
          <CalendarLogo size={32} />
          <h1 className="font-serif font-bold text-lg text-[var(--accent)] tracking-tight">Analisi e Report</h1>
        </div>
      </header>

      <main className="px-6 mt-6 space-y-8 max-w-2xl mx-auto pb-24">
        {/* Performance Mensile (High-end Metric Card) */}
        <section>
          <div className="glass-card rounded-2xl p-6 border border-[var(--line-strong)]/30 shadow-[0_4px_20px_rgba(62,27,51,0.02)] hover:translate-y-[-1px] hover:shadow-md transition-all duration-300 relative overflow-hidden group bg-[var(--surface)]/70">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
              <span className="material-symbols-outlined text-[120px]">insights</span>
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-widest mb-1">Performance Mensile</p>
              <h3 className="font-serif font-bold text-md text-[var(--accent)] mb-2">Media Clienti al Giorno</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-serif font-bold text-[var(--accent)]">{stats.avgClientsPerDay}</span>
                <span className="text-sm text-[var(--ink-2)] font-medium">clienti/giorno</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[var(--accent)] text-xs font-bold">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>Andamento stabile questa settimana</span>
              </div>
            </div>
          </div>
        </section>

        {/* Ricavi Stimati (Bento-style Chart Card) */}
        <section>
          <h2 className="font-serif font-bold text-lg text-[var(--ink)] mb-4">Ricavi Stimati</h2>
          <div className="glass-card rounded-2xl p-6 border border-[var(--line-strong)]/30 shadow-[0_4px_20px_rgba(62,27,51,0.02)] hover:translate-y-[-1px] hover:shadow-md transition-all duration-300 bg-[var(--surface)]/70">
            {/* Isolated Bar Chart Container to avoid flex-shrink constraints */}
            <div className="flex justify-between items-end h-32 gap-6 px-4">
              {/* Today */}
              <div className="flex-1 h-full flex items-end">
                <div 
                  className="w-full bg-gradient-to-t from-[#3E1B33]/20 to-[#3E1B33]/45 border border-[var(--ink)]/30 rounded-t-lg bar-grow" 
                  style={{ height: `${todayHeight}%`, animationDelay: "0s" }} 
                />
              </div>
              {/* This Week */}
              <div className="flex-1 h-full flex items-end">
                <div 
                  className="w-full bg-gradient-to-t from-[#3E1B33] to-[#8A3D6E] border border-[var(--ink)]/20 rounded-t-lg bar-grow" 
                  style={{ height: `${weekHeight}%`, animationDelay: "0.15s" }} 
                />
              </div>
              {/* This Month */}
              <div className="flex-1 h-full flex items-end">
                <div 
                  className="w-full bg-gradient-to-t from-[#6F2F57] to-[#8A3D6E] border border-[var(--accent)]/30 rounded-t-lg bar-grow shadow-[0_4px_15px_rgba(138,61,110,0.18)]" 
                  style={{ height: `${monthHeight}%`, animationDelay: "0.3s" }} 
                />
              </div>
            </div>

            {/* Labels & Values Grid Row */}
            <div className="grid grid-cols-3 gap-6 text-center mt-4 pt-4 border-t border-[var(--line-strong)]/25">
              <div>
                <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider">Oggi</p>
                <span className="text-sm font-bold text-[var(--ink)] mt-1 block">{formatEuro(stats.revenueToday)}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider">Settimana</p>
                <span className="text-sm font-bold text-[var(--ink)] mt-1 block">{formatEuro(stats.revenueWeek)}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider">Mese</p>
                <span className="text-sm font-bold text-[var(--ink)] mt-1 block">{formatEuro(stats.revenueMonth)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Produttività Collaboratori (Elegant List) */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif font-bold text-lg text-[var(--ink)]">Produttività Team</h2>
            <span className="text-xs text-[var(--ink-2)] font-semibold">Ordinati per fatturato</span>
          </div>
          <div className="space-y-3">
            {stats.employeeStats.length === 0 ? (
              <p className="text-xs text-[var(--ink-2)] italic">Nessun collaboratore registrato.</p>
            ) : (
              stats.employeeStats.map((e) => (
                <div key={e.id} className="glass-card flex items-center justify-between p-4 rounded-2xl border border-[var(--line-strong)]/20 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-[var(--surface)]/60">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold font-serif text-lg border border-white/20 shadow-sm"
                      style={{ backgroundColor: e.color }}
                    >
                      {e.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--ink)]">{e.name}</p>
                      <p className="text-xs text-[var(--ink-2)]">Staff member</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-serif font-bold text-md text-[var(--accent)]">{e.count}</p>
                    <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider">Appuntamenti</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Nuove Clienti (Detailed Stats) */}
        <section className="pb-12">
          <h2 className="font-serif font-bold text-lg text-[var(--ink)] mb-4">Nuove Clienti</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-5 text-center border border-[var(--line-strong)]/25 border-b-4 border-b-[#3E1B33]/60 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-[var(--surface)]/60">
              <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider mb-2">Oggi</p>
              <p className="font-serif font-bold text-lg text-[var(--accent)]">{stats.newClientsToday}</p>
            </div>
            <div className="glass-card rounded-2xl p-5 text-center border border-[var(--line-strong)]/25 border-b-4 border-b-[#3E1B33]/60 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-[var(--surface)]/60">
              <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider mb-2">Settimana</p>
              <p className="font-serif font-bold text-lg text-[var(--accent)]">{stats.newClientsWeek}</p>
            </div>
            <div className="glass-card rounded-2xl p-5 text-center border border-[var(--line-strong)]/25 border-b-4 border-b-[#3E1B33]/60 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-[var(--surface)]/60">
              <p className="text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider mb-2">Mese</p>
              <p className="font-serif font-bold text-lg text-[var(--accent)]">{stats.newClientsMonth}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
