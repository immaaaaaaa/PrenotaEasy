"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { formatDuration, formatPrice } from "@/lib/constants";
import { buildDays } from "@/lib/days";
import type { Business, Employee, Service } from "@/lib/types";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/Sheet";

type Slot = { time: string; startUtc: string };

function getServiceIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("taglio") || n.includes("barba") || n.includes("capelli") || n.includes("hair")) {
    return "content_cut";
  }
  if (n.includes("viso") || n.includes("facial") || n.includes("trattamento") || n.includes("maschera") || n.includes("rituale")) {
    return "face_5";
  }
  if (n.includes("mani") || n.includes("unghie") || n.includes("manicure") || n.includes("pedicure")) {
    return "pan_tool_alt";
  }
  if (n.includes("colore") || n.includes("tinta") || n.includes("schiariture")) {
    return "palette";
  }
  if (n.includes("piega") || n.includes("styling") || n.includes("asciugatura")) {
    return "air";
  }
  return "spa";
}

function formatHistoryDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MONTH_LABELS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];
const WEEKDAY_SHORT_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

const formatDateLocal = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  const startDay = (date.getDay() + 6) % 7;
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
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
  const [currentTab, setCurrentTab] = useState<"book" | "history" | "profile">("book");

  // Booking states
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

  // Customer details form states
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ whenText: string } | null>(null);
  const [done, setDone] = useState(false);

  // Profile management states
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  // Appointment history states
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // Reschedule state for client
  const [clientRescheduleAppt, setClientRescheduleAppt] = useState<any | null>(null);
  const [clientRescheduleDate, setClientRescheduleDate] = useState(todayStr);
  const [clientRescheduleSlots, setClientRescheduleSlots] = useState<Slot[]>([]);
  const [loadingClientRescheduleSlots, setLoadingClientRescheduleSlots] = useState(false);
  const [clientRescheduleSlot, setClientRescheduleSlot] = useState<Slot | null>(null);
  const [reschedulingPending, setReschedulingPending] = useState(false);

  // Client calendar picker states
  const [clientCalendarOpen, setClientCalendarOpen] = useState(false);
  const [clientCalendarYear, setClientCalendarYear] = useState(new Date(dateStr || todayStr).getFullYear());
  const [clientCalendarMonth, setClientCalendarMonth] = useState(new Date(dateStr || todayStr).getMonth());

  const clientMonthDays = useMemo(() => {
    return getDaysInMonth(clientCalendarYear, clientCalendarMonth);
  }, [clientCalendarYear, clientCalendarMonth]);

  useEffect(() => {
    if (!clientRescheduleAppt) return;
    const s = services.find(sv => sv.name === clientRescheduleAppt.service_name);
    if (!s) return;

    const ctrl = new AbortController();
    setLoadingClientRescheduleSlots(true);
    setClientRescheduleSlots([]);
    setClientRescheduleSlot(null);

    const url =
      `/api/availability?slug=${encodeURIComponent(business.slug)}` +
      `&service=${s.id}&employee=${clientRescheduleAppt.employee_id}&date=${clientRescheduleDate}`;

    fetch(url, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        setClientRescheduleSlots(d.slots ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingClientRescheduleSlots(false));

    return () => ctrl.abort();
  }, [clientRescheduleAppt, clientRescheduleDate, services, business.slug]);

  async function submitClientReschedule() {
    if (!clientRescheduleAppt || !clientRescheduleSlot) return;
    const savedPhone = localStorage.getItem("customer_phone") || phone;
    if (!savedPhone) return;

    setReschedulingPending(true);
    try {
      const res = await fetch("/api/client-appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appointmentId: clientRescheduleAppt.id,
          phone: savedPhone,
          action: "reschedule",
          newStartUtc: clientRescheduleSlot.startUtc,
        }),
      });

      if (res.ok) {
        setClientRescheduleAppt(null);
        loadHistory();
        alert("Appuntamento spostato con successo!");
      } else {
        const data = await res.json();
        alert(data.error ?? "Errore nello spostamento.");
      }
    } catch {
      alert("Errore di rete. Riprova.");
    } finally {
      setReschedulingPending(false);
    }
  }

  // Load saved credentials on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedName = localStorage.getItem("customer_name");
      const savedPhone = localStorage.getItem("customer_phone");
      if (savedName) {
        setName(savedName);
        setProfileName(savedName);
      }
      if (savedPhone) {
        setPhone(savedPhone);
        setProfilePhone(savedPhone);
      }
    }
  }, []);

  // Fetch client appointments history
  const loadHistory = useCallback(async () => {
    const savedPhone = localStorage.getItem("customer_phone") || phone;
    if (!savedPhone) return;

    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/client-appointments?phone=${encodeURIComponent(savedPhone)}&slug=${encodeURIComponent(business.slug)}`);
      const data = await res.json();
      if (!res.ok) {
        setHistoryError(data.error ?? "Errore nel caricamento della cronologia.");
      } else {
        setHistory(data.appointments ?? []);
      }
    } catch {
      setHistoryError("Impossibile connettersi al server.");
    } finally {
      setLoadingHistory(false);
    }
  }, [business.slug, phone]);

  useEffect(() => {
    if (currentTab === "history") {
      loadHistory();
    }
  }, [currentTab, loadHistory]);

  const clientCancelAppointment = async (apptId: string) => {
    const savedPhone = localStorage.getItem("customer_phone") || phone;
    if (!savedPhone) return;
    if (!confirm("Sei sicuro di voler annullare questo appuntamento?")) return;

    setCancellingId(apptId);
    try {
      const res = await fetch(`/api/client-appointments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appointmentId: apptId, phone: savedPhone }),
      });
      if (res.ok) {
        loadHistory();
      } else {
        const data = await res.json();
        alert(data.error ?? "Errore nell'annullamento.");
      }
    } catch {
      alert("Errore di rete.");
    } finally {
      setCancellingId(null);
    }
  };

  // Load availability whenever inputs change
  useEffect(() => {
    if (!service) return;
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
  }, [service, operator, dateStr, business.slug]);

  const selectService = (s: Service) => {
    setService(s);
    setSlot(null);
    setTimeout(() => {
      document.getElementById("professional-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const selectDate = (dayStr: string) => {
    setDateStr(dayStr);
    setSlot(null);
    setTimeout(() => {
      document.getElementById("time-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const selectOperator = (id: string) => {
    setOperator(id);
    setSlot(null);
    setTimeout(() => {
      document.getElementById("date-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const selectSlot = (s: Slot) => {
    setSlot(s);
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
          setDetailsOpen(false);
        }
        return;
      }

      // Save details to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("customer_name", name.trim());
        localStorage.setItem("customer_phone", phone.trim());
        setProfileName(name.trim());
        setProfilePhone(phone.trim());
      }

      setResult({ whenText: data.whenText });
      setSubmitting(false);
      setDetailsOpen(false);
      setDone(true);
    } catch {
      setError("Errore di rete. Riprova.");
      setSubmitting(false);
    }
  }

  function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileName.trim() || !profilePhone.trim()) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("customer_name", profileName.trim());
      localStorage.setItem("customer_phone", profilePhone.trim());
      setName(profileName.trim());
      setPhone(profilePhone.trim());
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    }
  }

  // Filter history into upcoming vs past
  const upcomingAppts = useMemo(() => {
    const now = new Date();
    return history.filter((a) => {
      const isFuture = new Date(a.starts_at) >= now;
      return isFuture && a.status === "booked";
    });
  }, [history]);

  const pastAppts = useMemo(() => {
    const now = new Date();
    return history.filter((a) => {
      const isPast = new Date(a.starts_at) < now;
      return isPast || a.status !== "booked";
    });
  }, [history]);

  // Group slots
  const morningSlots = useMemo(() => slots.filter((s) => s.time < "13:00"), [slots]);
  const afternoonSlots = useMemo(() => slots.filter((s) => s.time >= "13:00"), [slots]);

  if (done && service && slot) {
    return (
      <DoneScreen
        businessName={business.name}
        serviceName={service.name}
        operatorName={operatorName}
        whenText={result?.whenText ?? whenLabel}
        startUtc={slot.startUtc}
        durationMin={service.duration_min}
        onReset={() => {
          setDone(false);
          setService(null);
          setSlot(null);
          setCurrentTab("history");
        }}
      />
    );
  }

  return (
    <div className="bg-[#FAF8F5] text-[#4D5A46] font-sans min-h-screen pb-40">
      {/* Header */}
      <header className="w-full top-0 sticky z-50 bg-[#FAF8F5]/90 backdrop-blur-md flex justify-between items-center px-6 py-6 border-b border-[#E8E4DE]/30">
        <div className="flex flex-col gap-0.5 cursor-pointer active:scale-95 duration-200 transition-opacity hover:opacity-80">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">spa</span>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">PrenotaEasy</h1>
          </div>
          <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.1em] text-[#8C9A86] ml-8">
            {business.name}
          </p>
        </div>
      </header>

      <main className="px-6 max-w-screen-md mx-auto">
        {/* Tab 1: BOOK (Booking Flow) */}
        {currentTab === "book" && (
          <div>
            {/* Hero Section */}
            <section className="mt-8 mb-10">
              <h2 className="font-serif text-3xl md:text-4xl font-semibold text-primary mb-2">
                Prenota il tuo Rituale
              </h2>
              <p className="text-[#8C9A86] font-medium max-w-[85%]">
                Seleziona i servizi e l'orario che preferisci per un'esperienza di bellezza personalizzata.
              </p>
            </section>

            {/* Select Service Section */}
            <section id="services-section" className="mb-10">
              <div className="flex justify-between items-baseline mb-6">
                <h3 className="font-serif text-xl font-medium text-primary">Seleziona Servizio</h3>
                <span className="text-xs font-semibold text-primary uppercase border-b border-primary/30 pb-0.5">
                  Menu completo
                </span>
              </div>
              <div className="space-y-4">
                {services.map((s) => {
                  const isSelected = service?.id === s.id;
                  const iconName = getServiceIcon(s.name);
                  return (
                    <div
                      key={s.id}
                      onClick={() => selectService(s)}
                      className={cn(
                        "group flex items-center p-4 rounded-2xl border cursor-pointer transition-all duration-300",
                        isSelected
                          ? "bg-white border-[#4D5A46] service-card-active"
                          : "bg-[#F4F1EB] border-transparent hover:bg-white hover:shadow-sm"
                      )}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#FAF8F5] mr-4 flex items-center justify-center text-primary/70 shrink-0">
                        <span className="material-symbols-outlined text-[32px]">{iconName}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-[18px] text-[#4D5A46] font-bold truncate">{s.name}</p>
                        <p className="text-sm text-[#8C9A86] font-medium">
                          {formatDuration(s.duration_min)} · {formatPrice(s.price_cents)}
                        </p>
                      </div>
                      <span className={cn("material-symbols-outlined transition-colors", isSelected ? "text-primary" : "text-[#8C9A86] group-hover:text-primary")}>
                        {iconName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Choose Professional Section */}
            <section id="professional-section" className={cn("mb-10 transition-opacity duration-300", !service && "opacity-40 pointer-events-none")}>
              <h3 className="font-serif text-xl font-medium text-primary mb-6">Scegli l'Operatore</h3>
              {!service && (
                <p className="text-sm text-[#8C9A86] italic mb-4">Seleziona prima un servizio per scegliere l'operatore.</p>
              )}
              <div className="flex gap-8 overflow-x-auto no-scrollbar py-2">
                <div className="flex flex-col items-center gap-3 cursor-pointer group shrink-0" onClick={() => selectOperator("any")}>
                  <div
                    className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center bg-[#F4F1EB] text-primary transition-all duration-300",
                      operator === "any" ? "professional-avatar-active shadow-md" : "group-hover:scale-105"
                    )}
                  >
                    <span className="material-symbols-outlined text-[28px]">shuffle</span>
                  </div>
                  <span className="text-xs font-semibold text-on-surface">Qualsiasi</span>
                </div>

                {employees.map((e) => {
                  const isSelected = operator === e.id;
                  return (
                    <div key={e.id} className="flex flex-col items-center gap-3 cursor-pointer group shrink-0" onClick={() => selectOperator(e.id)}>
                      <div
                        style={{ backgroundColor: e.color }}
                        className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center text-white font-serif text-2xl font-bold transition-all duration-300",
                          isSelected ? "professional-avatar-active shadow-md" : "group-hover:scale-105"
                        )}
                      >
                        {e.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-on-surface">{e.name}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Date Selector Section */}
            <section id="date-section" className={cn("mb-10 transition-opacity duration-300", !service && "opacity-40 pointer-events-none")}>
              <div className="flex justify-between items-baseline mb-6">
                <h3 className="font-serif text-xl font-medium text-primary">Scegli la Data</h3>
                <button
                  onClick={() => setClientCalendarOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase border-b border-primary/30 pb-0.5 cursor-pointer hover:opacity-85 active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  Vedi Calendario
                </button>
              </div>
              {!service && (
                <p className="text-sm text-[#8C9A86] italic mb-4">Seleziona prima un servizio e operatore per vedere le date.</p>
              )}
              <div className="flex overflow-x-auto no-scrollbar gap-4 pb-4 -mx-1 px-1 snap-x">
                {days.map((day) => {
                  const isClosed = closedSet.has(day.weekday0);
                  const isSelected = dateStr === day.dateStr;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => !isClosed && selectDate(day.dateStr)}
                      className={cn(
                        "flex-shrink-0 flex flex-col items-center justify-center w-[72px] h-[96px] rounded-2xl cursor-pointer transition-all duration-200 snap-center select-none",
                        isSelected
                          ? "active-date"
                          : isClosed
                          ? "border border-[#E8E4DE] bg-[#F4F1EB] opacity-30 cursor-not-allowed"
                          : "border border-[#E8E4DE]/50 bg-[#F4F1EB] hover:bg-white hover:border-[#4D5A46]/30"
                      )}
                    >
                      <span className={cn("text-[10px] font-semibold uppercase tracking-widest", isSelected ? "text-white/80" : "text-[#8C9A86]")}>
                        {day.monthLabel}
                      </span>
                      <span className="font-serif text-[24px] font-bold leading-none my-1">
                        {day.dayNum}
                      </span>
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wider", isSelected ? "text-white/80" : "text-[#8C9A86]")}>
                        {day.weekdayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Time Grid Section */}
            <section id="time-section" className={cn("mb-10 transition-opacity duration-300", (!service || !dateStr) && "opacity-40 pointer-events-none")}>
              <h3 className="font-serif text-xl font-medium text-primary mb-6">Scegli l'Orario</h3>
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-full bg-[#F4F1EB]" />
                  ))}
                </div>
              ) : closed ? (
                <p className="text-sm text-[#8C9A86] italic">Chiuso in questo giorno.</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-[#8C9A86] italic">Nessun orario disponibile. Prova un altro giorno.</p>
              ) : (
                <div className="space-y-6">
                  {/* Mattino */}
                  {morningSlots.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[#8C9A86] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">light_mode</span> Mattino
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {morningSlots.map((sl) => {
                          const isSelected = slot?.startUtc === sl.startUtc;
                          return (
                            <button
                              key={sl.startUtc}
                              onClick={() => selectSlot(sl)}
                              className={cn(
                                "px-6 py-2.5 rounded-full border text-sm font-semibold transition-all duration-200 cursor-pointer",
                                isSelected
                                  ? "border-[#4D5A46] time-chip-active text-white bg-[#4D5A46]"
                                  : "border-[#E8E4DE]/50 bg-[#F4F1EB] text-[#4D5A46] hover:border-[#4D5A46]"
                              )}
                            >
                              {sl.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pomeriggio */}
                  {afternoonSlots.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[#8C9A86] uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">dark_mode</span> Pomeriggio
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {afternoonSlots.map((sl) => {
                          const isSelected = slot?.startUtc === sl.startUtc;
                          return (
                            <button
                              key={sl.startUtc}
                              onClick={() => selectSlot(sl)}
                              className={cn(
                                "px-6 py-2.5 rounded-full border text-sm font-semibold transition-all duration-200 cursor-pointer",
                                isSelected
                                  ? "border-[#4D5A46] time-chip-active text-white bg-[#4D5A46]"
                                  : "border-[#E8E4DE]/50 bg-[#F4F1EB] text-[#4D5A46] hover:border-[#4D5A46]"
                              )}
                            >
                              {sl.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Sticky Bottom button */}
            {service && slot && (
              <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/95 to-transparent pt-16 pb-24 z-40 flex justify-center">
                <button
                  onClick={() => setDetailsOpen(true)}
                  className="w-full max-w-screen-sm h-14 rounded-full satin-gold font-sans text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98] transition-transform duration-200 cursor-pointer"
                >
                  Prenota Ora
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: HISTORY (Cronologia & Reschedule / Cancel) */}
        {currentTab === "history" && (
          <div className="mt-8">
            <h2 className="font-serif text-2xl font-bold text-primary mb-2">I miei Appuntamenti</h2>
            <p className="text-[#8C9A86] text-sm mb-6">Visualizza i dettagli delle tue prenotazioni e le formule del salone.</p>

            {!phone ? (
              <div className="glass-card rounded-2xl p-6 text-center space-y-4">
                <span className="material-symbols-outlined text-4xl text-[#8C9A86]">account_box</span>
                <p className="text-sm font-medium">Non hai configurato il tuo profilo. Inserisci il tuo numero per vedere la cronologia.</p>
                <button
                  onClick={() => setCurrentTab("profile")}
                  className="px-6 h-11 rounded-full bg-[#4D5A46] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                >
                  Imposta Profilo
                </button>
              </div>
            ) : loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-[#F4F1EB]" />
                ))}
              </div>
            ) : historyError ? (
              <p className="text-sm text-[#ba1a1a] font-semibold">{historyError}</p>
            ) : history.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center space-y-3 text-[#8C9A86]">
                <span className="material-symbols-outlined text-4xl">calendar_today</span>
                <p className="text-sm font-medium">Nessuna prenotazione trovata per il numero {phone}.</p>
                <button
                  onClick={() => setCurrentTab("book")}
                  className="mt-2 text-xs font-bold text-[#4D5A46] uppercase tracking-wider border-b border-[#4D5A46]/30 pb-0.5 cursor-pointer"
                >
                  Prenota il tuo primo rituale →
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Upcoming Bookings */}
                {upcomingAppts.length > 0 && (
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#4D5A46] mb-4 border-b border-[#E8E4DE]/50 pb-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-md">event</span> Prossimi Appuntamenti
                    </h3>
                    <div className="space-y-4">
                      {upcomingAppts.map((a) => {
                        const emp = employees.find((e) => e.id === a.employee_id);
                        return (
                          <div key={a.id} className="glass-card rounded-2xl p-5 shadow-sm space-y-4 relative border border-[#4D5A46]/10">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-serif text-lg font-bold text-[#4D5A46]">{a.service_name}</h4>
                                <p className="text-xs text-[#8C9A86] mt-0.5">{formatHistoryDate(a.starts_at)} · Con {emp?.name ?? "Primo disponibile"}</p>
                              </div>
                              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#b3cea7]/30 text-[#4D5A46]">Confermato</span>
                            </div>

                            {a.owner_notes && (
                              <div className="bg-[#FAF8F5] rounded-xl p-3 border border-[#E8E4DE]/60 text-xs">
                                <span className="font-bold text-[#4D5A46] block mb-1">💡 Dettagli Trattamento:</span>
                                <span className="text-[#5e5e5c] italic leading-relaxed">{a.owner_notes}</span>
                              </div>
                            )}

                            <div className="flex justify-end gap-2.5 pt-1">
                              <button
                                onClick={() => {
                                  setClientRescheduleAppt(a);
                                  setClientRescheduleDate(a.starts_at.slice(0, 10));
                                }}
                                className="h-10 px-5 rounded-full border border-[#4D5A46] text-[#4D5A46] hover:bg-[#F4F1EB] text-xs font-bold cursor-pointer transition-colors active:scale-95 duration-200"
                              >
                                Modifica
                              </button>
                              <button
                                disabled={cancellingId === a.id}
                                onClick={() => clientCancelAppointment(a.id)}
                                className="h-10 px-5 rounded-full border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ba1a1a]/5 text-xs font-bold cursor-pointer transition-colors active:scale-95 duration-200"
                              >
                                {cancellingId === a.id ? "Annullamento..." : "Disdici"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Past & Cancelled Bookings */}
                {pastAppts.length > 0 && (
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#4D5A46] mb-4 border-b border-[#E8E4DE]/50 pb-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-md">history</span> Storico Appuntamenti
                    </h3>
                    <div className="space-y-4">
                      {pastAppts.map((a) => {
                        const emp = employees.find((e) => e.id === a.employee_id);
                        const isCancelled = a.status === "cancelled";
                        return (
                          <div key={a.id} className="glass-card rounded-2xl p-5 shadow-sm space-y-4 opacity-75">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-serif text-lg font-bold text-[#4D5A46]">{a.service_name}</h4>
                                <p className="text-xs text-[#8C9A86] mt-0.5">{formatHistoryDate(a.starts_at)} · Con {emp?.name ?? "Primo disponibile"}</p>
                              </div>
                              <span className={cn(
                                "text-[10px] uppercase font-bold px-2 py-0.5 rounded",
                                isCancelled ? "bg-[#ba1a1a]/10 text-[#ba1a1a]" : "bg-[#F4F1EB] text-[#5e5e5c]"
                              )}>
                                {isCancelled ? "Annullato" : "Passato"}
                              </span>
                            </div>

                            {a.owner_notes && (
                              <div className="bg-[#FAF8F5] rounded-xl p-3 border border-[#E8E4DE]/60 text-xs">
                                <span className="font-bold text-[#4D5A46] block mb-1">💡 Dettagli Trattamento:</span>
                                <span className="text-[#5e5e5c] italic leading-relaxed">{a.owner_notes}</span>
                              </div>
                            )}

                            {!isCancelled && (
                              <div className="flex justify-end pt-1">
                                <button
                                  onClick={() => {
                                    // Pre-populate service selection and go to book tab
                                    const s = services.find((sv) => sv.name === a.service_name);
                                    if (s) setService(s);
                                    setCurrentTab("book");
                                  }}
                                  className="px-4 py-2 rounded-lg border border-[#4D5A46] text-[#4D5A46] hover:bg-[#4D5A46]/5 text-xs font-bold cursor-pointer transition-colors active:scale-95 duration-200"
                                >
                                  Prenota di nuovo
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: PROFILE (Inserimento dati personali) */}
        {currentTab === "profile" && (
          <div className="mt-8 max-w-sm mx-auto">
            <h2 className="font-serif text-2xl font-bold text-primary mb-2">Profilo Personale</h2>
            <p className="text-[#8C9A86] text-sm mb-6">Salva i tuoi contatti per visualizzare la cronologia ed evitare di digitarli ogni volta.</p>

            <form onSubmit={saveProfile} className="space-y-4 glass-card rounded-2xl p-6 border border-[#c3c8bd]/30 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-[#4D5A46] mb-1.5 px-1 uppercase tracking-wider">
                  Nome e cognome
                </label>
                <input
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Es. Anna Rossi"
                  className="w-full h-12 rounded-xl bg-[#F4F1EB] text-[#4D5A46] placeholder-[#8C9A86]/70 px-4 outline-none border border-transparent focus:border-[#4D5A46] transition-all font-medium text-sm shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4D5A46] mb-1.5 px-1 uppercase tracking-wider">
                  Numero WhatsApp
                </label>
                <input
                  required
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="Es. 340 123 4567"
                  className="w-full h-12 rounded-xl bg-[#F4F1EB] text-[#4D5A46] placeholder-[#8C9A86]/70 px-4 outline-none border border-transparent focus:border-[#4D5A46] transition-all font-medium text-sm shadow-sm"
                />
              </div>

              {profileSaved && (
                <p className="text-xs font-bold text-[#4a6243] px-1 animate-pulse">✓ Modifiche salvate con successo!</p>
              )}

              <button
                type="submit"
                className="w-full h-12 rounded-xl bg-[#4D5A46] text-white font-semibold text-sm active:scale-[0.98] transition-transform duration-200 cursor-pointer hover:opacity-95"
              >
                Salva Profilo
              </button>
            </form>

            {profilePhone && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    if (confirm("Vuoi scollegare questo numero dal dispositivo?")) {
                      localStorage.clear();
                      setName("");
                      setPhone("");
                      setProfileName("");
                      setProfilePhone("");
                      setHistory([]);
                    }
                  }}
                  className="text-xs font-bold text-[#ba1a1a] uppercase tracking-wider cursor-pointer hover:opacity-80"
                >
                  Scollega account locale
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-md z-50 bg-white shadow-[0_-8px_30px_rgba(77,90,70,0.06)] flex justify-around items-center px-6 py-4 pb-safe border-t border-[#E8E4DE]/20">
        <button
          onClick={() => setCurrentTab("book")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 p-2 active:scale-95 duration-200 cursor-pointer",
            currentTab === "book" ? "text-[#4D5A46] font-bold" : "text-[#8C9A86] hover:opacity-80"
          )}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: currentTab === "book" ? "'FILL' 1" : undefined }}>content_cut</span>
          <span className="font-semibold text-[10px] uppercase tracking-wider">Prenota</span>
        </button>
        <button
          onClick={() => setCurrentTab("history")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 p-2 active:scale-95 duration-200 cursor-pointer",
            currentTab === "history" ? "text-[#4D5A46] font-bold" : "text-[#8C9A86] hover:opacity-80"
          )}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: currentTab === "history" ? "'FILL' 1" : undefined }}>event_upcoming</span>
          <span className="font-semibold text-[10px] uppercase tracking-wider">Miei Appuntamenti</span>
        </button>
        <button
          onClick={() => setCurrentTab("profile")}
          className={cn(
            "flex flex-col items-center justify-center gap-1 p-2 active:scale-95 duration-200 cursor-pointer",
            currentTab === "profile" ? "text-[#4D5A46] font-bold" : "text-[#8C9A86] hover:opacity-80"
          )}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: currentTab === "profile" ? "'FILL' 1" : undefined }}>person</span>
          <span className="font-semibold text-[10px] uppercase tracking-wider">Profilo</span>
        </button>
      </nav>

      {/* Customer Details input Sheet (during Booking flow) */}
      <Sheet open={detailsOpen} onClose={() => setDetailsOpen(false)} title="I Tuoi Dati" dismissible={true}>
        <div className="space-y-5 py-2">
          {/* Booking Summary Box */}
          <div className="rounded-2xl bg-[#F4F1EB] p-5 border border-[#E8E4DE] space-y-3 shadow-sm">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#8C9A86] font-semibold">Servizio:</span>
              <span className="font-bold font-serif text-[#4D5A46]">
                {service?.name} ({formatPrice(service?.price_cents ?? 0)})
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-[#E8E4DE]/50 pt-3">
              <span className="text-[#8C9A86] font-semibold">Operatore:</span>
              <span className="font-bold text-[#4D5A46]">{operatorName}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-t border-[#E8E4DE]/50 pt-3">
              <span className="text-[#8C9A86] font-semibold">Quando:</span>
              <span className="font-bold text-[#4D5A46]">{whenLabel}</span>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#4D5A46] mb-1.5 px-1">
                Nome e cognome
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Anna Rossi"
                autoComplete="name"
                className="w-full h-12 rounded-xl bg-[#F4F1EB] text-[#4D5A46] placeholder-[#8C9A86]/70 px-4 outline-none border border-transparent focus:border-[#4D5A46] transition-all font-medium shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4D5A46] mb-1.5 px-1">
                Numero WhatsApp
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Es. 340 123 4567"
                autoComplete="tel"
                className="w-full h-12 rounded-xl bg-[#F4F1EB] text-[#4D5A46] placeholder-[#8C9A86]/70 px-4 outline-none border border-transparent focus:border-[#4D5A46] transition-all font-medium shadow-sm"
              />
              <span className="block mt-2 text-xs text-[#8C9A86] px-1 font-medium leading-relaxed">
                Ti contatteremo qui in caso di variazioni.
              </span>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#4D5A46] mb-1.5 px-1">
                Note (facoltativo)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es. Esigenze particolari..."
                rows={3}
                className="w-full rounded-xl bg-[#F4F1EB] text-[#4D5A46] placeholder-[#8C9A86]/70 px-4 py-3 outline-none border border-transparent focus:border-[#4D5A46] transition-all font-medium resize-none shadow-sm"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-[#ba1a1a]/10 px-4 py-3 text-sm font-semibold text-[#ba1a1a] border border-[#ba1a1a]/20">
              {error}
            </p>
          )}

          <button
            disabled={!canSubmit || submitting}
            onClick={submit}
            className={cn(
              "flex w-full h-14 items-center justify-center gap-2.5 rounded-2xl text-white font-serif text-[1.1rem] font-bold shadow-md transition-all duration-200 select-none cursor-pointer",
              canSubmit && !submitting
                ? "bg-gradient-to-r from-[#D4AF37] to-[#C59B27] hover:scale-[1.01] hover:brightness-[1.05] active:scale-[0.98]"
                : "bg-[#8C9A86]/40 cursor-not-allowed text-white/60"
            )}
          >
            {submitting ? "Registrazione..." : "Conferma Prenotazione"}
          </button>
        </div>
      </Sheet>

      {/* Client Rescheduling Modal */}
      {clientRescheduleAppt && (
        <Sheet
          open={!!clientRescheduleAppt}
          onClose={() => setClientRescheduleAppt(null)}
          title="Modifica Orario Appuntamento"
          dismissible={true}
        >
          <div className="space-y-5 py-2">
            <div className="rounded-2xl bg-[#F4F1EB] p-4 border border-[#E8E4DE] text-sm text-[#4D5A46] space-y-1">
              <p className="font-serif font-bold text-base">{clientRescheduleAppt.service_name}</p>
              <p className="text-xs text-[#8C9A86]">
                Operatore: {employees.find(e => e.id === clientRescheduleAppt.employee_id)?.name ?? "Qualsiasi"}
              </p>
            </div>

            {/* Date selector */}
            <div>
              <label className="block text-xs font-bold text-[#4D5A46] mb-1.5 px-1 uppercase tracking-wider">
                Seleziona Nuova Data
              </label>
              <input
                type="date"
                min={todayStr}
                value={clientRescheduleDate}
                onChange={(e) => setClientRescheduleDate(e.target.value)}
                className="w-full h-12 rounded-xl bg-[#F4F1EB] text-[#4D5A46] px-4 outline-none border border-transparent focus:border-[#4D5A46] transition-all font-medium text-sm shadow-sm"
              />
            </div>

            {/* Slots selector */}
            <div>
              <label className="block text-xs font-bold text-[#4D5A46] mb-2 px-1 uppercase tracking-wider">
                Seleziona Nuovo Orario
              </label>
              {loadingClientRescheduleSlots ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-full bg-[#F4F1EB]" />
                  ))}
                </div>
              ) : clientRescheduleSlots.length === 0 ? (
                <p className="text-xs text-[#8C9A86] italic px-1">
                  Nessun orario disponibile per la data selezionata.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                  {clientRescheduleSlots.map((sl) => {
                    const isSel = clientRescheduleSlot?.startUtc === sl.startUtc;
                    return (
                      <button
                        key={sl.startUtc}
                        onClick={() => setClientRescheduleSlot(sl)}
                        className={cn(
                          "px-4 py-2 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer",
                          isSel
                            ? "border-[#4D5A46] bg-[#4D5A46] text-white"
                            : "border-[#E8E4DE]/50 bg-[#F4F1EB] text-[#4D5A46] hover:border-[#4D5A46]"
                        )}
                      >
                        {sl.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Confirm button */}
            <button
              disabled={!clientRescheduleSlot || reschedulingPending}
              onClick={submitClientReschedule}
              className={cn(
                "w-full h-12 rounded-full font-semibold text-sm active:scale-[0.98] transition-transform duration-200 cursor-pointer flex items-center justify-center text-[#4D5A46]",
                clientRescheduleSlot && !reschedulingPending
                  ? "bg-[#f2b33d]"
                  : "bg-[#8C9A86]/20 text-[#4D5A46]/40 cursor-not-allowed"
              )}
            >
              {reschedulingPending ? "Spostamento..." : "Conferma Spostamento"}
            </button>
          </div>
        </Sheet>
      )}

      {/* Client Monthly Calendar Picker Modal */}
      {clientCalendarOpen && (
        <Sheet
          open={clientCalendarOpen}
          onClose={() => setClientCalendarOpen(false)}
          title="Seleziona Data di Prenotazione"
          dismissible={true}
        >
          <div className="space-y-4 py-2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-serif text-lg font-bold text-[#4D5A46]">
                {MONTH_LABELS[clientCalendarMonth]} {clientCalendarYear}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (clientCalendarMonth === 0) {
                      setClientCalendarMonth(11);
                      setClientCalendarYear(y => y - 1);
                    } else {
                      setClientCalendarMonth(m => m - 1);
                    }
                  }}
                  className="p-2 rounded-full hover:bg-[#F4F1EB] active:scale-95 material-symbols-outlined text-[#4D5A46]"
                >
                  chevron_left
                </button>
                <button
                  onClick={() => {
                    if (clientCalendarMonth === 11) {
                      setClientCalendarMonth(0);
                      setClientCalendarYear(y => y + 1);
                    } else {
                      setClientCalendarMonth(m => m + 1);
                    }
                  }}
                  className="p-2 rounded-full hover:bg-[#F4F1EB] active:scale-95 material-symbols-outlined text-[#4D5A46]"
                >
                  chevron_right
                </button>
              </div>
            </div>

            {/* Days Grid Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#8C9A86] tracking-wider mb-2">
              {WEEKDAY_SHORT_LABELS.map((w, idx) => (
                <div key={idx}>{w}</div>
              ))}
            </div>

            {/* Days Cells */}
            <div className="grid grid-cols-7 gap-1.5 text-center font-medium">
              {clientMonthDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const isSelected = dateStr === formatDateLocal(day);
                
                // Horizon and Past calculations
                const today = new Date(todayStr);
                today.setHours(0,0,0,0);
                const targetDay = new Date(day);
                targetDay.setHours(0,0,0,0);
                const isPast = targetDay < today;
                
                const horizonDate = new Date(today.getTime() + business.booking_horizon_days * 24 * 60 * 60 * 1000);
                horizonDate.setHours(23, 59, 59, 999);
                const isBeyond = targetDay > horizonDate;
                
                const isDayClosed = closedSet.has((day.getDay() + 6) % 7); // match employee weekday index
                const isDisabled = isPast || isBeyond || isDayClosed;

                return (
                  <button
                    key={day.toISOString()}
                    disabled={isDisabled}
                    onClick={() => {
                      setDateStr(formatDateLocal(day));
                      setClientCalendarOpen(false);
                      // Scroll to time slots
                      setTimeout(() => {
                        document.getElementById("time-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 150);
                    }}
                    className={cn(
                      "h-9 w-full rounded-full flex items-center justify-center relative text-xs active:scale-95 transition-all cursor-pointer",
                      isSelected
                        ? "bg-[#4D5A46] !text-white font-bold"
                        : isDisabled
                        ? "text-[#8C9A86]/30 cursor-not-allowed line-through"
                        : "hover:bg-[#F4F1EB] text-[#4D5A46]"
                    )}
                  >
                    <span className={cn(isSelected && "!text-white")}>{day.getDate()}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="pt-2 text-center">
              <button 
                onClick={() => setClientCalendarOpen(false)}
                className="text-xs font-bold text-[#8C9A86] uppercase tracking-wider cursor-pointer hover:opacity-80"
              >
                Chiudi
              </button>
            </div>
          </div>
        </Sheet>
      )}
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
  onReset,
}: {
  businessName: string;
  serviceName: string;
  operatorName: string;
  whenText: string;
  startUtc: string;
  durationMin: number;
  onReset: () => void;
}) {
  const gcal = googleCalendarUrl({
    title: `${serviceName} — ${businessName}`,
    startUtc,
    durationMin,
    details: `Operatore: ${operatorName}`,
  });

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[520px] flex-col items-center justify-center bg-[#FAF8F5] px-6 py-12 text-center border-x border-[#EADFCB]/40 shadow-xl">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-[#f2b33d] text-white shadow-md animate-bounce">
        <span className="material-symbols-outlined text-[40px] text-white">check</span>
      </div>

      <div className="mt-6 space-y-2">
        <h2 className="text-3xl font-serif font-bold italic text-[#4D5A46]">
          Prenotazione Confermata
        </h2>
        <p className="text-[#8C9A86] font-medium text-sm">
          Ti abbiamo riservato il posto con successo!
        </p>
      </div>

      <div className="mt-8 w-full rounded-2xl bg-[#F4F1EB] p-6 border border-[#E8E4DE] space-y-4 text-left max-w-sm mx-auto shadow-sm">
        <div>
          <span className="text-xs text-[#8C9A86] font-semibold block tracking-wider">SERVIZIO</span>
          <span className="font-serif text-lg font-bold text-[#4D5A46]">{serviceName}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-[#E8E4DE]/50 pt-3">
          <div>
            <span className="text-xs text-[#8C9A86] font-semibold block tracking-wider">OPERATORE</span>
            <span className="font-bold text-[#4D5A46]">{operatorName}</span>
          </div>
          <div>
            <span className="text-xs text-[#8C9A86] font-semibold block tracking-wider">DURATA</span>
            <span className="font-bold text-[#4D5A46]">{durationMin} min</span>
          </div>
        </div>
        <div className="border-t border-[#E8E4DE]/50 pt-3">
          <span className="text-xs text-[#8C9A86] font-semibold block tracking-wider">DATA & ORA</span>
          <span className="font-bold text-[#4D5A46] capitalize">{whenText}</span>
        </div>
      </div>

      <div className="mt-8 w-full max-w-sm space-y-3">
        <a
          href={gcal}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-full h-12 rounded-full border border-[#4D5A46] text-[#4D5A46] font-semibold text-sm transition-all hover:bg-[#F4F1EB] active:scale-[0.98]"
        >
          Aggiungi a Google Calendar
        </a>
        <button
          onClick={onReset}
          className="w-full h-12 rounded-full bg-[#f2b33d] text-[#4D5A46] font-semibold text-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
        >
          Vai ai miei appuntamenti
        </button>
        <p className="text-xs text-[#8C9A86] font-medium pt-4">
          Ti aspettiamo da {businessName}! 💇
        </p>
      </div>
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
