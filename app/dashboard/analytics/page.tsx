import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="bg-[#FAF8F5] text-[#1b1c1c] min-h-screen">
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
      <header className="w-full top-0 sticky z-40 flex justify-between items-center px-6 py-4 bg-[#FAF8F5]/80 backdrop-blur-md transition-opacity duration-200 border-b border-[#c3c8bd]/20">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hover:opacity-80 transition-opacity active:scale-95 duration-200 cursor-pointer mr-1">
            <span className="material-symbols-outlined text-[#5e5e5c]">arrow_back</span>
          </Link>
          <img src="/logo.png" alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
          <h1 className="font-serif font-bold text-lg text-[#4a6243] tracking-tight">Analisi e Report</h1>
        </div>
      </header>

      <main className="px-6 mt-6 space-y-8 max-w-2xl mx-auto pb-24">
        {/* Performance Mensile (High-end Metric Card) */}
        <section>
          <div className="glass-card rounded-2xl p-6 border border-[#c3c8bd]/30 shadow-[0_4px_20px_rgba(74,98,67,0.02)] hover:translate-y-[-1px] hover:shadow-md transition-all duration-300 relative overflow-hidden group bg-white/70">
            <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
              <span className="material-symbols-outlined text-[120px]">insights</span>
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-widest mb-1">Performance Mensile</p>
              <h3 className="font-serif font-bold text-md text-[#4a6243] mb-2">Media Clienti al Giorno</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-serif font-bold text-[#90702e]">{stats.avgClientsPerDay}</span>
                <span className="text-sm text-[#8C9A86] font-medium">clienti/giorno</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[#627b5a] text-xs font-bold">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                <span>Andamento stabile questa settimana</span>
              </div>
            </div>
          </div>
        </section>

        {/* Ricavi Stimati (Bento-style Chart Card) */}
        <section>
          <h2 className="font-serif font-bold text-lg text-[#1b1c1c] mb-4">Ricavi Stimati</h2>
          <div className="glass-card rounded-2xl p-6 border border-[#c3c8bd]/30 shadow-[0_4px_20px_rgba(74,98,67,0.02)] hover:translate-y-[-1px] hover:shadow-md transition-all duration-300 bg-white/70">
            {/* Isolated Bar Chart Container to avoid flex-shrink constraints */}
            <div className="flex justify-between items-end h-32 gap-6 px-4">
              {/* Today */}
              <div className="flex-1 h-full flex items-end">
                <div 
                  className="w-full bg-gradient-to-t from-[#4D5A46]/20 to-[#4D5A46]/45 border border-[#4D5A46]/30 rounded-t-lg bar-grow" 
                  style={{ height: `${todayHeight}%`, animationDelay: "0s" }} 
                />
              </div>
              {/* This Week */}
              <div className="flex-1 h-full flex items-end">
                <div 
                  className="w-full bg-gradient-to-t from-[#4D5A46] to-[#627b5a] border border-[#4D5A46]/20 rounded-t-lg bar-grow" 
                  style={{ height: `${weekHeight}%`, animationDelay: "0.15s" }} 
                />
              </div>
              {/* This Month */}
              <div className="flex-1 h-full flex items-end">
                <div 
                  className="w-full bg-gradient-to-t from-[#C59B27] to-[#D4AF37] border border-[#D4AF37]/30 rounded-t-lg bar-grow shadow-[0_4px_15px_rgba(212,175,55,0.18)]" 
                  style={{ height: `${monthHeight}%`, animationDelay: "0.3s" }} 
                />
              </div>
            </div>

            {/* Labels & Values Grid Row */}
            <div className="grid grid-cols-3 gap-6 text-center mt-4 pt-4 border-t border-[#c3c8bd]/25">
              <div>
                <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider">Oggi</p>
                <span className="text-sm font-bold text-[#1b1c1c] mt-1 block">{formatEuro(stats.revenueToday)}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider">Settimana</p>
                <span className="text-sm font-bold text-[#1b1c1c] mt-1 block">{formatEuro(stats.revenueWeek)}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider">Mese</p>
                <span className="text-sm font-bold text-[#1b1c1c] mt-1 block">{formatEuro(stats.revenueMonth)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Produttività Collaboratori (Elegant List) */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-serif font-bold text-lg text-[#1b1c1c]">Produttività Team</h2>
            <span className="text-xs text-[#8C9A86] font-semibold">Ordinati per fatturato</span>
          </div>
          <div className="space-y-3">
            {stats.employeeStats.length === 0 ? (
              <p className="text-xs text-[#8C9A86] italic">Nessun collaboratore registrato.</p>
            ) : (
              stats.employeeStats.map((e) => (
                <div key={e.id} className="glass-card flex items-center justify-between p-4 rounded-2xl border border-[#c3c8bd]/20 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-white/60">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-white font-bold font-serif text-lg border border-white/20 shadow-sm"
                      style={{ backgroundColor: e.color }}
                    >
                      {e.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1b1c1c]">{e.name}</p>
                      <p className="text-xs text-[#8C9A86]">Staff member</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-serif font-bold text-md text-[#4a6243]">{e.count}</p>
                    <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider">Appuntamenti</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Nuove Clienti (Detailed Stats) */}
        <section className="pb-12">
          <h2 className="font-serif font-bold text-lg text-[#1b1c1c] mb-4">Nuove Clienti</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="glass-card rounded-2xl p-5 text-center border border-[#c3c8bd]/25 border-b-4 border-b-[#4D5A46]/60 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-white/60">
              <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-2">Oggi</p>
              <p className="font-serif font-bold text-lg text-[#4a6243]">{stats.newClientsToday}</p>
            </div>
            <div className="glass-card rounded-2xl p-5 text-center border border-[#c3c8bd]/25 border-b-4 border-b-[#4D5A46]/60 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-white/60">
              <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-2">Settimana</p>
              <p className="font-serif font-bold text-lg text-[#4a6243]">{stats.newClientsWeek}</p>
            </div>
            <div className="glass-card rounded-2xl p-5 text-center border border-[#c3c8bd]/25 border-b-4 border-b-[#4D5A46]/60 hover:translate-y-[-1px] hover:shadow-sm transition-all duration-300 bg-white/60">
              <p className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-2">Mese</p>
              <p className="font-serif font-bold text-lg text-[#4a6243]">{stats.newClientsMonth}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
