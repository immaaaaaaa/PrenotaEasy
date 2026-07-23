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
    { name: "Taglio", duration: 30, price: "20" },
    { name: "Piega", duration: 30, price: "15" },
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
          className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[var(--success)] text-3xl text-white"
        >
          ✓
        </motion.div>
        <h1 className="text-title text-center">Tutto pronto!</h1>
        <p className="mt-2 text-center text-[var(--ink-2)]">
          Stampa o condividi questo QR code. I clienti lo inquadrano e prenotano
          da soli.
        </p>
        <div className="mt-6">
          <QRCard url={`${baseUrl}/b/${doneSlug}`} businessSlug={doneSlug} />
        </div>
        <Button
          size="lg"
          fullWidth
          className="mt-5"
          onClick={() => {
            router.push("/dashboard");
            router.refresh();
          }}
        >
          Vai all&apos;agenda
        </Button>
      </main>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-5 pb-28 pt-8">
      <h1 className="text-title">Configura la tua attività</h1>
      <p className="mt-2 text-[var(--ink-2)]">
        Un paio di minuti e sei pronto a ricevere prenotazioni.
      </p>

      {/* Business */}
      <Section title="La tua attività" emoji="🏠">
        <input
          className="input"
          placeholder="Nome (es. Salone Bellezza)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input"
          placeholder="Telefono (facoltativo)"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <input
          className="input"
          placeholder="Indirizzo (facoltativo)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </Section>

      {/* Hours */}
      <Section title="Orari di apertura" emoji="🕒">
        <div className="divide-y divide-[var(--line)]">
          {hours.map((h, i) => (
            <div key={h.weekday} className="flex items-center gap-3 py-2.5">
              <span className="w-24 shrink-0 font-[540]">
                {WEEKDAYS_LONG[h.weekday]}
              </span>
              {h.isClosed ? (
                <span className="flex-1 text-[var(--ink-3)]">Chiuso</span>
              ) : (
                <div className="flex flex-1 items-center gap-1.5">
                  <input
                    type="time"
                    value={h.open}
                    onChange={(e) => setHour(i, { open: e.target.value })}
                    className="input h-10 flex-1 px-2 text-center"
                  />
                  <span className="text-[var(--ink-3)]">–</span>
                  <input
                    type="time"
                    value={h.close}
                    onChange={(e) => setHour(i, { close: e.target.value })}
                    className="input h-10 flex-1 px-2 text-center"
                  />
                </div>
              )}
              <Toggle
                checked={!h.isClosed}
                onChange={(v) => setHour(i, { isClosed: !v })}
                label={`Aperto ${WEEKDAYS_LONG[h.weekday]}`}
              />
            </div>
          ))}
        </div>
        <p className="text-caption">
          Le pause (es. pranzo) si aggiungono dopo, dalle impostazioni.
        </p>
      </Section>

      {/* Services */}
      <Section title="Listino e durate" emoji="✂️">
        <div className="space-y-2.5">
          {services.map((s, i) => (
            <div
              key={i}
              className="rounded-[var(--r-md)] bg-[var(--surface-2)] p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  className="input h-11 flex-1 bg-[var(--surface)]"
                  placeholder="Nome servizio"
                  value={s.name}
                  onChange={(e) => setService(i, { name: e.target.value })}
                />
                {services.length > 1 && (
                  <button
                    onClick={() =>
                      setServices((prev) => prev.filter((_, j) => j !== i))
                    }
                    aria-label="Rimuovi servizio"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--ink-3)] transition-colors active:bg-[var(--surface-3)]"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 rounded-[var(--r-sm)] bg-[var(--surface)] px-3 h-11">
                  <span className="text-[0.85rem] text-[var(--ink-2)]">Durata</span>
                  <select
                    className="flex-1 bg-transparent text-right outline-none"
                    value={s.duration}
                    onChange={(e) =>
                      setService(i, { duration: Number(e.target.value) })
                    }
                  >
                    {DURATION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {formatDuration(d)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex w-[120px] items-center gap-1 rounded-[var(--r-sm)] bg-[var(--surface)] px-3 h-11">
                  <span className="text-[var(--ink-2)]">€</span>
                  <input
                    inputMode="decimal"
                    className="w-full bg-transparent outline-none"
                    placeholder="0"
                    value={s.price}
                    onChange={(e) => setService(i, { price: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() =>
            setServices((prev) => [...prev, { name: "", duration: 30, price: "" }])
          }
          className="mt-1 text-[0.95rem] font-[560] text-[var(--accent)]"
        >
          + Aggiungi servizio
        </button>
      </Section>

      {/* Employees */}
      <Section title="Operatori" emoji="👥">
        <div className="space-y-2.5">
          {employees.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="h-8 w-8 shrink-0 rounded-full"
                style={{ background: EMPLOYEE_COLORS[i % EMPLOYEE_COLORS.length] }}
              />
              <input
                className="input h-11 flex-1"
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
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--ink-3)] transition-colors active:bg-[var(--surface-2)]"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setEmployees((prev) => [...prev, ""])}
          className="mt-1 text-[0.95rem] font-[560] text-[var(--accent)]"
        >
          + Aggiungi operatore
        </button>
      </Section>

      {error && (
        <p className="mt-5 rounded-[var(--r-sm)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2.5 text-[0.9rem] text-[var(--danger)]">
          {error}
        </p>
      )}

      <footer className="material pb-safe fixed inset-x-0 bottom-0 border-t border-[var(--line)] px-5 pt-3 pb-4">
        <div className="mx-auto max-w-[560px]">
          <Button size="lg" fullWidth loading={saving} onClick={submit}>
            {initialBusiness ? "Salva configurazione e genera QR" : "Crea attività e genera QR"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card mt-5 space-y-3 p-4">
      <h2 className="text-headline flex items-center gap-2">
        <span>{emoji}</span> {title}
      </h2>
      {children}
    </section>
  );
}
