"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { spring, stepVariants } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { formatDuration, formatPrice } from "@/lib/constants";
import { buildDays } from "@/lib/days";
import type { Business, Employee, Service } from "@/lib/types";

type Slot = { time: string; startUtc: string };
type Step = "service" | "operator" | "when" | "details" | "done";
const ORDER: Step[] = ["service", "operator", "when", "details"];

const STEP_TITLES: Record<Step, string> = {
  service: "Scegli il servizio",
  operator: "Scegli l'operatore",
  when: "Scegli data e ora",
  details: "I tuoi dati",
  done: "",
};

export function BookingFlow({
  business,
  services,
  employees,
  todayStr,
  closedWeekdays,
}: {
  business: Business;
  services: Service[];
  employees: Employee[];
  todayStr: string;
  closedWeekdays: number[];
}) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState<Step>("service");
  const [dir, setDir] = useState(1);

  const [service, setService] = useState<Service | null>(null);
  const [operator, setOperator] = useState<string>("any");

  const days = useMemo(
    () => buildDays(todayStr, business.booking_horizon_days),
    [todayStr, business.booking_horizon_days],
  );
  const closedSet = useMemo(() => new Set(closedWeekdays), [closedWeekdays]);
  const firstOpen = useMemo(
    () => days.find((d) => !closedSet.has(d.weekday0)) ?? days[0],
    [days, closedSet],
  );

  const [dateStr, setDateStr] = useState<string>(firstOpen?.dateStr ?? todayStr);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [closed, setClosed] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ whenText: string } | null>(null);

  const go = (next: Step, direction = 1) => {
    setDir(direction);
    setStep(next);
  };
  const back = () => {
    const i = ORDER.indexOf(step);
    if (i > 0) go(ORDER[i - 1], -1);
  };

  // Load availability whenever we're on the "when" step and its inputs change.
  useEffect(() => {
    if (step !== "when" || !service) return;
    const ctrl = new AbortController();
    setLoadingSlots(true);
    setClosed(false);
    setSlots([]);
    const url =
      `/api/availability?slug=${encodeURIComponent(business.slug)}` +
      `&service=${service.id}&employee=${operator}&date=${dateStr}`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setSlots(d.slots ?? []);
        setClosed(Boolean(d.closed));
      })
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
    return () => ctrl.abort();
  }, [step, service, operator, dateStr, business.slug]);

  const selectService = (s: Service) => {
    setService(s);
    setSlot(null);
    go("operator");
  };
  const selectOperator = (id: string) => {
    setOperator(id);
    setSlot(null);
    go("when");
  };
  const selectSlot = (s: Slot) => {
    setSlot(s);
    setError(null);
    go("details");
  };

  const operatorName =
    operator === "any"
      ? "Primo disponibile"
      : (employees.find((e) => e.id === operator)?.name ?? "");
  const selectedDay = days.find((d) => d.dateStr === dateStr);
  const whenLabel = selectedDay
    ? `${selectedDay.weekdayLabel} ${selectedDay.dayNum} ${selectedDay.monthLabel}` +
      (slot ? ` · ${slot.time}` : "")
    : "";

  const phoneDigits = phone.replace(/\D/g, "");
  const canSubmit =
    name.trim().length >= 2 && phoneDigits.length >= 6 && !!slot && !!service;

  async function submit() {
    if (!service || !slot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: business.slug,
          serviceId: service.id,
          employeeId: operator,
          startUtc: slot.startUtc,
          name: name.trim(),
          phone: phone.trim(),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Si è verificato un errore.");
        setSubmitting(false);
        if (res.status === 409) {
          setSlot(null);
          go("when", -1);
        }
        return;
      }
      setResult({ whenText: data.whenText });
      setSubmitting(false);
      go("done");
    } catch {
      setError("Errore di rete. Riprova.");
      setSubmitting(false);
    }
  }

  if (step === "done" && service && slot) {
    return (
      <DoneScreen
        businessName={business.name}
        serviceName={service.name}
        operatorName={operatorName}
        whenText={result?.whenText ?? whenLabel}
        startUtc={slot.startUtc}
        durationMin={service.duration_min}
      />
    );
  }

  const progress = (ORDER.indexOf(step) + 1) / ORDER.length;

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col bg-[var(--bg)]">
      {/* Header */}
      <header className="material pt-safe sticky top-0 z-20">
        <div className="flex h-14 items-center gap-2 px-4">
          {step !== "service" ? (
            <button
              onClick={back}
              aria-label="Indietro"
              className="-ml-2 grid h-10 w-10 place-items-center rounded-full transition-colors active:bg-[var(--surface-2)]"
            >
              <ChevronLeft />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
          <div className="min-w-0 flex-1 text-center">
            <div className="text-headline truncate leading-tight">
              {business.name}
            </div>
            <div className="text-caption">{STEP_TITLES[step]}</div>
          </div>
          <div className="h-10 w-10" />
        </div>
        <div className="h-[3px] bg-[var(--surface-2)]">
          <motion.div
            className="h-full rounded-r-full bg-[var(--accent)]"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={spring.default}
          />
        </div>
      </header>

      {/* Step content */}
      <main className="relative flex-1 px-5 py-5">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            variants={reduce ? undefined : stepVariants}
            initial={reduce ? { opacity: 0 } : "enter"}
            animate={reduce ? { opacity: 1 } : "center"}
            exit={reduce ? { opacity: 0 } : "exit"}
            transition={spring.snappy}
          >
            {step === "service" && (
              <StepList>
                {services.length === 0 && (
                  <Empty text="Nessun servizio disponibile al momento." />
                )}
                {services.map((s) => (
                  <RowButton key={s.id} onClick={() => selectService(s)}>
                    <div className="min-w-0 flex-1">
                      <div className="text-headline truncate">{s.name}</div>
                      <div className="text-caption mt-0.5">
                        {formatDuration(s.duration_min)} · {formatPrice(s.price_cents)}
                      </div>
                    </div>
                    <ChevronRight />
                  </RowButton>
                ))}
              </StepList>
            )}

            {step === "operator" && (
              <StepList>
                <RowButton onClick={() => selectOperator("any")}>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--accent-soft)] text-lg">
                    ✨
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-headline">Primo disponibile</div>
                    <div className="text-caption mt-0.5">
                      Ti assegniamo chi è libero prima
                    </div>
                  </div>
                  <ChevronRight />
                </RowButton>
                {employees.map((e) => (
                  <RowButton key={e.id} onClick={() => selectOperator(e.id)}>
                    <Avatar name={e.name} color={e.color} />
                    <div className="min-w-0 flex-1">
                      <div className="text-headline truncate">{e.name}</div>
                    </div>
                    <ChevronRight />
                  </RowButton>
                ))}
              </StepList>
            )}

            {step === "when" && (
              <div>
                <DatePicker
                  value={dateStr}
                  onChange={(d) => {
                    setDateStr(d);
                    setSlot(null);
                  }}
                  todayStr={todayStr}
                  horizonDays={business.booking_horizon_days}
                  closedWeekdays={closedWeekdays}
                />

                <div className="mt-5">
                  {loadingSlots ? (
                    <SlotsSkeleton />
                  ) : closed ? (
                    <Empty text="Chiuso in questo giorno." />
                  ) : slots.length === 0 ? (
                    <Empty text="Nessun orario disponibile. Prova un altro giorno." />
                  ) : (
                    <motion.div
                      className="grid grid-cols-3 gap-2 sm:grid-cols-4"
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={spring.snappy}
                    >
                      {slots.map((sl) => (
                        <button
                          key={sl.startUtc}
                          onClick={() => selectSlot(sl)}
                          className="h-11 rounded-[var(--r-md)] bg-[var(--surface-2)] text-[0.95rem] font-[560] transition-[transform,background-color] duration-100 active:scale-[0.95] active:bg-[var(--accent-soft)]"
                        >
                          {sl.time}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {step === "details" && (
              <div>
                <div className="card mb-5 divide-y divide-[var(--line)] overflow-hidden">
                  <SummaryRow label="Servizio" value={service?.name ?? ""} extra={service ? formatPrice(service.price_cents) : ""} />
                  <SummaryRow label="Operatore" value={operatorName} />
                  <SummaryRow label="Quando" value={whenLabel} />
                </div>

                <div className="space-y-3">
                  <Field label="Nome e cognome">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Es. Anna Rossi"
                      autoComplete="name"
                      className="input"
                    />
                  </Field>
                  <Field label="Numero WhatsApp">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Es. 340 123 4567"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className="input"
                    />
                    <p className="text-caption mt-1.5 px-1">
                      Ti scriveremo qui solo se serve modificare l&apos;appuntamento.
                    </p>
                  </Field>
                  <Field label="Note (facoltativo)">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Qualcosa che dovremmo sapere?"
                      rows={2}
                      className="input resize-none py-2.5"
                    />
                  </Field>
                </div>

                {error && (
                  <p className="mt-4 rounded-[var(--r-sm)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-3 py-2.5 text-[0.9rem] text-[var(--danger)]">
                    {error}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer CTA (only where a commit action exists) */}
      {step === "details" && (
        <footer className="material pb-safe sticky bottom-0 border-t border-[var(--line)] px-5 pt-3 pb-4">
          <Button
            fullWidth
            size="lg"
            loading={submitting}
            disabled={!canSubmit}
            onClick={submit}
          >
            Conferma prenotazione
          </Button>
        </footer>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Sub-components                                                    */
/* ---------------------------------------------------------------- */

function StepList({ children }: { children: React.ReactNode }) {
  return (
    <div className="card divide-y divide-[var(--line)] overflow-hidden">
      {children}
    </div>
  );
}

function RowButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-[var(--surface-2)]"
    >
      {children}
    </button>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      style={{ background: color }}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full font-[600] text-white"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-caption w-24 shrink-0">{label}</span>
      <span className="flex-1 font-[540]">{value}</span>
      {extra && <span className="text-[var(--ink-2)]">{extra}</span>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[0.85rem] font-[560] text-[var(--ink-2)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-[var(--r-lg)] bg-[var(--surface-2)] px-4 py-10 text-center text-[var(--ink-2)]">
      {text}
    </div>
  );
}

function SlotsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="h-11 animate-pulse rounded-[var(--r-md)] bg-[var(--surface-2)]"
        />
      ))}
    </div>
  );
}

function DoneScreen({
  businessName,
  serviceName,
  operatorName,
  whenText,
  startUtc,
  durationMin,
}: {
  businessName: string;
  serviceName: string;
  operatorName: string;
  whenText: string;
  startUtc: string;
  durationMin: number;
}) {
  const reduce = useReducedMotion();
  const gcal = googleCalendarUrl({
    title: `${serviceName} — ${businessName}`,
    startUtc,
    durationMin,
    details: `Operatore: ${operatorName}`,
  });

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={spring.bouncy}
        className="grid h-20 w-20 place-items-center rounded-full bg-[var(--success)] text-white"
      >
        <Check />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.default, delay: reduce ? 0 : 0.08 }}
        className="mt-6"
      >
        <h1 className="text-title">Prenotazione confermata</h1>
        <p className="mt-2 text-[var(--ink-2)]">
          {serviceName} con {operatorName}
        </p>
        <p className="mt-1 text-[1.05rem] font-[560] capitalize">{whenText}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.default, delay: reduce ? 0 : 0.16 }}
        className="mt-8 w-full space-y-3"
      >
        <a href={gcal} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" size="lg" fullWidth>
            Aggiungi al calendario
          </Button>
        </a>
        <p className="text-caption">Ti aspettiamo da {businessName}! 💇</p>
      </motion.div>
    </main>
  );
}

function googleCalendarUrl(o: {
  title: string;
  startUtc: string;
  durationMin: number;
  details: string;
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(o.startUtc);
  const end = new Date(start.getTime() + o.durationMin * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: o.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: o.details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* Icons */
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0 text-[var(--ink-3)]">
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="text-[var(--ink)]">
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Check() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
