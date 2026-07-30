"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { QRCard } from "@/components/QRCard";
import { spring } from "@/lib/motion";
import {
  ALL_WEEKDAYS,
  DURATION_OPTIONS,
  EMPLOYEE_COLORS,
  WEEKDAYS_LONG,
  eurosToCents,
  formatDuration,
} from "@/lib/constants";
import { createBusiness, type OnboardingPayload } from "./actions";

interface HourRow {
  weekday: number;
  isClosed: boolean;
  open: string;
  close: string;
}
interface ServiceRow {
  name: string;
  duration: number;
  price: string;
  description: string;
  durationHoursRaw?: string;
  durationMinutesRaw?: string;
}

export function OnboardingWizard({
  baseUrl,
  initialBusiness,
}: {
  baseUrl: string;
  initialBusiness?: any;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialBusiness?.name || "");
  const [phone, setPhone] = useState(initialBusiness?.phone || "");
  const [address, setAddress] = useState(initialBusiness?.address || "");

  const [hours, setHours] = useState<HourRow[]>(
    ALL_WEEKDAYS.map((w) => ({
      weekday: w,
      isClosed: w === 6, // Sunday closed by default
      open: "09:00",
      close: w === 5 ? "18:00" : "19:00",
    })),
  );

  const [services, setServices] = useState<ServiceRow[]>([
    { name: "Massaggio Svedese", duration: 75, price: "75", description: "Un massaggio rilassante che utilizza tecniche di sfioramento, impastamento e frizione per migliorare la circolazione e ridurre la tensione muscolare profonda." },
  ]);

  const [employees, setEmployees] = useState<string[]>([""]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [doneSlug, setDoneSlug] = useState<string | null>(null);

  function setHour(i: number, patch: Partial<HourRow>) {
    setHours((prev) => prev.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  }
  function setService(i: number, patch: Partial<ServiceRow>) {
    setServices((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  async function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError("Inserisci il nome dell'attività.");
      return;
    }
    const cleanServices = services.filter((s) => s.name.trim());
    if (cleanServices.length === 0) {
      setError("Aggiungi almeno un servizio.");
      return;
    }
    const cleanEmployees = employees.filter((e) => e.trim());
    if (cleanEmployees.length === 0) {
      setError("Aggiungi almeno un operatore.");
      return;
    }

    const payload: OnboardingPayload = {
      name,
      phone,
      address,
      hours: hours.map((h) => ({
        weekday: h.weekday,
        isClosed: h.isClosed,
        open: h.open,
        close: h.close,
        breakStart: null,
        breakEnd: null,
      })),
      services: cleanServices.map((s) => ({
        name: s.name,
        durationMin: s.duration,
        priceCents: eurosToCents(s.price),
        description: s.description,
      })),
      employees: cleanEmployees.map((n, i) => ({
        name: n,
        color: EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length],
      })),
    };

    setSaving(true);
    const res = await createBusiness(payload);
    setSaving(false);
    if (!res.ok || !res.slug) {
      setError(res.error ?? "Qualcosa è andato storto.");
      return;
    }
    setDoneSlug(res.slug);
  }

  if (doneSlug) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col justify-center px-5 py-10">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.bouncy}
          className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#34c759] text-3xl text-white"
        >
          ✓
        </motion.div>
        <h1 className="text-2xl font-extrabold text-[#4D5A46] text-center tracking-tight">Tutto pronto!</h1>
        <p className="mt-2 text-center text-[#8C9A86] text-sm">
          Stampa o condividi questo QR code. I clienti lo inquadrano e prenotano
          da soli.
        </p>
        <div className="mt-6">
          <QRCard url={`${baseUrl}/b/${doneSlug}`} businessSlug={doneSlug} />
        </div>
        <button
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
          className="w-full ios-btn-primary h-12 mt-5 text-sm font-bold border-none cursor-pointer"
        >
          Vai all&apos;agenda
        </button>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <h1 className="text-2xl font-extrabold text-[#4D5A46] tracking-tight">Configura la tua attività</h1>
      <p className="mt-2 text-[#8C9A86] text-sm">
        Un paio di minuti e sei pronto a ricevere prenotazioni.
      </p>

      {/* Business */}
      <Section title="La tua attività" icon="storefront">
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46]"
          placeholder="Nome (es. Salone Bellezza)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46] mt-3"
          placeholder="Telefono (facoltativo)"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-medium text-[#4D5A46] mt-3"
          placeholder="Indirizzo (facoltativo)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Section>

      {/* Hours */}
      <Section title="Orari di apertura" icon="schedule">
        <div className="divide-y divide-[var(--line)]">
          {hours.map((h, i) => (
            <div key={h.weekday} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 sm:py-2.5">
              <div className="flex items-center justify-between w-full sm:w-auto sm:gap-3">
                <span className="w-24 shrink-0 font-bold text-sm text-[#4D5A46]">
                  {WEEKDAYS_LONG[h.weekday]}
                </span>
                <div className="sm:hidden">
                  <Toggle
                    checked={!h.isClosed}
                    onChange={(v) => setHour(i, { isClosed: !v })}
                    label={`Aperto ${WEEKDAYS_LONG[h.weekday]}`}
                  />
                </div>
              </div>
              {h.isClosed ? (
                <span className="flex-1 text-[#8C9A86] text-left text-xs font-semibold">Chiuso</span>
              ) : (
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <div className="flex items-center gap-1.5 w-full sm:w-48">
                    <input
                      type="time"
                      value={h.open}
                      onChange={(e) => setHour(i, { open: e.target.value })}
                      className="h-10 flex-1 px-2 text-center text-xs text-[#4D5A46] font-medium rounded-xl border border-[var(--line)] outline-none focus:border-[var(--ink)] bg-[#FAF8F5]"
                    />
                    <span className="text-[#8C9A86]">–</span>
                    <input
                      type="time"
                      value={h.close}
                      onChange={(e) => setHour(i, { close: e.target.value })}
                      className="h-10 flex-1 px-2 text-center text-xs text-[#4D5A46] font-medium rounded-xl border border-[var(--line)] outline-none focus:border-[var(--ink)] bg-[#FAF8F5]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHours(prev => prev.map((row) => {
                        if (row.isClosed) return row;
                        return { ...row, open: h.open, close: h.close };
                      }));
                    }}
                    className="h-8 px-3 mt-1.5 rounded-full bg-[#FAF8F5] border border-[var(--line)] text-[9px] font-extrabold text-[#90702e] hover:bg-[#F4F1EB] uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all self-end"
                  >
                    <span className="material-symbols-outlined text-[10px]">content_copy</span> Applica a tutti
                  </button>
                </div>
              )}
              <div className="hidden sm:block">
                <Toggle
                  checked={!h.isClosed}
                  onChange={(v) => setHour(i, { isClosed: !v })}
                  label={`Aperto ${WEEKDAYS_LONG[h.weekday]}`}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#8C9A86] font-medium mt-2">
          Le pause (es. pranzo) si aggiungono dopo, dalle impostazioni.
        </p>
      </Section>

      {/* Services */}
      <Section title="Listino e durate" icon="content_cut">
        <div className="space-y-4">
          {services.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl bg-white p-5 border border-[var(--line)] space-y-4 relative shadow-sm text-left"
            >
              {/* Remove button at top right */}
              {services.length > 1 && (
                <button
                  type="button"
                  onClick={() => setServices((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Rimuovi servizio"
                  className="absolute top-4 right-4 text-[#ba1a1a] hover:opacity-80 transition-opacity font-bold text-xs p-1 cursor-pointer border-none bg-transparent"
                >
                  ✕ Rimuovi
                </button>
              )}

              {/* NOME SERVIZIO */}
              <div>
                <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Nome Servizio</label>
                <input
                  className="w-full h-12 rounded-xl bg-[#FAF8F5] border border-[var(--line)] px-4 outline-none focus:border-[var(--ink)] text-sm font-semibold text-[#4D5A46] transition-all"
                  placeholder="es. Taglio capelli, Massaggio..."
                  value={s.name}
                  onChange={(e) => setService(i, { name: e.target.value })}
                />
              </div>

              {/* DESCRIZIONE */}
              <div>
                <label className="text-[10px] font-bold text-[#8C9A86] uppercase tracking-wider mb-1 block">Descrizione</label>
                <textarea
                  className="w-full h-24 rounded-xl bg-[#FAF8F5] border border-[var(--line)] p-3 outline-none focus:border-[var(--ink)] text-sm text-[#4D5A46] font-medium resize-none transition-all"
                  placeholder="Scrivi qui una breve descrizione del servizio..."
                  value={s.description}
                  onChange={(e) => setService(i, { description: e.target.value })}
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
                        value={s.durationHoursRaw !== undefined ? s.durationHoursRaw : Math.floor(s.duration / 60)}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setService(i, { durationHoursRaw: "" });
                          } else {
                            const h = Math.max(0, Math.min(12, Number(val)));
                            const m = s.durationMinutesRaw !== undefined && s.durationMinutesRaw !== "" ? Number(s.durationMinutesRaw) : (s.duration % 60);
                            setService(i, { duration: h * 60 + m, durationHoursRaw: val });
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
                        value={s.durationMinutesRaw !== undefined ? s.durationMinutesRaw : s.duration % 60}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setService(i, { durationMinutesRaw: "" });
                          } else {
                            const h = s.durationHoursRaw !== undefined && s.durationHoursRaw !== "" ? Number(s.durationHoursRaw) : Math.floor(s.duration / 60);
                            const m = Math.max(0, Math.min(59, Number(val)));
                            setService(i, { duration: h * 60 + m, durationMinutesRaw: val });
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
                      className="w-full bg-transparent outline-none text-lg font-bold text-[#4D5A46]"
                      placeholder="0,00"
                      value={s.price}
                      onChange={(e) => setService(i, { price: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setServices((prev) => [...prev, { name: "", duration: 30, price: "", description: "" }])
          }
          className="mt-3 text-xs font-bold text-[#4D5A46] uppercase tracking-wider hover:opacity-85 border-none bg-transparent cursor-pointer"
        >
          + Aggiungi servizio
        </button>
      </Section>

      {/* Employees */}
      <Section title="Operatori" icon="group">
        <div className="space-y-2.5">
          {employees.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="h-8 w-8 shrink-0 rounded-full"
                style={{ background: EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length] }}
              />
              <input
                className="h-11 flex-1 text-[#4D5A46] font-medium border border-[var(--line)] rounded-xl focus:border-[var(--ink)] bg-[#FAF8F5] px-4 text-sm"
                placeholder={`Nome operatore ${i + 1}`}
                value={e}
                onChange={(ev) =>
                  setEmployees((prev) =>
                    prev.map((x, j) => (j === i ? ev.target.value : x)),
                  )
                }
              />
              {employees.length > 1 && (
                <button
                  onClick={() =>
                    setEmployees((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label="Rimuovi operatore"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#8C9A86] transition-colors active:bg-[#FAF8F5] border-none bg-transparent cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setEmployees((prev) => [...prev, ""])}
          className="mt-1 text-xs font-bold text-[#4D5A46] uppercase tracking-wider hover:opacity-85 border-none bg-transparent cursor-pointer"
        >
          + Aggiungi operatore
        </button>
      </Section>

      {error && (
        <p className="mt-5 rounded-xl bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2.5 text-xs font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      <footer className="material pb-safe fixed inset-x-0 bottom-0 border-t border-[var(--line)] px-5 pt-3 pb-4 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-[560px]">
          <button
            disabled={saving}
            onClick={submit}
            className="w-full h-12 rounded-full ios-btn-primary font-bold text-sm tracking-wider flex items-center justify-center gap-2 border-none cursor-pointer"
          >
            {saving ? "Salvataggio..." : (initialBusiness ? "Salva configurazione e genera QR" : "Crea attività e genera QR")}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ios-card mt-5 space-y-3 p-5 border border-[var(--line)] bg-white shadow-sm">
      <h2 className="text-base font-bold text-[#4D5A46] flex items-center gap-2 tracking-tight">
        <span className="material-symbols-outlined text-[#4D5A46] text-[20px]">{icon}</span> {title}
      </h2>
      {children}
    </section>
  );
}
