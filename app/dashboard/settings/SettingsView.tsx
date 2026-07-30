"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import {
  DURATION_OPTIONS,
  WEEKDAYS_LONG,
  centsToEuros,
  eurosToCents,
  formatDuration,
  formatPrice,
} from "@/lib/constants";
import type { Business, Employee, Service } from "@/lib/types";
import { logout } from "../actions";
import {
  addEmployee,
  addService,
  deleteEmployee,
  deleteService,
  updateBusinessInfo,
  updateEmployee,
  updateHours,
  updateService,
  addHoliday,
  deleteHoliday,
} from "./actions";
import { cn } from "@/lib/cn";

interface HourRow {
  weekday: number;
  isClosed: boolean;
  open: string;
  close: string;
  breakStart: string | null;
  breakEnd: string | null;
}

export function SettingsView({
  business,
  hours,
  services,
  employees,
  initialHolidays = [],
}: {
  business: Business;
  hours: HourRow[];
  services: Service[];
  employees: Employee[];
  initialHolidays?: any[];
}) {
  const router = useRouter();

  // QR Code share modal states
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1b1c1c] pb-32 font-sans">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-45 bg-[#FAF8F5]/85 backdrop-blur-md border-b border-[var(--line)]">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-12 w-12 rounded-xl object-contain" />
            <h1 className="font-bold text-xl tracking-tight text-[#4D5A46]">PrenotaEasy</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQrOpen(true)}
              className="material-symbols-outlined text-[#8C9A86] cursor-pointer hover:opacity-80 transition-opacity active:scale-95 border-none bg-transparent"
              title="Codice QR di Prenotazione"
            >
              qr_code
            </button>
            <button className="material-symbols-outlined text-[#8C9A86] cursor-pointer hover:opacity-80 transition-opacity active:scale-95 border-none bg-transparent">
              notifications
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-8 space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#4D5A46] tracking-tight">Gestione Impostazioni</h2>
          <p className="text-[#8C9A86] text-sm mt-1">Configura la tua attività, gli orari di apertura, i servizi e lo staff.</p>
        </div>

        <BusinessSection business={business} />
        <HoursSection initial={hours} />
        <ServicesSection initial={services} />
        <EmployeesSection initial={employees} />
        <HolidaysSection initial={initialHolidays} />
        <AccountSection />
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#ffffff]/85 backdrop-blur-md shadow-[0_-8px_30px_rgba(77,90,70,0.06)] border-t border-[#E8E4DE]/20">
        <div className="flex justify-around items-center w-full px-6 py-3 pb-safe max-w-screen-md mx-auto">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent text-[#8C9A86] hover:opacity-85"
          >
            <span className="material-symbols-outlined text-[24px]">
              grid_view
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/dashboard?tab=calendar")}
            className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent text-[#8C9A86] hover:opacity-85"
          >
            <span className="material-symbols-outlined text-[24px]">
              calendar_month
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">Calendario</span>
          </button>
          <button
            onClick={() => router.push("/dashboard?tab=clients")}
            className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent text-[#8C9A86] hover:opacity-85"
          >
            <span className="material-symbols-outlined text-[24px]">
              group
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">Clienti</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent text-[var(--ink)] font-bold"
          >
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>content_cut</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Servizi</span>
          </button>
        </div>
      </nav>

      {/* QR Code Share Sheet */}
      {qrOpen && (
        <Sheet
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          title="QR Code di Prenotazione"
          dismissible={true}
        >
          <div className="space-y-6 py-2 text-center">
            <p className="text-[#8C9A86] text-xs font-semibold uppercase tracking-wider">
              Mostra questo QR Code al cliente o stampalo per il tuo negozio.
            </p>

            <div ref={qrRef} className="mx-auto w-fit rounded-2xl bg-white p-4 border border-[#c3c8bd]/30 shadow-sm">
              <QRCodeCanvas value={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/b/${business.slug}`} size={200} level="M" marginSize={0} />
            </div>

            <div className="bg-[#FAF8F5] rounded-xl p-3 border border-[#c3c8bd]/20 break-all text-xs font-bold text-[#4D5A46]">
              {`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/b/${business.slug}`}
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/b/${business.slug}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {}
                }}
                className="flex-1 h-12 rounded-xl bg-[#F4F1EB] border border-[#c3c8bd]/30 font-semibold text-xs text-[#4D5A46] active:scale-95 transition-all cursor-pointer"
              >
                {copied ? "Copiato!" : "Copia Link"}
              </button>
              <button
                onClick={() => {
                  const canvas = qrRef.current?.querySelector("canvas");
                  if (!canvas) return;
                  const dataUrl = canvas.toDataURL("image/png");
                  const win = window.open("", "_blank");
                  if (!win) return;
                  win.document.write(`
                    <html>
                      <head>
                        <title>Stampa QR Code - PrenotaEasy</title>
                        <style>
                          body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; text-align: center; }
                          img { width: 300px; height: 300px; margin-bottom: 20px; }
                          h1 { color: #4D5A46; font-size: 24px; margin: 0 0 10px 0; }
                          p { color: #8C9A86; font-size: 16px; margin: 0; }
                        </style>
                      </head>
                      <body onload="window.print(); window.close();">
                        <h1>Inquadra e Prenota</h1>
                        <p>${business.name}</p>
                        <br/>
                        <img src="${dataUrl}" />
                        <br/>
                        <p style="font-size: 12px; word-break: break-all;">${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/b/${business.slug}</p>
                      </body>
                    </html>
                  `);
                  win.document.close();
                }}
                className="flex-grow h-12 rounded-full ios-btn-primary font-bold text-xs active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
              >
                Stampa QR
              </button>
            </div>

            <button
              onClick={() => setQrOpen(false)}
              className="text-xs font-bold text-[#8C9A86] uppercase tracking-wider cursor-pointer hover:opacity-85 border-none bg-transparent"
            >
              Chiudi
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ---- helpers ---- */

function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs font-bold text-[#4a6243] animate-pulse">Salvato ✓</span>;
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="ios-card rounded-2xl p-5 border border-[var(--line)] bg-white shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-bold text-[#4D5A46] tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ---- Business info ---- */

function BusinessSection({ business }: { business: Business }) {
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone ?? "");
  const [address, setAddress] = useState(business.address ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await updateBusinessInfo({ name, phone, address });
      if (!res.ok) return setError(res.error ?? "Errore.");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Card title="La tua attività" action={<Saved show={saved} />}>
      <div className="space-y-3">
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46]"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome Attività"
        />
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46]"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefono"
          type="tel"
        />
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46]"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Indirizzo"
        />
        {error && <p className="px-1 text-xs font-bold text-[#ba1a1a]">{error}</p>}
        <button
          disabled={pending}
          onClick={save}
          className="w-full h-12 rounded-full ios-btn-primary font-bold text-xs uppercase tracking-wider disabled:opacity-55"
        >
          {pending ? "Salvataggio..." : "Salva Informazioni"}
        </button>
      </div>
    </Card>
  );
}

/* ---- Hours ---- */

function HoursSection({ initial }: { initial: HourRow[] }) {
  const [rows, setRows] = useState<HourRow[]>(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(i: number, patch: Partial<HourRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateHours(rows);
      if (!res.ok) return setError(res.error ?? "Errore.");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <Card title="Orari di apertura" action={<Saved show={saved} />}>
      <div className="divide-y divide-[var(--line)]">
        {rows.map((r, i) => (
          <div key={r.weekday} className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between w-full sm:w-auto">
                <span className="w-20 shrink-0 font-bold text-sm text-[#4D5A46]">{WEEKDAYS_LONG[r.weekday]}</span>
                <div className="sm:hidden">
                  <Toggle checked={!r.isClosed} onChange={(v) => set(i, { isClosed: !v })} label={WEEKDAYS_LONG[r.weekday]} />
                </div>
              </div>
              {r.isClosed ? (
                <span className="flex-grow text-[#8C9A86] text-xs font-semibold">Chiuso</span>
              ) : (
                <div className="flex flex-grow items-center justify-end gap-1 px-1 w-full sm:w-auto">
                  <input
                    type="time"
                    value={r.open}
                    onChange={(e) => set(i, { open: e.target.value })}
                    className="h-9 w-20 rounded-xl bg-[#FAF8F5] border border-[var(--line)] text-center text-xs font-bold text-[#4D5A46] outline-none focus:border-[var(--ink)] transition-all"
                  />
                  <span className="text-[#8C9A86] text-xs font-bold">–</span>
                  <input
                    type="time"
                    value={r.close}
                    onChange={(e) => set(i, { close: e.target.value })}
                    className="h-9 w-20 rounded-xl bg-[#FAF8F5] border border-[var(--line)] text-center text-xs font-bold text-[#4D5A46] outline-none focus:border-[var(--ink)] transition-all"
                  />
                </div>
              )}
              <div className="hidden sm:block">
                <Toggle checked={!r.isClosed} onChange={(v) => set(i, { isClosed: !v })} label={WEEKDAYS_LONG[r.weekday]} />
              </div>
            </div>
            {!r.isClosed &&
              (r.breakStart != null ? (
                <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                  <div className="flex items-center justify-between w-full sm:w-auto">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C9A86] mr-1">Pausa</span>
                      <input
                        type="time"
                        value={r.breakStart}
                        onChange={(e) => set(i, { breakStart: e.target.value })}
                        className="h-8 w-20 rounded-xl bg-[#FAF8F5] border border-[var(--line)] text-center text-[11px] font-bold text-[#4D5A46] outline-none focus:border-[var(--ink)] transition-all"
                      />
                      <span className="text-[#8C9A86] text-xs font-bold">–</span>
                      <input
                        type="time"
                        value={r.breakEnd ?? "14:00"}
                        onChange={(e) => set(i, { breakEnd: e.target.value })}
                        className="h-8 w-20 rounded-xl bg-[#FAF8F5] border border-[var(--line)] text-center text-[11px] font-bold text-[#4D5A46] outline-none focus:border-[var(--ink)] transition-all"
                      />
                    </div>
                    <button
                      onClick={() => set(i, { breakStart: null, breakEnd: null })}
                      aria-label="Rimuovi pausa"
                      className="text-[#ba1a1a] hover:opacity-80 p-1.5 border-none bg-transparent cursor-pointer flex items-center justify-center transition-opacity ml-2"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setRows(prev => prev.map((row) => {
                        if (row.weekday === r.weekday || row.isClosed) return row;
                        return {
                          ...row,
                          open: r.open,
                          close: r.close,
                          breakStart: r.breakStart,
                          breakEnd: r.breakEnd
                        };
                      }));
                    }}
                    className="h-8 px-3 rounded-full bg-[#FAF8F5] border border-[var(--line)] text-[9px] font-extrabold text-[#90702e] hover:bg-[#F4F1EB] uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto whitespace-nowrap"
                    title="Copia orario e pausa di questo giorno su tutti gli altri giorni aperti"
                  >
                    <span className="material-symbols-outlined text-[10px]">content_copy</span> Applica a tutti
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <button
                    onClick={() => set(i, { breakStart: "13:00", breakEnd: "14:00" })}
                    className="h-8 px-3 rounded-full bg-[#F4F1EB] text-[9px] font-extrabold text-[#4D5A46] hover:bg-[#EBE7DD] uppercase tracking-wider border-none cursor-pointer flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[10px]">add</span> Aggiungi pausa
                  </button>
                  <button
                    onClick={() => {
                      setRows(prev => prev.map((row) => {
                        if (row.weekday === r.weekday || row.isClosed) return row;
                        return {
                          ...row,
                          open: r.open,
                          close: r.close,
                          breakStart: r.breakStart,
                          breakEnd: r.breakEnd
                        };
                      }));
                    }}
                    className="h-8 px-3 rounded-full bg-[#FAF8F5] border border-[var(--line)] text-[9px] font-extrabold text-[#90702e] hover:bg-[#F4F1EB] uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto whitespace-nowrap"
                    title="Copia orario e pausa di questo giorno su tutti gli altri giorni aperti"
                  >
                    <span className="material-symbols-outlined text-[10px]">content_copy</span> Applica a tutti
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
      {error && <p className="mt-2 px-1 text-xs font-bold text-[#ba1a1a]">{error}</p>}
      <button
        disabled={pending}
        onClick={save}
        className="w-full h-12 mt-4 rounded-full ios-btn-primary font-bold text-xs uppercase tracking-wider disabled:opacity-55"
      >
        {pending ? "Salvataggio..." : "Salva orari"}
      </button>
    </Card>
  );
}

/* ---- Services ---- */

function ServicesSection({ initial }: { initial: Service[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <Card
      title="Servizi"
      action={
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-bold text-[#4D5A46] uppercase tracking-wider cursor-pointer hover:opacity-85 border-none bg-transparent"
        >
          {adding ? "Chiudi" : "+ Aggiungi"}
        </button>
      }
    >
      {adding && <ServiceEditor onDone={() => { setAdding(false); router.refresh(); }} />}
      <div className="space-y-3">
        {initial.length === 0 && !adding && (
          <p className="text-[#8C9A86] text-xs italic">Nessun servizio creato.</p>
        )}
        {initial.map((s) => (
          <ServiceEditor key={s.id} service={s} onDone={() => router.refresh()} />
        ))}
      </div>
    </Card>
  );
}

function ServiceEditor({
  service,
  onDone,
}: {
  service?: Service;
  onDone: () => void;
}) {
  const [name, setName] = useState(service?.name ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [durationHours, setDurationHours] = useState<string | number>(Math.floor((service?.duration_min ?? 30) / 60));
  const [durationMinutes, setDurationMinutes] = useState<string | number>((service?.duration_min ?? 30) % 60);
  const [price, setPrice] = useState(service ? centsToEuros(service.price_cents) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const h = Number(durationHours) || 0;
      const m = Number(durationMinutes) || 0;
      const totalMinutes = h * 60 + m;
      if (totalMinutes <= 0) {
        return setError("La durata deve essere superiore a 0 minuti.");
      }
      const payload = { name, durationMin: totalMinutes, priceCents: eurosToCents(price), description };
      const res = service
        ? await updateService({ id: service.id, ...payload })
        : await addService(payload);
      if (!res.ok) return setError(res.error ?? "Errore.");
      if (!service) {
        setName("");
        setPrice("");
        setDescription("");
        setDurationHours(0);
        setDurationMinutes(30);
      }
      onDone();
    });
  }

  function remove() {
    if (!confirm("Sei sicuro di voler eliminare questo servizio?")) return;
    start(async () => {
      await deleteService(service!.id);
      onDone();
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 border border-[var(--line)] space-y-4 relative shadow-sm text-left">
      {/* NOME SERVIZIO */}
      <div>
        <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Nome Servizio</label>
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-semibold text-[#4D5A46] transition-all"
          placeholder="es. Taglio capelli, Massaggio..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* DESCRIZIONE */}
      <div>
        <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Descrizione</label>
        <textarea
          className="w-full h-24 rounded-xl bg-[#FAF8F5] border border-[var(--line)] p-3 outline-none focus:border-[var(--ink)] text-sm text-[#4D5A46] font-medium resize-none transition-all"
          placeholder="Scrivi qui una breve descrizione del servizio..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* DURATA E PREZZO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* DURATA TRATTAMENTO */}
        <div>
          <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Durata Trattamento</label>
          <div className="grid grid-cols-2 gap-2">
            {/* Ore Input */}
            <div className="flex h-12 items-center justify-between bg-[#FAF8F5] border border-[var(--line)] rounded-xl px-3">
              <input
                type="number"
                min={0}
                max={12}
                value={durationHours}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setDurationHours("");
                  } else {
                    setDurationHours(Math.max(0, Math.min(12, Number(val))));
                  }
                }}
                className="w-12 bg-transparent text-left font-bold outline-none text-base text-[#4D5A46]"
                placeholder="0"
              />
              <span className="text-[#8C9A86] text-xs font-semibold">ore</span>
            </div>
            {/* Minuti Input */}
            <div className="flex h-12 items-center justify-between bg-[#FAF8F5] border border-[var(--line)] rounded-xl px-3">
              <input
                type="number"
                min={0}
                max={59}
                step={5}
                value={durationMinutes}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setDurationMinutes("");
                  } else {
                    setDurationMinutes(Math.max(0, Math.min(59, Number(val))));
                  }
                }}
                className="w-12 bg-transparent text-left font-bold outline-none text-base text-[#4D5A46]"
                placeholder="0"
              />
              <span className="text-[#8C9A86] text-xs font-semibold">minuti</span>
            </div>
          </div>
        </div>

        {/* PREZZO */}
        <div>
          <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Prezzo</label>
          <div className="flex h-12 items-center gap-1.5 bg-[#FAF8F5] border border-[var(--line)] rounded-xl px-3">
            <span className="text-[#4D5A46] text-lg font-bold">€</span>
            <input
              inputMode="decimal"
              className="w-full bg-transparent outline-none text-[#4D5A46] text-lg font-bold"
              placeholder="0,00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-[#ba1a1a]">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button
          disabled={pending}
          onClick={save}
          className="flex-grow h-12 rounded-full ios-btn-primary font-bold text-xs uppercase tracking-wider"
        >
          {service ? "Salva" : "Aggiungi"}
        </button>
        {service && (
          <button
            onClick={remove}
            className="h-12 px-5 rounded-full border border-[#ba1a1a] text-[#ba1a1a] font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer bg-transparent"
          >
            Elimina
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Employees ---- */

function EmployeesSection({ initial }: { initial: Employee[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();

  function add() {
    if (!newName.trim()) return;
    start(async () => {
      await addEmployee(newName);
      setNewName("");
      router.refresh();
    });
  }

  return (
    <Card title="Operatori dello staff">
      <div className="space-y-3">
        {initial.map((e) => (
          <EmployeeRow key={e.id} employee={e} onDone={() => router.refresh()} />
        ))}
      </div>
      <div className="mt-4 flex gap-2 w-full">
        <input
          className="flex-1 min-w-0 h-11 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46]"
          placeholder="Nuovo operatore"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          disabled={pending}
          onClick={add}
          className="h-11 px-5 rounded-full ios-btn-primary !h-11 !px-5 shrink-0 text-white font-bold text-xs uppercase tracking-wider"
        >
          Aggiungi
        </button>
      </div>
    </Card>
  );
}

function EmployeeRow({
  employee,
  onDone,
}: {
  employee: Employee;
  onDone: () => void;
}) {
  const [name, setName] = useState(employee.name);
  const [avatarUrl, setAvatarUrl] = useState(employee.avatar_url);
  const [pending, start] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const targetSize = 120;
        canvas.width = targetSize;
        canvas.height = targetSize;

        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;

        ctx.drawImage(img, sx, sy, size, size, 0, 0, targetSize, targetSize);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
        setAvatarUrl(compressedBase64);
        start(async () => {
          await updateEmployee({ id: employee.id, name, avatarUrl: compressedBase64 });
          onDone();
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="h-10 w-10 shrink-0 rounded-full shadow-sm overflow-hidden relative cursor-pointer group flex items-center justify-center border border-[var(--line)] bg-[#FAF8F5]"
        title="Clicca per cambiare foto"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover group-hover:opacity-75 transition-opacity" />
        ) : (
          <span 
            className="h-full w-full flex items-center justify-center text-xs font-bold text-white uppercase"
            style={{ background: employee.color }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold">
          Carica
        </div>
      </div>
      <input
        className="flex-1 h-11 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46]"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== employee.name)
            start(async () => {
              await updateEmployee({ id: employee.id, name, avatarUrl });
              onDone();
            });
        }}
      />
      <button
        onClick={() => {
          if (confirm("Vuoi rimuovere questo operatore?")) {
            start(async () => { await deleteEmployee(employee.id); onDone(); });
          }
        }}
        disabled={pending}
        aria-label="Elimina operatore"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#ba1a1a]/30 text-[#ba1a1a] transition-colors active:bg-[#ba1a1a]/5 hover:bg-[#ba1a1a]/5 cursor-pointer bg-transparent"
      >
        ✕
      </button>
    </div>
  );
}

/* ---- Account ---- */

function AccountSection() {
  const [pending, start] = useTransition();
  return (
    <section className="mt-8 mb-4">
      <button
        disabled={pending}
        onClick={() => start(async () => { await logout(); })}
        className="w-full h-12 rounded-full border border-[#ba1a1a] text-[#ba1a1a] font-bold text-xs uppercase tracking-widest active:scale-[0.98] transition-all cursor-pointer hover:bg-[#ba1a1a]/5 bg-transparent"
      >
        Esci dall'account
      </button>
    </section>
  );
}

/* ---- Holidays ---- */

function HolidaysSection({ initial }: { initial: any[] }) {
  const router = useRouter();
  const [holidays, setHolidays] = useState(initial);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [desc, setDesc] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHolidays(initial);
  }, [initial]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!startDate) {
      setError("Seleziona la data di inizio.");
      return;
    }
    if (endDate && endDate < startDate) {
      setError("La data di fine non può essere precedente alla data di inizio.");
      return;
    }
    start(async () => {
      const res = await addHoliday({ startDate, endDate: endDate || undefined, description: desc });
      if (!res.ok) {
        setError(res.error || "Errore durante il salvataggio.");
      } else {
        setStartDate("");
        setEndDate("");
        setDesc("");
        router.refresh();
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Vuoi rimuovere questo periodo festivo? Le date incluse torneranno disponibili.")) {
      return;
    }
    start(async () => {
      const res = await deleteHoliday(id);
      if (!res.ok) {
        alert(res.error || "Errore durante la rimozione.");
      } else {
        router.refresh();
      }
    });
  }

  function formatDateItalian(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  function renderHolidayRange(startStr: string, endStr: string): string {
    if (startStr === endStr) {
      return formatDateItalian(startStr);
    }

    try {
      const d1 = new Date(startStr);
      const d2 = new Date(endStr);

      const optWithoutYear: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
      const optWithYear: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

      if (d1.getFullYear() === d2.getFullYear()) {
        const startFormatted = d1.toLocaleDateString("it-IT", optWithoutYear);
        const endFormatted = d2.toLocaleDateString("it-IT", optWithYear);
        return `Dal ${startFormatted} al ${endFormatted}`;
      } else {
        const startFormatted = d1.toLocaleDateString("it-IT", optWithYear);
        const endFormatted = d2.toLocaleDateString("it-IT", optWithYear);
        return `Dal ${startFormatted} al ${endFormatted}`;
      }
    } catch {
      return `Dal ${startStr} al ${endStr}`;
    }
  }

  return (
    <Card title="Giorni di chiusura straordinari">
      <p className="text-[10px] text-[#8C9A86] font-bold uppercase tracking-wider mb-3">
        Imposta giorni di chiusura festivi o ponti straordinari per l'attività.
      </p>

      {holidays.length === 0 ? (
        <p className="text-xs text-[#8C9A86] italic mb-2">Nessuna chiusura straordinaria configurata.</p>
      ) : (
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar mb-4">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[var(--line)] gap-2">
              <div className="min-w-0">
                <span className="font-bold text-xs text-[#4D5A46] block md:inline-block">
                  {renderHolidayRange(h.start_date, h.end_date)}
                </span>
                {h.description && (
                  <span className="text-[#8C9A86] text-[10px] font-semibold block mt-0.5 truncate">{h.description}</span>
                )}
              </div>
              <button
                disabled={pending}
                onClick={() => handleDelete(h.id)}
                aria-label="Rimuovi periodo festivo"
                className="text-[#ba1a1a] hover:opacity-80 p-1.5 border-none bg-transparent cursor-pointer flex items-center justify-center transition-opacity"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="mt-4 border-t border-[var(--line)] pt-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Data Inizio</label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-xs font-bold text-[#4D5A46] uppercase"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Data Fine (opzionale)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Lascia vuoto per giorno singolo"
              className="w-full h-11 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-xs font-bold text-[#4D5A46] uppercase"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Motivo (es. Chiusura Estiva)</label>
            <input
              type="text"
              placeholder="es. Natale, Ferie"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full h-11 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-xs font-medium text-[#4D5A46]"
            />
          </div>
        </div>

        {error && <p className="text-[10px] font-bold text-[#ba1a1a]">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full h-11 rounded-full ios-btn-primary text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">add</span> Aggiungi Chiusura
        </button>
      </form>
    </Card>
  );
}
