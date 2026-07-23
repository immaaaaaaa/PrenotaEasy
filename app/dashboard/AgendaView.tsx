"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fmtTime, dayKey } from "@/lib/time";
import { addDaysStr, dayTitle, relLabel } from "@/lib/days";
import { formatPrice } from "@/lib/constants";
import type { Appointment, Employee, Service } from "@/lib/types";
import {
  cancelAppointment,
  createOwnerAppointment,
  getDayAppointments,
  rescheduleAppointment,
  updateOwnerNotes,
  getClients,
  getClientHistory,
} from "./actions";

const MONTH_LABELS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];
const WEEKDAY_SHORT_LABELS = ["L", "M", "M", "G", "V", "S", "D"];

const TIMELINE_SLOTS = [
  "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00",
  "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
  "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
];

const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month, 1);
  const days = [];
  // Convert starting weekday (0 = Monday, ..., 6 = Sunday)
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

const formatDateLocal = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


export function AgendaView({
  business,
  timezone,
  employees,
  services,
  todayStr,
}: {
  business: any;
  timezone: string;
  employees: Employee[];
  services: Service[];
  todayStr: string;
}) {
  const tz = timezone;
  const router = useRouter();

  // Navigation tabs state
  const [ownerTab, setOwnerTab] = useState<"dashboard" | "calendar" | "clients">("dashboard");

  // QR Code share modal states
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Date and appointments states
  const [date, setDate] = useState(todayStr);
  const [filter, setFilter] = useState<string>("all");
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // Appt detail sheet states
  const [active, setActive] = useState<Appointment | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // Calendar states
  const [currentYear, setCurrentYear] = useState(new Date(date).getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date(date).getMonth());

  // Client list states
  const [allClients, setAllClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [clientHistory, setClientHistory] = useState<Appointment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Synchronize tab with query params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "calendar" || tab === "clients" || tab === "dashboard") {
        setOwnerTab(tab as any);
      }
    }
  }, []);

  const empById = useMemo(
    () => new Map(employees.map((e) => [e.id, e])),
    [employees],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAppts(await getDayAppointments(date));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const loadClientList = useCallback(async () => {
    setLoadingClients(true);
    try {
      const data = await getClients();
      setAllClients(data);
    } catch {
      console.error("Failed to load clients");
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    if (ownerTab === "clients") {
      loadClientList();
    }
  }, [ownerTab, loadClientList]);

  // Load client details history
  const loadClientHistoryDetails = async (client: any) => {
    setSelectedClient(client);
    setLoadingHistory(true);
    try {
      const historyData = await getClientHistory(client.phone);
      setClientHistory(historyData);
    } catch {
      console.error("Failed to load client history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const visible = appts.filter((a) => filter === "all" || a.employee_id === filter);
  const rel = relLabel(date, todayStr);

  // Bento Metrics calculations
  const apptsCount = appts.length;
  const totalRevenue = appts.reduce((sum, a) => sum + (a.price_cents ?? 0), 0);
  const uniqueClients = useMemo(() => {
    return new Set(appts.map((a) => a.customer_name.trim().toLowerCase())).size;
  }, [appts]);

  // Determine which appointment is currently "LIVE" (in progress)
  const liveApptId = useMemo(() => {
    if (date !== todayStr) return null;
    const now = new Date();
    const live = appts.find((a) => {
      const start = new Date(a.starts_at);
      const end = new Date(a.ends_at);
      return now >= start && now <= end;
    });
    return live?.id ?? null;
  }, [appts, date, todayStr]);

  // iOS Calendar month grid
  const monthDays = useMemo(() => {
    return getDaysInMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const selectCalendarDate = (d: Date) => {
    setDate(formatDateLocal(d));
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, apptId: string) => {
    e.dataTransfer.setData("text/plain", apptId);
  };

  const handleDrop = async (e: React.DragEvent, employeeId: string, timeStr: string) => {
    e.preventDefault();
    const apptId = e.dataTransfer.getData("text/plain");
    if (!apptId) return;

    const targetAppt = appts.find(a => a.id === apptId);
    if (!targetAppt) return;

    // Reschedule appointment
    setLoading(true);
    const res = await rescheduleAppointment({
      id: apptId,
      dateStr: date,
      timeStr,
      employeeId,
    });
    if (res.ok) {
      load();
      alert(`Appuntamento di ${targetAppt.customer_name} spostato a ${res.whenText}!`);
    } else {
      setLoading(false);
      alert(res.error ?? "Impossibile spostare l'appuntamento.");
    }
  };

  const isOccupied = (employeeId: string, slotTimeStr: string) => {
    return appts.some(a => {
      if (a.employee_id !== employeeId || a.status === "cancelled") return false;
      const apptStart = fmtTime(new Date(a.starts_at), tz);
      const apptEnd = fmtTime(new Date(a.ends_at), tz);
      return slotTimeStr >= apptStart && slotTimeStr < apptEnd;
    });
  };

  const getApptStartSlot = (employeeId: string, slotTimeStr: string) => {
    return appts.find(a => {
      if (a.employee_id !== employeeId || a.status === "cancelled") return false;
      const apptStart = fmtTime(new Date(a.starts_at), tz);
      return apptStart === slotTimeStr;
    });
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    return allClients.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  }, [allClients, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1b1c1c] pb-24 font-sans">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-40 bg-[#FAF8F5]/85 backdrop-blur-md border-b border-[#c3c8bd]/30">
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

      <main className="max-w-7xl mx-auto px-6 mt-6">
        {/* TAB 1: DASHBOARD */}
        {ownerTab === "dashboard" && (
          <div>
            {/* Dashboard Title */}
            <div className="mb-8">
              <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#4a6243]">Dashboard Titolare</h2>
              <p className="text-[#5e5e5c] text-sm">Benvenuto, ecco la panoramica di oggi.</p>
            </div>

            {/* Key Bento Metrics */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="glass-card rounded-xl p-5 shadow-[0_4px_20px_rgba(74,98,67,0.04)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200">
                <span className="text-[#5e5e5c] text-xs font-semibold uppercase tracking-wider">Appuntamenti Oggi</span>
                <div className="flex items-end justify-between">
                  <span className="font-serif text-3xl font-bold text-[#4a6243]">{apptsCount}</span>
                  <span className="text-[#4a6243] bg-[#b3cea7]/30 px-2.5 py-1 rounded-full text-xs font-bold">Oggi</span>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5 shadow-[0_4px_20px_rgba(74,98,67,0.04)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform border-l-4 border-[#e9c176] duration-200">
                <span className="text-[#5e5e5c] text-xs font-semibold uppercase tracking-wider">Ricavo Totale</span>
                <div className="flex items-end justify-between">
                  <span className="font-serif text-3xl font-bold text-[#4a6243]">{formatPrice(totalRevenue)}</span>
                  <span className="material-symbols-outlined text-[#755717]">payments</span>
                </div>
              </div>
              <div className="glass-card rounded-xl p-5 shadow-[0_4px_20px_rgba(74,98,67,0.04)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200">
                <span className="text-[#5e5e5c] text-xs font-semibold uppercase tracking-wider">Nuovi Clienti</span>
                <div className="flex items-end justify-between">
                  <span className="font-serif text-3xl font-bold text-[#4a6243]">{uniqueClients}</span>
                  <div className="flex -space-x-2">
                    {appts.slice(0, 3).map((a) => (
                      <div
                        key={a.id}
                        className="w-8 h-8 rounded-full border-2 border-[#FAF8F5] bg-[#b3cea7] text-white flex items-center justify-center text-[10px] font-bold"
                      >
                        {a.customer_name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {uniqueClients > 3 && (
                      <div className="w-8 h-8 rounded-full border-2 border-[#FAF8F5] bg-[#e9c176] flex items-center justify-center text-[10px] font-bold text-white">
                        +{uniqueClients - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="mb-8">
              <h3 className="text-xs font-semibold text-[#5e5e5c] uppercase tracking-widest mb-4">Azioni Rapide</h3>
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                <button
                  onClick={() => setNewOpen(true)}
                  className="flex-shrink-0 h-14 px-6 rounded-full bg-[#ffdea5] text-[#261900] font-semibold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                  Aggiungi Appuntamento
                </button>
                <button
                  onClick={() => router.push("/dashboard/settings")}
                  className="flex-shrink-0 h-14 px-6 rounded-full border border-[#4a6243] text-[#4a6243] font-semibold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#4a6243]/5 active:scale-95 transition-all cursor-pointer shadow-sm bg-white/50"
                >
                  <span className="material-symbols-outlined text-lg">settings_suggest</span>
                  Gestisci Servizi
                </button>
                <button
                  onClick={() => router.push("/dashboard/share")}
                  className="flex-shrink-0 h-14 px-6 rounded-full border border-[#4a6243] text-[#4a6243] font-semibold text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-[#4a6243]/5 active:scale-95 transition-all cursor-pointer shadow-sm bg-white/50"
                >
                  <span className="material-symbols-outlined text-lg">monitoring</span>
                  Vedi Analytics
                </button>
              </div>
            </section>

            {/* Daily Timeline */}
            <section className="mb-12">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDate(addDaysStr(date, -1))}
                    className="grid h-10 w-10 place-items-center rounded-full text-[#4a6243] hover:bg-[#F4F1EB] active:scale-95"
                  >
                    <ChevronLeft />
                  </button>
                  <h3 className="font-serif text-xl font-medium text-[#4a6243] capitalize">
                    {rel ?? dayTitle(date)}
                  </h3>
                  <button
                    onClick={() => setDate(addDaysStr(date, 1))}
                    className="grid h-10 w-10 place-items-center rounded-full text-[#4a6243] hover:bg-[#F4F1EB] active:scale-95"
                  >
                    <ChevronRight />
                  </button>
                </div>
                {date !== todayStr && (
                  <span onClick={() => setDate(todayStr)} className="text-[#5e5e5c] text-xs font-semibold underline cursor-pointer hover:opacity-80">
                    Torna a oggi
                  </span>
                )}
              </div>

              {/* Timeline Container */}
              <div className="space-y-4 relative pl-6">
                {visible.length > 0 && (
                  <div className="absolute left-2.5 top-2 bottom-2 w-[1px] bg-[#c3c8bd]"></div>
                )}

                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-[#F4F1EB]" />
                  ))
                ) : visible.length === 0 ? (
                  <div className="py-12 text-center text-[#5e5e5c]">
                    <span className="material-symbols-outlined text-4xl">calendar_today</span>
                    <p className="mt-2 text-sm">Nessun appuntamento per questo giorno.</p>
                  </div>
                ) : (
                  visible.map((a) => {
                    const emp = empById.get(a.employee_id);
                    const isLive = a.id === liveApptId;

                    return (
                      <div key={a.id} className="relative">
                        {isLive ? (
                          <div className="absolute left-[-23px] top-[30px] w-3 h-3 rounded-full bg-[#e9c176] shadow-[0_0_0_6px_rgba(233,193,118,0.2)] animate-pulse z-10"></div>
                        ) : (
                          <div className="absolute left-[-21px] top-[32px] w-2 h-2 rounded-full bg-[#74796f] z-10"></div>
                        )}

                        <div
                          onClick={() => setActive(a)}
                          className={cn(
                            "glass-card rounded-xl p-4 flex justify-between items-center group cursor-pointer hover:shadow-md transition-shadow",
                            isLive && "border-l-4 border-[#755717] bg-white/40 ring-1 ring-[#755717]/10 shadow-lg"
                          )}
                        >
                          <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#F4F1EB] text-primary/70">
                              <span className="material-symbols-outlined text-[28px]">person</span>
                            </div>
                            <div>
                              <p className="font-semibold text-[#4a6243] flex items-center gap-2">
                                {a.customer_name}
                                {isLive && (
                                  <span className="inline-block w-2 h-2 rounded-full bg-[#755717] animate-pulse"></span>
                                )}
                              </p>
                              <p className="text-xs text-[#5e5e5c] mt-0.5">
                                {a.service_name} {emp ? ` · ${emp.name}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-sm font-bold", isLive ? "text-[#755717]" : "text-[#4a6243]")}>
                              {isLive ? "ORA" : fmtTime(new Date(a.starts_at), tz)}
                            </p>
                            <span className="text-[10px] bg-[#e1dfdc] px-2 py-0.5 rounded text-[#5e5e5c] font-semibold mt-1 inline-block">
                              {isLive ? "LIVE" : `${a.duration_min} min`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: CALENDAR (iOS Style, Drag and Drop rescheduling) */}
        {ownerTab === "calendar" && (
          <div>
            {/* iOS Calendar Header Picker */}
            <div className="mb-6 glass-card rounded-2xl p-5 shadow-sm border border-[#c3c8bd]/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-xl font-bold text-[#4a6243]">
                  {MONTH_LABELS[currentMonth]} {currentYear}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      if (currentMonth === 0) {
                        setCurrentMonth(11);
                        setCurrentYear(y => y - 1);
                      } else {
                        setCurrentMonth(m => m - 1);
                      }
                    }}
                    className="p-2 rounded-full hover:bg-[#F4F1EB] active:scale-95 material-symbols-outlined"
                  >
                    chevron_left
                  </button>
                  <button
                    onClick={() => {
                      if (currentMonth === 11) {
                        setCurrentMonth(0);
                        setCurrentYear(y => y + 1);
                      } else {
                        setCurrentMonth(m => m + 1);
                      }
                    }}
                    className="p-2 rounded-full hover:bg-[#F4F1EB] active:scale-95 material-symbols-outlined"
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
              <div className="grid grid-cols-7 gap-1 text-center font-medium">
                {monthDays.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />;
                  const isSelected = date === formatDateLocal(day);
                  const isToday = todayStr === formatDateLocal(day);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => selectCalendarDate(day)}
                      className={cn(
                        "h-10 w-full rounded-full flex flex-col items-center justify-center relative text-sm active:scale-95 transition-all cursor-pointer",
                        isSelected
                          ? "bg-[#4a6243] text-white font-bold"
                          : isToday
                          ? "text-[#ba1a1a] border border-[#ba1a1a]/30 font-bold"
                          : "hover:bg-[#F4F1EB]"
                      )}
                    >
                      <span>{day.getDate()}</span>
                      {/* iOS Style Dot indicator (indicates appointments on that day) */}
                      {isToday && !isSelected && (
                        <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#ba1a1a]"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drag and Drop Hourly Timeline Grid Board */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-serif text-lg font-bold text-[#4a6243]">Tabella Orari per {dayTitle(date)}</h4>
                <p className="text-xs text-[#8C9A86]">Trascina gli appuntamenti sui blocchi liberi per riprogrammare.</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[#c3c8bd]/30 shadow-sm bg-white">
                <table className="w-full min-w-[600px] border-collapse">
                  <thead>
                    <tr className="bg-[#F4F1EB] border-b border-[#c3c8bd]/30 text-left">
                      <th className="p-3 text-xs font-bold text-[#5e5e5c] w-20 border-r border-[#c3c8bd]/20">Ora</th>
                      {employees.map(e => (
                        <th key={e.id} className="p-3 text-xs font-bold text-[#4a6243] border-r border-[#c3c8bd]/20 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                            {e.name}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TIMELINE_SLOTS.map(slot => (
                      <tr key={slot} className="border-b border-[#c3c8bd]/10 h-16">
                        <td className="p-3 text-xs font-bold text-[#5e5e5c] text-center border-r border-[#c3c8bd]/20 bg-[#FAF8F5]/50">
                          {slot}
                        </td>
                        {employees.map(e => {
                          const apptStart = getApptStartSlot(e.id, slot);
                          const occupied = isOccupied(e.id, slot);

                          return (
                            <td
                              key={`${e.id}-${slot}`}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(event) => handleDrop(event, e.id, slot)}
                              className="p-2 border-r border-[#c3c8bd]/15 relative vertical-align-middle"
                            >
                              {apptStart ? (
                                <div
                                  draggable
                                  onDragStart={(event) => handleDragStart(event, apptStart.id)}
                                  onClick={() => setActive(apptStart)}
                                  className="rounded-xl p-2 text-xs cursor-grab active:cursor-grabbing border shadow-sm transition-all flex flex-col justify-between h-full bg-white border-[#c3c8bd]/30 hover:border-[#4a6243] hover:shadow-md"
                                >
                                  <div className="flex justify-between items-start font-bold">
                                    <span className="text-[#4a6243] truncate">{apptStart.customer_name}</span>
                                    <span className="text-[9px] bg-[#FAF8F5] border border-[#c3c8bd]/40 px-1 py-0.5 rounded text-[#5e5e5c] scale-90">
                                      {apptStart.duration_min}m
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-[#8C9A86] truncate mt-1">{apptStart.service_name}</span>
                                </div>
                              ) : occupied ? (
                                // Occupied placeholder block (blank space representing continuation)
                                <div className="h-full w-full bg-[#F4F1EB]/10 rounded-xl" />
                              ) : (
                                // Droppable "Libero" slot cell
                                <div className="h-full w-full border border-dashed border-[#c3c8bd]/40 rounded-xl flex items-center justify-center text-[10px] text-[#8C9A86]/70 hover:bg-[#F4F1EB]/40 hover:border-[#4a6243]/50 transition-all select-none">
                                  Disp.
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CLIENT CONTACTS */}
        {ownerTab === "clients" && (
          <div>
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#4a6243]">Contatti Clienti</h2>
                <p className="text-[#5e5e5c] text-sm">Visualizza la lista dei clienti registrati ed il loro storico trattamenti.</p>
              </div>

              {/* Search bar */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Cerca cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 rounded-xl bg-white border border-[#c3c8bd]/40 outline-none focus:border-[#4a6243] px-10 text-sm font-medium shadow-sm"
                />
                <span className="material-symbols-outlined absolute left-3 top-3 text-[#8C9A86] text-lg">search</span>
              </div>
            </div>

            {loadingClients ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F4F1EB]" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center text-[#5e5e5c]">
                <span className="material-symbols-outlined text-4xl">contacts</span>
                <p className="mt-2 text-sm">Nessun cliente corrispondente alla ricerca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredClients.map(c => (
                  <div
                    key={c.id}
                    onClick={() => loadClientHistoryDetails(c)}
                    className="glass-card rounded-xl p-4 border border-[#c3c8bd]/25 hover:border-[#4a6243] hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="flex gap-4 items-center min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#b3cea7]/30 text-[#4a6243] flex items-center justify-center font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-serif font-bold text-sm text-[#4a6243] truncate">{c.name}</h4>
                        <p className="text-xs text-[#8C9A86] mt-0.5">{c.phone}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[#8C9A86] hover:text-[#4a6243]">chevron_right</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[720px] z-50 bg-[#ffffff] shadow-[0_-4px_20px_rgba(74,98,67,0.04)] border-t border-[#c3c8bd]/30">
        <div className="flex justify-around items-center w-full px-4 py-3 pb-safe max-w-2xl mx-auto">
          <button
            onClick={() => setOwnerTab("dashboard")}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-4 py-1 active:scale-95 transition-transform duration-200 cursor-pointer",
              ownerTab === "dashboard" ? "bg-[#4a6243]/10 text-[#4a6243]" : "text-[#5e5e5c]"
            )}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: ownerTab === "dashboard" ? "'FILL' 1" : undefined }}>
              grid_view
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Dashboard</span>
          </button>
          <button
            onClick={() => setOwnerTab("calendar")}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-4 py-1 active:scale-95 transition-transform duration-200 cursor-pointer",
              ownerTab === "calendar" ? "bg-[#4a6243]/10 text-[#4a6243]" : "text-[#5e5e5c]"
            )}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: ownerTab === "calendar" ? "'FILL' 1" : undefined }}>
              calendar_month
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Calendario</span>
          </button>
          <button
            onClick={() => setOwnerTab("clients")}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-4 py-1 active:scale-95 transition-transform duration-200 cursor-pointer",
              ownerTab === "clients" ? "bg-[#4a6243]/10 text-[#4a6243]" : "text-[#5e5e5c]"
            )}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: ownerTab === "clients" ? "'FILL' 1" : undefined }}>
              group
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Clienti</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/settings")}
            className="flex flex-col items-center justify-center text-[#5e5e5c] p-2 hover:bg-[#F4F1EB] rounded-lg transition-colors active:scale-95 duration-200 cursor-pointer"
          >
            <span className="material-symbols-outlined">content_cut</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">Servizi</span>
          </button>
        </div>
      </nav>

      {/* Appointment detail / edit / cancel sheet */}
      {active && (
        <ApptSheet
          appt={active}
          employees={employees}
          tz={tz}
          onClose={() => setActive(null)}
          onChanged={load}
        />
      )}

      {/* New appointment sheet */}
      <NewApptSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        employees={employees}
        services={services}
        defaultDate={date}
        onCreated={() => {
          setNewOpen(false);
          load();
        }}
      />

      {/* Client Detail & History history sheet */}
      {selectedClient && (
        <Sheet
          open={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          title={`Scheda Cliente: ${selectedClient.name}`}
          dismissible={true}
        >
          <div className="space-y-5 py-2">
            <div className="rounded-2xl border border-[#c3c8bd]/30 divide-y divide-[#c3c8bd]/25 overflow-hidden bg-[#F4F1EB]/50">
              <DetailRow label="Nome" value={selectedClient.name} />
              <DetailRow label="WhatsApp" value={selectedClient.phone} />
            </div>

            <h4 className="font-serif text-md font-bold text-[#4a6243] border-b border-[#c3c8bd]/30 pb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">history</span> Cronologia Trattamenti
            </h4>

            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-[#F4F1EB]" />
                ))}
              </div>
            ) : clientHistory.length === 0 ? (
              <p className="text-xs text-[#5e5e5c] italic">Nessun appuntamento completato in precedenza.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[300px] no-scrollbar">
                {clientHistory.map(a => (
                  <div key={a.id} className="rounded-xl p-3 border border-[#c3c8bd]/30 bg-white shadow-sm space-y-2">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-[#4a6243] text-sm block">{a.service_name}</span>
                        <span className="text-[#8C9A86]">{formatHistoryDate(a.starts_at)}</span>
                      </div>
                      <span className={cn(
                        "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded",
                        a.status === "cancelled" ? "bg-[#ba1a1a]/10 text-[#ba1a1a]" : "bg-[#FAF8F5] text-[#5e5e5c]"
                      )}>
                        {a.status}
                      </span>
                    </div>

                    {a.owner_notes && (
                      <div className="bg-[#F4F1EB]/40 p-2.5 rounded-lg border border-[#c3c8bd]/20 text-[11px] leading-relaxed">
                        <span className="font-bold text-[#4a6243] block mb-0.5">Nota Titolare:</span>
                        <span className="text-[#5e5e5c] italic">{a.owner_notes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button variant="secondary" fullWidth onClick={() => setSelectedClient(null)}>
              Chiudi
            </Button>
          </div>
        </Sheet>
      )}

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

/* Icons */
function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#4D5A46]">
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[#4D5A46]">
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Appt detail & edit sheet */
function ApptSheet({
  appt,
  employees,
  tz,
  onClose,
  onChanged,
}: {
  appt: Appointment;
  employees: Employee[];
  tz: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [result, setResult] = useState<{ text: string; href?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rDate, setRDate] = useState(dayKey(new Date(appt.starts_at), tz));
  const [rTime, setRTime] = useState(fmtTime(new Date(appt.starts_at), tz));
  const [rEmp, setREmp] = useState(appt.employee_id);

  // Owner notes state and handler
  const [oNotes, setONotes] = useState(appt.owner_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function saveNotes() {
    setSavingNotes(true);
    const res = await updateOwnerNotes(appt.id, oNotes);
    setSavingNotes(false);
    if (res.ok) {
      onChanged();
    }
  }

  async function doReschedule() {
    setPending(true);
    setError(null);
    const res = await rescheduleAppointment({
      id: appt.id,
      dateStr: rDate,
      timeStr: rTime,
      employeeId: rEmp,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Errore.");
      return;
    }
    onChanged();
    setResult({
      text: `Spostato a ${res.whenText}.`,
      href: appt.customer_phone ? res.waHref : undefined,
    });
  }

  async function doCancel() {
    setPending(true);
    setError(null);
    const res = await cancelAppointment(appt.id);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Errore.");
      return;
    }
    onChanged();
    setResult({
      text: "Appuntamento annullato.",
      href: appt.customer_phone ? res.waHref : undefined,
    });
  }

  const title =
    result != null ? "Fatto" : mode === "reschedule" ? "Sposta appuntamento" : "Dettagli Appuntamento";

  return (
    <Sheet open onClose={onClose} title={title} dismissible={false}>
      {result ? (
        <div className="space-y-4 text-center">
          <p className="text-[#5e5e5c]">{result.text}</p>
          {result.href ? (
            <>
              <p className="font-semibold text-sm">Avvisa il cliente su WhatsApp:</p>
              <WhatsAppButton href={result.href} />
              <button onClick={onClose} className="w-full py-2.5 text-[#5e5e5c] text-sm font-semibold">
                Chiudi
              </button>
            </>
          ) : (
            <Button fullWidth size="lg" onClick={onClose}>
              Chiudi
            </Button>
          )}
        </div>
      ) : mode === "view" ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#c3c8bd]/30 divide-y divide-[#c3c8bd]/25 overflow-hidden bg-[#F4F1EB]/50">
            <DetailRow label="Cliente" value={appt.customer_name} />
            <DetailRow label="Servizio" value={appt.service_name} />
            <DetailRow
              label="Operatore"
              value={employees.find((e) => e.id === appt.employee_id)?.name ?? "—"}
            />
            <DetailRow
              label="Orario"
              value={`${fmtTime(new Date(appt.starts_at), tz)} – ${fmtTime(new Date(appt.ends_at), tz)}`}
            />
            {appt.customer_phone && (
              <DetailRow label="Telefono" value={appt.customer_phone} />
            )}
            {appt.notes && <DetailRow label="Note Cliente" value={appt.notes} />}
          </div>

          {/* Owner Notes Box */}
          <div className="space-y-1.5 p-1 border-t border-[#c3c8bd]/30 pt-3">
            <label className="block text-xs font-bold text-[#4a6243]">
              Note Trattamento (Cosa hai fatto al cliente)
            </label>
            <textarea
              value={oNotes}
              onChange={(e) => setONotes(e.target.value)}
              placeholder="Inserisci formule colore, taglio o note utili per la prossima volta..."
              rows={3}
              className="w-full rounded-xl bg-[#F4F1EB] text-[#4a6243] placeholder-[#8C9A86]/70 px-4 py-3 outline-none border border-transparent focus:border-[#4a6243] transition-all font-medium resize-none shadow-sm text-sm"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-1 px-4 py-2 bg-[#4a6243] text-white rounded-lg text-xs font-bold hover:bg-[#4a6243]/90 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {savingNotes ? "Salvataggio..." : "Salva Note"}
            </button>
          </div>

          {error && <p className="text-sm font-semibold text-[#ba1a1a]">{error}</p>}

          <div className="space-y-2.5">
            <button
              onClick={() => setMode("reschedule")}
              className="w-full h-12 rounded-xl bg-[#4a6243] text-white font-semibold hover:bg-[#4a6243]/90 transition-all active:scale-[0.98] cursor-pointer"
            >
              Sposta appuntamento
            </button>
            <button
              onClick={doCancel}
              className="w-full h-12 rounded-xl border border-[#ba1a1a] text-[#ba1a1a] font-semibold hover:bg-[#ba1a1a]/5 transition-all active:scale-[0.98] cursor-pointer"
            >
              Annulla appuntamento
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1.5 block px-1 text-xs font-bold text-[#4a6243]">
                Data
              </span>
              <input
                type="date"
                value={rDate}
                onChange={(e) => setRDate(e.target.value)}
                className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243]"
              />
            </label>
            <label className="w-[38%]">
              <span className="mb-1.5 block px-1 text-xs font-bold text-[#4a6243]">
                Ora
              </span>
              <input
                type="time"
                value={rTime}
                onChange={(e) => setRTime(e.target.value)}
                className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243] text-center"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block px-1 text-xs font-bold text-[#4a6243]">
              Operatore
            </span>
            <select
              value={rEmp}
              onChange={(e) => setREmp(e.target.value)}
              className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243]"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="px-1 text-sm font-semibold text-[#ba1a1a]">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setMode("view")}
              className="flex-1 h-12 rounded-xl border border-[#4a6243] text-[#4a6243] font-semibold active:scale-[0.98] cursor-pointer"
            >
              Indietro
            </button>
            <button
              onClick={doReschedule}
              className="flex-1 h-12 rounded-xl bg-[#4a6243] text-white font-semibold active:scale-[0.98] cursor-pointer"
            >
              Conferma
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* New appointment sheet */
function NewApptSheet({
  open,
  onClose,
  employees,
  services,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  services: Service[];
  defaultDate: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [empId, setEmpId] = useState(employees[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Inserisci il nome del cliente.");
    if (!service) return setError("Scegli un servizio.");
    if (!empId) return setError("Scegli un operatore.");

    setPending(true);
    const res = await createOwnerAppointment({
      employeeId: empId,
      serviceId: service.id,
      serviceName: service.name,
      durationMin: service.duration_min,
      priceCents: service.price_cents,
      dateStr: date,
      timeStr: time,
      customerName: name,
      customerPhone: phone,
    });
    setPending(false);
    if (!res.ok) return setError(res.error ?? "Errore.");
    setName("");
    setPhone("");
    onCreated();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nuovo Appuntamento" dismissible={false}>
      <div className="space-y-4 py-1">
        <input
          placeholder="Nome cliente"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243] font-medium"
        />
        <input
          type="tel"
          placeholder="Numero WhatsApp (facoltativo)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243] font-medium"
        />
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243] font-medium"
        >
          {services.length === 0 && <option value="">Nessun servizio</option>}
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {formatPrice(s.price_cents)}
            </option>
          ))}
        </select>
        <select
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243] font-medium"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243] font-medium"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-[38%] h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[#4a6243] text-center font-medium"
          />
        </div>

        {error && <p className="px-1 text-sm font-semibold text-[#ba1a1a]">{error}</p>}

        <button
          onClick={submit}
          disabled={pending}
          className="w-full h-14 rounded-full satin-gold font-sans text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-[0.98] transition-transform duration-200 cursor-pointer"
        >
          Aggiungi appuntamento
        </button>
      </div>
    </Sheet>
  );
}

function WhatsAppButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[1.05rem] font-bold text-white transition-transform duration-100 active:scale-[0.97]"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-1.13.24-3.66-.77-3.08-1.24-5.05-4.38-5.2-4.58-.15-.2-1.24-1.65-1.24-3.15s.79-2.24 1.07-2.55c.28-.31.61-.38.82-.38.2 0 .41 0 .59.01.19.01.44-.07.69.53.24.6.83 2.06.9 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.37 1.46.3.15.47.12.65-.07.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.28.1 1.74.82 2.04.97.3.15.5.22.57.35.07.12.07.72-.17 1.4Z" />
      </svg>
      Invia Messaggio WhatsApp
    </a>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-xs font-bold text-[#8C9A86] w-20 shrink-0 pt-0.5">{label}</span>
      <span className="flex-1 font-semibold text-sm text-[#4D5A46]">{value}</span>
    </div>
  );
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
