"use client";

import { useState, useTransition, useRef } from "react";
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
}: {
  business: Business;
  hours: HourRow[];
  services: Service[];
  employees: Employee[];
}) {
  const router = useRouter();

  // QR Code share modal states
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1b1c1c] pb-32 font-sans">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-45 bg-[#FAF8F5]/85 backdrop-blur-md border-b border-[#c3c8bd]/30">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">spa</span>
            <h1 className="font-serif text-xl font-bold tracking-tight text-[#4a6243]">PrenotaEasy</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQrOpen(true)}
              className="material-symbols-outlined text-[#5e5e5c] cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
              title="Codice QR di Prenotazione"
            >
              qr_code
            </button>
            <button className="material-symbols-outlined text-[#5e5e5c] cursor-pointer hover:opacity-80 transition-opacity active:scale-95">
              notifications
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 mt-8 space-y-6">
        <div>
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#4a6243]">Gestione Impostazioni</h2>
          <p className="text-[#5e5e5c] text-sm">Configura la tua attività, gli orari di apertura, i servizi e lo staff.</p>
        </div>

        <BusinessSection business={business} />
        <HoursSection initial={hours} />
        <ServicesSection initial={services} />
        <EmployeesSection initial={employees} />
        <AccountSection />
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] z-50 bg-[#ffffff] shadow-[0_-4px_20px_rgba(74,98,67,0.04)] border-t border-[#c3c8bd]/30">
        <div className="flex justify-around items-center w-full px-4 py-3 pb-safe max-w-2xl mx-auto">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center justify-center text-[#5e5e5c] p-2 hover:bg-[#F4F1EB] rounded-lg transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">
              grid_view
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/dashboard?tab=calendar")}
            className="flex flex-col items-center justify-center text-[#5e5e5c] p-2 hover:bg-[#F4F1EB] rounded-lg transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">
              calendar_month
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">Calendario</span>
          </button>
          <button
            onClick={() => router.push("/dashboard?tab=clients")}
            className="flex flex-col items-center justify-center text-[#5e5e5c] p-2 hover:bg-[#F4F1EB] rounded-lg transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">
              group
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">Clienti</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="flex flex-col items-center justify-center rounded-full px-4 py-1 bg-[#4a6243]/10 text-[#4a6243] active:scale-95 transition-transform duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">content_cut</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Servizi</span>
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
                className="flex-grow h-12 rounded-xl bg-[#4a6243] font-semibold text-xs text-white active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
              >
                Stampa QR
              </button>
            </div>

            <button
              onClick={() => setQrOpen(false)}
              className="text-xs font-bold text-[#8C9A86] uppercase tracking-wider cursor-pointer hover:opacity-85"
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
    <section className="glass-card rounded-2xl p-5 shadow-sm border border-[#c3c8bd]/25 bg-white">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-[#4a6243]">{title}</h3>
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
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/30 px-4 outline-none focus:border-[#4a6243] text-sm font-medium"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome Attività"
        />
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/30 px-4 outline-none focus:border-[#4a6243] text-sm font-medium"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefono"
          type="tel"
        />
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/30 px-4 outline-none focus:border-[#4a6243] text-sm font-medium"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Indirizzo"
        />
        {error && <p className="px-1 text-xs font-bold text-[#ba1a1a]">{error}</p>}
        <button
          disabled={pending}
          onClick={save}
          className="w-full h-11 rounded-xl bg-[#4a6243] text-white font-semibold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform duration-200 cursor-pointer disabled:opacity-55"
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
      <div className="divide-y divide-[#c3c8bd]/15">
        {rows.map((r, i) => (
          <div key={r.weekday} className="py-3">
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 font-bold text-sm text-[#4a6243]">{WEEKDAYS_LONG[r.weekday]}</span>
              {r.isClosed ? (
                <span className="flex-grow text-[#8C9A86] text-xs font-semibold">Chiuso</span>
              ) : (
                <div className="flex flex-grow items-center justify-end gap-1 px-1">
                  <input
                    type="time"
                    value={r.open}
                    onChange={(e) => set(i, { open: e.target.value })}
                    className="h-9 w-20 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/25 text-center text-xs font-bold text-[#4a6243] outline-none focus:border-[#4a6243] transition-all"
                  />
                  <span className="text-[#8C9A86] text-xs font-bold">–</span>
                  <input
                    type="time"
                    value={r.close}
                    onChange={(e) => set(i, { close: e.target.value })}
                    className="h-9 w-20 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/25 text-center text-xs font-bold text-[#4a6243] outline-none focus:border-[#4a6243] transition-all"
                  />
                </div>
              )}
              <Toggle checked={!r.isClosed} onChange={(v) => set(i, { isClosed: !v })} label={WEEKDAYS_LONG[r.weekday]} />
            </div>
            {!r.isClosed &&
              (r.breakStart != null ? (
                <div className="mt-2 flex items-center justify-end gap-1.5 pl-20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C9A86] mr-auto">Pausa</span>
                  <input
                    type="time"
                    value={r.breakStart}
                    onChange={(e) => set(i, { breakStart: e.target.value })}
                    className="h-8 w-20 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/25 text-center text-[11px] font-bold text-[#4a6243] outline-none focus:border-[#4a6243] transition-all"
                  />
                  <span className="text-[#8C9A86] text-xs font-bold">–</span>
                  <input
                    type="time"
                    value={r.breakEnd ?? "14:00"}
                    onChange={(e) => set(i, { breakEnd: e.target.value })}
                    className="h-8 w-20 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/25 text-center text-[11px] font-bold text-[#4a6243] outline-none focus:border-[#4a6243] transition-all"
                  />
                  <button
                    onClick={() => set(i, { breakStart: null, breakEnd: null })}
                    aria-label="Rimuovi pausa"
                    className="text-[#ba1a1a] font-bold text-xs p-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => set(i, { breakStart: "13:00", breakEnd: "14:00" })}
                  className="mt-1 pl-20 text-[11px] font-bold text-[#4a6243] uppercase tracking-wider hover:opacity-80"
                >
                  + Aggiungi pausa
                </button>
              ))}
          </div>
        ))}
      </div>
      {error && <p className="mt-2 px-1 text-xs font-bold text-[#ba1a1a]">{error}</p>}
      <button
        disabled={pending}
        onClick={save}
        className="w-full h-11 mt-4 rounded-xl bg-[#4a6243] text-white font-semibold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform duration-200 cursor-pointer disabled:opacity-55"
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
          className="text-xs font-bold text-[#4a6243] uppercase tracking-wider cursor-pointer hover:opacity-85"
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
  const [duration, setDuration] = useState(service?.duration_min ?? 30);
  const [price, setPrice] = useState(service ? centsToEuros(service.price_cents) : "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const payload = { name, durationMin: duration, priceCents: eurosToCents(price) };
      const res = service
        ? await updateService({ id: service.id, ...payload })
        : await addService(payload);
      if (!res.ok) return setError(res.error ?? "Errore.");
      if (!service) {
        setName("");
        setPrice("");
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
    <div className="rounded-2xl bg-[#FAF8F5] p-4 border border-[#c3c8bd]/20 space-y-3 shadow-sm">
      <input
        className="w-full h-11 rounded-xl bg-white border border-[#c3c8bd]/30 px-4 outline-none focus:border-[#4a6243] text-sm font-medium"
        placeholder="Nome servizio"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <select
          className="h-11 flex-1 rounded-xl bg-white border border-[#c3c8bd]/30 px-3 outline-none focus:border-[#4a6243] text-sm font-medium"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
        >
          {DURATION_OPTIONS.map((d) => (
            <option key={d} value={d}>{formatDuration(d)}</option>
          ))}
        </select>
        <div className="flex h-11 w-28 items-center gap-1 rounded-xl bg-white border border-[#c3c8bd]/30 px-3">
          <span className="text-[#8C9A86] text-sm font-semibold">€</span>
          <input
            inputMode="decimal"
            className="w-full bg-transparent outline-none text-sm font-medium text-[#4a6243]"
            placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-xs font-bold text-[#ba1a1a]">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={save}
          className="flex-grow h-10 rounded-xl bg-[#4a6243] text-white font-semibold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform duration-200 cursor-pointer"
        >
          {service ? "Salva" : "Aggiungi"}
        </button>
        {service && (
          <button
            onClick={remove}
            className="h-10 px-4 rounded-xl border border-[#ba1a1a] text-[#ba1a1a] font-semibold text-xs uppercase tracking-wider active:scale-[0.98] transition-transform duration-200 cursor-pointer"
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
      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 h-11 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/30 px-4 outline-none focus:border-[#4a6243] text-sm font-medium"
          placeholder="Nuovo operatore"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          disabled={pending}
          onClick={add}
          className="h-11 px-5 rounded-xl bg-[#4a6243] text-white font-semibold text-xs uppercase tracking-wider active:scale-[0.98] transition-all cursor-pointer"
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
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-3">
      <span className="h-8 w-8 shrink-0 rounded-full shadow-sm" style={{ background: employee.color }} />
      <input
        className="flex-1 h-11 rounded-xl bg-[#FAF8F5] border border-[#c3c8bd]/30 px-4 outline-none focus:border-[#4a6243] text-sm font-medium"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name !== employee.name)
            start(async () => {
              await updateEmployee({ id: employee.id, name });
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
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#ba1a1a]/30 text-[#ba1a1a] transition-colors active:bg-[#ba1a1a]/5 hover:bg-[#ba1a1a]/5 cursor-pointer"
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
        className="w-full h-12 rounded-xl border border-[#ba1a1a] text-[#ba1a1a] font-bold text-xs uppercase tracking-widest active:scale-[0.98] transition-transform duration-200 cursor-pointer hover:bg-[#ba1a1a]/5"
      >
        Esci dall'account
      </button>
    </section>
  );
}
