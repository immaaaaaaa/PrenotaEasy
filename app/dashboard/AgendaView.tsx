"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fmtTime, dayKey, fmtWhen } from "@/lib/time";
import { addDaysStr, dayTitle, relLabel } from "@/lib/days";
import { formatPrice } from "@/lib/constants";
import type { Appointment, Business, Employee, Service } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import {
  cancelAppointment,
  createOwnerAppointment,
  getDayAppointments,
  getMonthAppointments,
  getTodayStats,
  rescheduleAppointment,
  updateOwnerNotes,
  updateCustomerNotes,
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

const add30Min = (timeStr: string): string => {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + 30;
  const newH = String(Math.floor(total / 60)).padStart(2, "0");
  const newM = String(total % 60).padStart(2, "0");
  return `${newH}:${newM}`;
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
  restrictToEmployeeId,
  customActions,
  holidays = [],
}: {
  business: Business;
  timezone: string;
  employees: Employee[];
  services: Service[];
  todayStr: string;
  restrictToEmployeeId?: string;
  holidays?: any[];
  customActions?: {
    getDayAppointments?: (date: string) => Promise<Appointment[]>;
    getTodayStats?: (date: string) => Promise<any>;
    getMonthAppointments?: (year: number, month: number) => Promise<Appointment[]>;
    rescheduleAppointment?: (arg: any) => Promise<any>;
    cancelAppointment?: (id: string) => Promise<any>;
    updateOwnerNotes?: (id: string, notes: string) => Promise<any>;
    updateCustomerNotes?: (id: string, notes: string) => Promise<any>;
    getClients?: () => Promise<any[]>;
    getClientHistory?: (phone: string) => Promise<Appointment[]>;
    createOwnerAppointment?: (arg: any) => Promise<any>;
  };
}) {
  const tz = timezone;
  const router = useRouter();

  // Resolve actions (fallback to defaults)
  const apiGetDayAppointments = customActions?.getDayAppointments ?? getDayAppointments;
  const apiGetTodayStats = customActions?.getTodayStats ?? getTodayStats;
  const apiGetMonthAppointments = customActions?.getMonthAppointments ?? getMonthAppointments;
  const apiRescheduleAppointment = customActions?.rescheduleAppointment ?? rescheduleAppointment;
  const apiCancelAppointment = customActions?.cancelAppointment ?? cancelAppointment;
  const apiUpdateOwnerNotes = customActions?.updateOwnerNotes ?? updateOwnerNotes;
  const apiUpdateCustomerNotes = customActions?.updateCustomerNotes ?? updateCustomerNotes;
  const apiGetClients = customActions?.getClients ?? getClients;
  const apiGetClientHistory = customActions?.getClientHistory ?? getClientHistory;
  const apiCreateOwnerAppointment = customActions?.createOwnerAppointment ?? createOwnerAppointment;

  // Navigation tabs state
  const [ownerTab, setOwnerTab] = useState<"dashboard" | "calendar" | "clients">("dashboard");

  // QR Code share modal states
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Date and appointments states
  const [date, setDate] = useState(todayStr);
  const [filter, setFilter] = useState<string>(restrictToEmployeeId ?? "all");
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
  const [customerNotesText, setCustomerNotesText] = useState("");
  const [savingCustomerNotes, setSavingCustomerNotes] = useState(false);
  const [clientHistory, setClientHistory] = useState<Appointment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Real-time booking notification states
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    body: string;
    time: Date;
    read: boolean;
    apptDateStr: string;
  }>>([]);
  const [notifBellOpen, setNotifBellOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string; apptDateStr: string } | null>(null);

  // Audio Context Ref to reuse unlocked context and bypass browser autoplay policies
  const audioContextRef = useRef<AudioContext | null>(null);

  // Global user interaction listener to unlock the Web Audio API context
  useEffect(() => {
    const unlock = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          
          // Play an empty buffer to initialize audio components
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
          
          if (ctx.state === "suspended") {
            ctx.resume();
          }
          audioContextRef.current = ctx;
        }
      } catch (e) {
        console.warn("Audio Context unlock failed:", e);
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("click", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  // Browser-native audio synthesizer chime using Web Audio API
  const playChime = useCallback(() => {
    try {
      let ctx = audioContextRef.current;
      if (!ctx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        ctx = new AudioContextClass();
      }
      
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // High-pitched D5 note
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.08, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.6);

      // Higher A5 note with slight delay
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn("Notification chime synthesis failed:", e);
    }
  }, []);

  const [dragRescheduleResult, setDragRescheduleResult] = useState<{
    customerName: string;
    whenText: string;
    waHref: string;
  } | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string>(restrictToEmployeeId ?? "all");
  const [monthAppts, setMonthAppts] = useState<Appointment[]>([]);
  const [todayStats, setTodayStats] = useState<{
    apptsCount: number;
    totalRevenue: number;
    newCustomersCount: number;
    todayAppts: Appointment[];
  }>({
    apptsCount: 0,
    totalRevenue: 0,
    newCustomersCount: 0,
    todayAppts: [],
  });

  const loadTodayStats = useCallback(async () => {
    try {
      const stats = await apiGetTodayStats(todayStr);
      setTodayStats(stats);
    } catch (err) {
      console.error("Failed to load today's stats:", err);
    }
  }, [todayStr, apiGetTodayStats]);

  useEffect(() => {
    loadTodayStats();
  }, [loadTodayStats]);

  const loadMonth = useCallback(async () => {
    try {
      const data = await apiGetMonthAppointments(currentYear, currentMonth);
      setMonthAppts(data);
    } catch (err) {
      console.error("Failed to load month appointments:", err);
    }
  }, [currentYear, currentMonth, apiGetMonthAppointments]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    if (selectedClient) {
      setCustomerNotesText(selectedClient.notes || "");
    } else {
      setCustomerNotesText("");
    }
  }, [selectedClient]);

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
      setAppts(await apiGetDayAppointments(date));
      loadMonth();
      loadTodayStats();
    } finally {
      setLoading(false);
    }
  }, [date, loadMonth, loadTodayStats, apiGetDayAppointments]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time subscription to postgres INSERT and UPDATE events on appointments table
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`new-appointments-${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          const newAppt = payload.new as Appointment;
          if (!newAppt) return;
          if (restrictToEmployeeId && newAppt.employee_id !== restrictToEmployeeId) return;

          // Look up service name and employee name
          const svc = services.find((s) => s.id === newAppt.service_id);
          const serviceName = svc ? svc.name : "Trattamento";

          const emp = employees.find((e) => e.id === newAppt.employee_id);
          const employeeName = emp ? emp.name : "Qualsiasi";

          const apptDateStr = dayKey(new Date(newAppt.starts_at), tz);
          const timeStr = fmtTime(new Date(newAppt.starts_at), tz);
          const dateStr = dayTitle(apptDateStr);

          const title = "Nuova Prenotazione!";
          const body = `${newAppt.customer_name} ha prenotato ${serviceName} con ${employeeName} per ${dateStr} alle ${timeStr}`;

          // Create notification item
          const newNotif = {
            id: `${newAppt.id}-${Date.now()}`,
            title,
            body,
            time: new Date(),
            read: false,
            apptDateStr,
          };

          // Append to notifications list
          setNotifications((prev) => [newNotif, ...prev]);

          // Trigger visual toast
          setToast({ title, body, apptDateStr });

          // Play browser double chime sound
          playChime();

          // Auto refresh page data (reload calendar and statistics)
          load();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "appointments",
          filter: `business_id=eq.${business.id}`,
        },
        (payload) => {
          const oldAppt = payload.old as Appointment;
          const newAppt = payload.new as Appointment;
          if (!newAppt) return;
          if (restrictToEmployeeId && newAppt.employee_id !== restrictToEmployeeId) return;

          // Verify if it was rescheduled or cancelled, with local state lookup fallback (bypasses replica identity limits)
          const localOld = appts.find((a) => a.id === newAppt.id);
          
          const startsAtOld = (oldAppt && oldAppt.starts_at) || (localOld && localOld.starts_at);
          const statusOld = (oldAppt && oldAppt.status) || (localOld && localOld.status);

          const currentDayStr = date;
          const isNewDateToday = dayKey(new Date(newAppt.starts_at), tz) === currentDayStr;

          let isRescheduled = false;
          let isCancelled = false;

          if (startsAtOld) {
            isRescheduled = new Date(startsAtOld).getTime() !== new Date(newAppt.starts_at).getTime();
            isCancelled = statusOld !== "cancelled" && newAppt.status === "cancelled";
          } else {
            if (newAppt.status === "cancelled") {
              isCancelled = true;
            } else if (isNewDateToday && !localOld) {
              isRescheduled = true;
            }
          }

          if (!isRescheduled && !isCancelled) return;

          // Look up service name and employee name
          const svc = services.find((s) => s.id === newAppt.service_id);
          const serviceName = svc ? svc.name : "Trattamento";

          const emp = employees.find((e) => e.id === newAppt.employee_id);
          const employeeName = emp ? emp.name : "Qualsiasi";

          const apptDateStr = dayKey(new Date(newAppt.starts_at), tz);
          const timeStr = fmtTime(new Date(newAppt.starts_at), tz);
          const dateStr = dayTitle(apptDateStr);

          let title = "";
          let body = "";

          if (isCancelled) {
            title = "Appuntamento Annullato";
            const oldDateStr = startsAtOld ? dayTitle(dayKey(new Date(startsAtOld), tz)) : dateStr;
            const oldTimeStr = startsAtOld ? fmtTime(new Date(startsAtOld), tz) : timeStr;
            body = `${newAppt.customer_name} ha annullato l'appuntamento di ${serviceName} del ${oldDateStr} alle ${oldTimeStr}`;
          } else if (isRescheduled) {
            title = "Appuntamento Spostato";
            const oldDateStr = startsAtOld ? dayTitle(dayKey(new Date(startsAtOld), tz)) : dateStr;
            const oldTimeStr = startsAtOld ? fmtTime(new Date(startsAtOld), tz) : timeStr;
            body = startsAtOld 
              ? `${newAppt.customer_name} ha spostato ${serviceName} con ${employeeName} al ${dateStr} alle ${timeStr} (era il ${oldDateStr} alle ${oldTimeStr})`
              : `${newAppt.customer_name} ha spostato ${serviceName} con ${employeeName} al ${dateStr} alle ${timeStr}`;
          }

          // Create notification item
          const newNotif = {
            id: `${newAppt.id}-${Date.now()}`,
            title,
            body,
            time: new Date(),
            read: false,
            apptDateStr,
          };

          // Append to notifications list
          setNotifications((prev) => [newNotif, ...prev]);

          // Trigger visual toast
          setToast({ title, body, apptDateStr });

          // Play browser double chime sound
          playChime();

          // Auto refresh page data (reload calendar and statistics)
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [business.id, services, employees, tz, playChime, load, restrictToEmployeeId]);

  // Auto-dismiss toast notification after 8 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadClientList = useCallback(async () => {
    setLoadingClients(true);
    try {
      const data = await apiGetClients();
      setAllClients(data);
    } catch {
      console.error("Failed to load clients");
    } finally {
      setLoadingClients(false);
    }
  }, [apiGetClients]);

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
      const historyData = await apiGetClientHistory(client.phone);
      setClientHistory(historyData);
    } catch {
      console.error("Failed to load client history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const visible = appts.filter((a) => restrictToEmployeeId ? a.employee_id === restrictToEmployeeId : (filter === "all" || a.employee_id === filter));
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
      setDragRescheduleResult({
        customerName: targetAppt.customer_name,
        whenText: res.whenText || "",
        waHref: res.waHref || "",
      });
    } else {
      setLoading(false);
      alert(res.error ?? "Impossibile spostare l'appuntamento.");
    }
  };

  const isOccupied = (employeeId: string, slotTimeStr: string) => {
    const slotEnd = add30Min(slotTimeStr);
    return appts.some(a => {
      if (a.employee_id !== employeeId || a.status === "cancelled") return false;
      const apptStart = fmtTime(new Date(a.starts_at), tz);
      const apptEnd = fmtTime(new Date(a.ends_at), tz);

      // Overlap logic: A_start < S_end && S_start < A_end
      // AND skip if it starts in this exact slot to avoid rendering it twice
      const startsHere = apptStart >= slotTimeStr && apptStart < slotEnd;
      if (startsHere) return false;

      return apptStart < slotEnd && slotTimeStr < apptEnd;
    });
  };

  const getApptStartSlot = (employeeId: string, slotTimeStr: string) => {
    const slotEnd = add30Min(slotTimeStr);
    return appts.find(a => {
      if (a.employee_id !== employeeId || a.status === "cancelled") return false;
      const apptStart = fmtTime(new Date(a.starts_at), tz);
      return apptStart >= slotTimeStr && apptStart < slotEnd;
    });
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    return allClients.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  }, [allClients, searchQuery]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1b1c1c] pb-24 font-sans">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-40 bg-[#FAF8F5]/85 backdrop-blur-md border-b border-[var(--line)]">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="h-12 w-12 rounded-xl object-contain" />
            <h1 className="font-bold text-xl tracking-tight text-[#4D5A46]">PrenotaEasy</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQrOpen(true)}
              className="material-symbols-outlined text-[#5e5e5c] cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
              title="Codice QR di Prenotazione"
            >
              qr_code
            </button>
            <button 
              onClick={() => setNotifBellOpen(true)}
              className="relative material-symbols-outlined text-[#5e5e5c] cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
            >
              notifications
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-[#D4AF37] border-2 border-[#FAF8F5] animate-ping" />
                  <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-[#D4AF37] border-2 border-[#FAF8F5]" />
                </>
              )}
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
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#4D5A46] tracking-tight">
                {restrictToEmployeeId ? "Agenda Personale" : "Dashboard Titolare"}
              </h2>
              <p className="text-[#8C9A86] text-sm mt-1">
                {restrictToEmployeeId 
                  ? `Benvenuto ${employees.find(e => e.id === restrictToEmployeeId)?.name ?? ""}, ecco la tua panoramica.`
                  : "Benvenuto, ecco la panoramica di oggi."}
              </p>
            </div>

            {/* Key Bento Metrics */}
            <section className={cn("grid grid-cols-1 gap-4 mb-8", restrictToEmployeeId ? "md:grid-cols-2" : "md:grid-cols-3")}>
              <div className="ios-card rounded-2xl p-5 border border-[var(--line)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200 bg-white">
                <span className="text-[#8C9A86] text-xs font-semibold uppercase tracking-wider">Appuntamenti Oggi</span>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-[#4D5A46] tracking-tight">{todayStats.apptsCount}</span>
                  <span className="text-[#4D5A46] bg-[#b3cea7]/30 px-2.5 py-1 rounded-full text-xs font-bold">Oggi</span>
                </div>
              </div>
              {!restrictToEmployeeId && (
                <div className="ios-card rounded-2xl p-5 border border-[var(--line)] border-l-4 border-l-[#D4AF37] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200 bg-white">
                  <span className="text-[#8C9A86] text-xs font-semibold uppercase tracking-wider">Ricavo Totale</span>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-black text-[#4D5A46] tracking-tight">{formatPrice(todayStats.totalRevenue)}</span>
                    <span className="material-symbols-outlined text-[#D4AF37]">payments</span>
                  </div>
                </div>
              )}
              <div className="ios-card rounded-2xl p-5 border border-[var(--line)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200 bg-white">
                <span className="text-[#8C9A86] text-xs font-semibold uppercase tracking-wider">Nuovi Clienti</span>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-[#4D5A46] tracking-tight">{todayStats.newCustomersCount}</span>
                  <div className="flex -space-x-2">
                    {todayStats.todayAppts.slice(0, 3).map((a) => (
                      <div
                        key={a.id}
                        className="w-8 h-8 rounded-full border border-white bg-[#4D5A46] text-white flex items-center justify-center text-[10px] font-bold"
                      >
                        {a.customer_name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {todayStats.newCustomersCount > 3 && (
                      <div className="w-8 h-8 rounded-full border border-white bg-[#D4AF37] flex items-center justify-center text-[10px] font-bold text-white">
                        +{todayStats.newCustomersCount - 3}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="mb-8">
              <h3 className="text-xs font-bold text-[#8C9A86] uppercase tracking-widest mb-4">Azioni Rapide</h3>
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                <button
                  onClick={() => setNewOpen(true)}
                  className="flex-shrink-0 ios-btn-primary h-12 text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                  Aggiungi Appuntamento
                </button>
                {!restrictToEmployeeId && (
                  <>
                    <button
                      onClick={() => router.push("/dashboard/settings")}
                      className="flex-shrink-0 ios-btn-secondary h-12 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border border-[var(--line)] shadow-sm bg-white"
                    >
                      <span className="material-symbols-outlined text-lg">settings_suggest</span>
                      Gestisci Servizi
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/analytics")}
                      className="flex-shrink-0 ios-btn-secondary h-12 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border border-[var(--line)] shadow-sm bg-white"
                    >
                      <span className="material-symbols-outlined text-lg">monitoring</span>
                      Vedi Analytics
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Daily Timeline */}
            <section className="mb-12">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setDate(addDaysStr(date, -1))}
                    className="grid h-10 w-10 place-items-center rounded-full text-[#4D5A46] hover:bg-[#F4F1EB] active:scale-95 border-none bg-transparent cursor-pointer"
                  >
                    <ChevronLeft />
                  </button>
                  <h3 className="text-lg font-bold text-[#4D5A46] capitalize tracking-tight">
                    {rel ?? dayTitle(date)}
                  </h3>
                  <button
                    onClick={() => setDate(addDaysStr(date, 1))}
                    className="grid h-10 w-10 place-items-center rounded-full text-[#4D5A46] hover:bg-[#F4F1EB] active:scale-95 border-none bg-transparent cursor-pointer"
                  >
                    <ChevronRight />
                  </button>
                </div>
                {date !== todayStr && (
                  <span onClick={() => setDate(todayStr)} className="text-[#8C9A86] text-xs font-bold underline cursor-pointer hover:opacity-85">
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
                          <div className="absolute left-[-23px] top-[30px] w-3 h-3 rounded-full bg-[#D4AF37] shadow-[0_0_0_6px_rgba(212,175,55,0.2)] animate-pulse z-10"></div>
                        ) : (
                          <div className="absolute left-[-21px] top-[32px] w-2 h-2 rounded-full bg-[#74796f] z-10"></div>
                        )}

                        <div
                          onClick={() => setActive(a)}
                          className={cn(
                            "ios-card p-4 flex justify-between items-center group cursor-pointer hover:shadow-md transition-all active:scale-[0.99] border-none bg-white",
                            isLive && "bg-[#FAF8F5] ring-2 ring-[#D4AF37]/50 shadow-md"
                          )}
                        >
                          <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#F4F1EB] text-primary/70">
                              <span className="material-symbols-outlined text-[28px]">person</span>
                            </div>
                            <div>
                              <p className="font-bold text-[#4D5A46] flex items-center gap-2 text-sm">
                                {a.customer_name}
                                {isLive && (
                                  <span className="inline-block w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse"></span>
                                )}
                              </p>
                              <p className="text-xs text-[#8C9A86] mt-0.5 font-medium">
                                {a.service_name} {emp ? ` · ${emp.name}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-sm font-bold", isLive ? "text-[#D4AF37]" : "text-[#4D5A46]")}>
                              {isLive ? "ORA" : fmtTime(new Date(a.starts_at), tz)}
                            </p>
                            <span className="text-[10px] bg-[#e1dfdc] px-2 py-0.5 rounded text-[#5e5e5c] font-bold mt-1 inline-block">
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
            {/* Employee Filter Bar */}            {!restrictToEmployeeId && employees.length > 1 && (
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                <button
                  onClick={() => setEmployeeFilter("all")}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all border-none",
                    employeeFilter === "all"
                      ? "bg-[#4D5A46] !text-white"
                      : "bg-[#F4F1EB] text-[#8C9A86] hover:bg-[#EBE7DD]"
                  )}
                >
                  <span className={employeeFilter === "all" ? "!text-white" : ""}>Tutti gli operatori</span>
                </button>
                {employees.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEmployeeFilter(e.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 border-none",
                      employeeFilter === e.id
                        ? "bg-[#4D5A46] !text-white"
                        : "bg-[#F4F1EB] text-[#8C9A86] hover:bg-[#EBE7DD]"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                    <span className={employeeFilter === e.id ? "!text-white" : ""}>{e.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* iOS Calendar Header Picker */}
            <div className="mb-6 ios-card rounded-2xl p-5 border border-[var(--line)] shadow-sm bg-white">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-[#4D5A46] tracking-tight">
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
                    className="p-2 rounded-full hover:bg-[#F4F1EB] active:scale-95 material-symbols-outlined border-none bg-transparent cursor-pointer"
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
                    className="p-2 rounded-full hover:bg-[#F4F1EB] active:scale-95 material-symbols-outlined border-none bg-transparent cursor-pointer"
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
                  const dayKeyStr = formatDateLocal(day);

                  const isHoliday = holidays.some(h => dayKeyStr >= h.start_date && dayKeyStr <= h.end_date);

                  const hasAppts = monthAppts.some(a => {
                    const aDateStr = a.starts_at.slice(0, 10);
                    if (aDateStr !== dayKeyStr) return false;
                    return employeeFilter === "all" || a.employee_id === employeeFilter;
                  });

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => selectCalendarDate(day)}
                      className={cn(
                        "h-10 w-full rounded-full flex flex-col items-center justify-center relative text-sm active:scale-95 transition-all cursor-pointer border-none",
                        isSelected
                          ? "bg-[#4D5A46] text-white font-extrabold"
                          : isToday
                          ? "bg-transparent text-[#ba1a1a] border border-[#ba1a1a]/40 font-bold"
                          : isHoliday
                          ? "bg-[#FFEBEB] text-[#ba1a1a] font-bold hover:bg-[#FFD6D6]"
                          : "bg-transparent text-[#4D5A46] hover:bg-[#F4F1EB]"
                      )}
                    >
                      <span className={isSelected ? "text-white font-extrabold" : ""}>{day.getDate()}</span>
                      {/* Dynamic colored dot representing scheduled appointments for selected operator */}
                      {hasAppts && !isSelected && (
                        <span
                          className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              employeeFilter !== "all"
                                ? (employees.find((e) => e.id === employeeFilter)?.color ?? "#4a6243")
                                : "#8C9A86",
                          }}
                        />
                      )}
                      {isToday && !isSelected && !hasAppts && (
                        <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drag and Drop Hourly Timeline Grid Board */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-base font-bold text-[#4D5A46] tracking-tight">Tabella Orari per {dayTitle(date)}</h4>
                <p className="text-xs text-[#8C9A86]">Trascina gli appuntamenti sui blocchi liberi per riprogrammare.</p>
              </div>

              {(() => {
                const currentHoliday = holidays.find(h => date >= h.start_date && date <= h.end_date);
                if (!currentHoliday) return null;
                return (
                  <div className="mb-4 p-3.5 rounded-xl bg-[#FFEBEB] border border-[#ba1a1a]/20 flex items-center gap-2.5 text-[#ba1a1a]">
                    <span className="material-symbols-outlined text-lg shrink-0">event_busy</span>
                    <div className="text-xs">
                      <span className="font-extrabold block">Giorno di Chiusura Straordinaria</span>
                      {currentHoliday.description && (
                        <span className="font-medium block mt-0.5 opacity-90">{currentHoliday.description}</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const filteredEmployees = restrictToEmployeeId
                  ? employees.filter(e => e.id === restrictToEmployeeId)
                  : (employeeFilter === "all"
                    ? employees
                    : employees.filter(e => e.id === employeeFilter));

                const skipCells = new Set<string>();

                return (
                  <div className={cn(
                    "ios-card rounded-2xl border border-[var(--line)] shadow-sm bg-white overflow-hidden",
                    (employeeFilter !== "all" || employees.length <= 2) ? "w-full" : "overflow-x-auto"
                  )}>
                    <table className="w-full border-collapse" style={{ minWidth: (employeeFilter === "all" && employees.length > 1) ? "600px" : "100%" }}>
                      <thead>
                        <tr className="bg-[#F4F1EB] border-b border-[var(--line)] text-left">
                          <th className="p-3 text-xs font-bold text-[#8C9A86] w-20 border-r border-[var(--line)] sticky top-0 bg-[#F4F1EB] z-20 text-center">Ora</th>
                          {filteredEmployees.map(e => (
                            <th key={e.id} className="p-3 text-xs font-bold text-[#4D5A46] border-r border-[var(--line)] text-center sticky top-0 bg-[#F4F1EB] z-20">
                              <div className="flex items-center justify-center gap-2">
                                {e.avatar_url ? (
                                  <img src={e.avatar_url} alt={e.name} className="w-5 h-5 rounded-full object-cover shadow-sm" />
                                ) : (
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                                )}
                                {e.name}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TIMELINE_SLOTS.map((slot, rowIndex) => (
                          <tr key={slot} className="border-b border-[var(--line)] h-16">
                            <td className="p-3 text-xs font-bold text-[#8C9A86] text-center border-r border-[var(--line)] bg-[#FAF8F5]/50">
                              {slot}
                            </td>
                            {filteredEmployees.map(e => {
                              const cellKey = `${e.id}-${slot}`;
                              if (skipCells.has(cellKey)) {
                                return null;
                              }

                              const apptStart = getApptStartSlot(e.id, slot);

                              if (apptStart) {
                                const span = Math.ceil(apptStart.duration_min / 30);
                                for (let k = 1; k < span; k++) {
                                  if (rowIndex + k < TIMELINE_SLOTS.length) {
                                    skipCells.add(`${e.id}-${TIMELINE_SLOTS[rowIndex + k]}`);
                                  }
                                }

                                return (
                                  <td
                                    key={cellKey}
                                    rowSpan={span}
                                    className="p-2 border-r border-[var(--line)] relative"
                                  >
                                    <div
                                      draggable
                                      onDragStart={(event) => handleDragStart(event, apptStart.id)}
                                      onClick={() => setActive(apptStart)}
                                      className="absolute inset-2 rounded-2xl p-3 text-xs cursor-grab active:cursor-grabbing border shadow-sm transition-all flex flex-col justify-between bg-white border-[var(--line)] hover:border-[var(--ink)] hover:shadow-md min-h-[44px]"
                                    >
                                      <div className="flex justify-between items-start font-bold">
                                        <span className="text-[#4D5A46] truncate">{apptStart.customer_name}</span>
                                        <span className="text-[9px] bg-[#FAF8F5] border border-[var(--line)] px-1 py-0.5 rounded text-[#8C9A86] scale-90">
                                          {apptStart.duration_min}m
                                        </span>
                                      </div>
                                      <span className="text-[10px] text-[#8C9A86] truncate mt-1">{apptStart.service_name}</span>
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={cellKey}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(event) => handleDrop(event, e.id, slot)}
                                  className="p-2 border-r border-[var(--line)] relative vertical-align-middle"
                                >
                                  <div className="h-full w-full border border-dashed border-[var(--line-strong)] rounded-xl flex items-center justify-center text-[10px] text-[#8C9A86]/70 hover:bg-[var(--surface-2)]/50 hover:border-[var(--ink)] transition-all select-none min-h-[44px]">
                                    Disp.
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 3: CLIENT CONTACTS */}
        {ownerTab === "clients" && (
          <div>
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-[#4D5A46] tracking-tight">Contatti Clienti</h2>
                <p className="text-[#8C9A86] text-sm mt-1">Visualizza la lista dei clienti registrati ed il loro storico trattamenti.</p>
              </div>

              {/* Search bar */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Cerca cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 rounded-xl bg-white border border-[var(--line)] outline-none focus:border-[var(--ink)] px-10 text-sm font-medium shadow-sm"
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
              <div className="ios-card rounded-2xl p-12 text-center text-[#5e5e5c] bg-white">
                <span className="material-symbols-outlined text-4xl">contacts</span>
                <p className="mt-2 text-sm">Nessun cliente corrispondente alla ricerca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredClients.map(c => (
                  <div
                    key={c.id}
                    onClick={() => loadClientHistoryDetails(c)}
                    className="ios-card rounded-xl p-4 border border-[var(--line)] hover:border-[var(--ink)] hover:shadow-md cursor-pointer transition-all flex items-center justify-between bg-white"
                  >
                    <div className="flex gap-4 items-center min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[#b3cea7]/30 text-[#4D5A46] flex items-center justify-center font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-[#4D5A46] truncate">{c.name}</h4>
                        <p className="text-xs text-[#8C9A86] mt-0.5">{c.phone}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[#8C9A86] hover:text-[#4D5A46]">chevron_right</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[#ffffff]/85 backdrop-blur-md shadow-[0_-8px_30px_rgba(77,90,70,0.06)] border-t border-[#E8E4DE]/20">
        <div className="flex justify-around items-center w-full px-6 py-3 pb-safe max-w-screen-md mx-auto">
          <button
            onClick={() => setOwnerTab("dashboard")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent",
              ownerTab === "dashboard" ? "text-[var(--ink)] font-bold" : "text-[#8C9A86] hover:opacity-85"
            )}
          >
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: ownerTab === "dashboard" ? "'FILL' 1" : undefined }}>
              grid_view
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Dashboard</span>
          </button>
          <button
            onClick={() => setOwnerTab("calendar")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent",
              ownerTab === "calendar" ? "text-[var(--ink)] font-bold" : "text-[#8C9A86] hover:opacity-85"
            )}
          >
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: ownerTab === "calendar" ? "'FILL' 1" : undefined }}>
              calendar_month
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Calendario</span>
          </button>
          <button
            onClick={() => setOwnerTab("clients")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent",
              ownerTab === "clients" ? "text-[var(--ink)] font-bold" : "text-[#8C9A86] hover:opacity-85"
            )}
          >
            <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: ownerTab === "clients" ? "'FILL' 1" : undefined }}>
              group
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Clienti</span>
          </button>
          {!restrictToEmployeeId && (
            <button
              onClick={() => router.push("/dashboard/settings")}
              className="flex flex-col items-center justify-center gap-1 text-[#8C9A86] hover:opacity-85 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined text-[24px]">content_cut</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Servizi</span>
            </button>
          )}
        </div>
      </nav>

      {/* Appointment detail / edit / cancel sheet */}
      {active && (
        <ApptSheet
          appt={active}
          employees={employees}
          tz={tz}
          businessName={business.name}
          onClose={() => setActive(null)}
          onChanged={load}
          restrictToEmployeeId={restrictToEmployeeId}
          apiRescheduleAppointment={apiRescheduleAppointment}
          apiCancelAppointment={apiCancelAppointment}
          apiUpdateOwnerNotes={apiUpdateOwnerNotes}
        />
      )}

      {/* New appointment sheet */}
      <NewApptSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        employees={employees}
        services={services}
        defaultDate={date}
        restrictToEmployeeId={restrictToEmployeeId}
        apiCreateOwnerAppointment={apiCreateOwnerAppointment}
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
            <div className="rounded-2xl border border-[var(--line)] divide-y divide-[var(--line)] overflow-hidden bg-[var(--surface-2)]/30">
              <DetailRow label="Nome" value={selectedClient.name} />
              <DetailRow label="WhatsApp" value={selectedClient.phone} />
            </div>

            <div className="space-y-2 mt-4 bg-white border border-[var(--line)] rounded-2xl p-4">
              <h4 className="text-base font-bold text-[#4D5A46] pb-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">assignment</span> Note Generali Contatto
              </h4>
              <p className="text-[10px] text-[#8C9A86] font-bold uppercase tracking-wider">
                Da ricordare assolutamente (es. allergie, formule colore)
              </p>
              <textarea
                className="w-full h-24 rounded-xl bg-[#F4F1EB] text-[#4D5A46] placeholder-[#8C9A86]/70 p-3 outline-none border border-transparent focus:border-[var(--ink)] transition-all font-medium text-xs resize-none"
                value={customerNotesText}
                onChange={(e) => setCustomerNotesText(e.target.value)}
                placeholder="Scrivi qui formule colore, allergie o cose da ricordare..."
              />
              <button
                onClick={async () => {
                  setSavingCustomerNotes(true);
                  const res = await updateCustomerNotes(selectedClient.id, customerNotesText);
                  setSavingCustomerNotes(false);
                  if (res.ok) {
                    selectedClient.notes = customerNotesText;
                    setAllClients(prev => prev.map(c => c.id === selectedClient.id ? { ...c, notes: customerNotesText } : c));
                    alert("Note salvate con successo!");
                  } else {
                    alert(res.error || "Errore.");
                  }
                }}
                disabled={savingCustomerNotes}
                className="w-full h-11 rounded-full bg-[#D4AF37] hover:bg-[#C59B27] !text-white font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-md border-none"
              >
                {savingCustomerNotes ? "Salvataggio..." : "Salva Note Contatto"}
              </button>
            </div>

            <h4 className="text-base font-bold text-[#4D5A46] border-b border-[var(--line)] pb-1 flex items-center gap-1.5">
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
                  <div key={a.id} className="ios-card rounded-xl p-3 border border-[var(--line)] bg-white shadow-sm space-y-2">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-[#4D5A46] text-sm block">{a.service_name}</span>
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
                      <div className="bg-[#F4F1EB]/40 p-2.5 rounded-lg border border-[var(--line)] text-[11px] leading-relaxed">
                        <span className="font-bold text-[#4D5A46] block mb-0.5">Nota Titolare:</span>
                        <span className="text-[#5e5e5c] italic">{a.owner_notes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setSelectedClient(null)} className="w-full ios-btn-secondary h-12 text-sm font-bold">
              Chiudi
            </button>
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
                className="flex-grow h-12 rounded-xl satin-gold font-semibold text-xs text-white active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
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

      {/* WhatsApp Notify Sheet for Drag & Drop Reschedule */}
      {dragRescheduleResult && (
        <Sheet
          open={!!dragRescheduleResult}
          onClose={() => setDragRescheduleResult(null)}
          title="Appuntamento Spostato"
          dismissible={true}
        >
          <div className="space-y-6 py-2 text-center">
            <p className="text-[#5e5e5c] text-sm">
              L&apos;appuntamento di <strong className="text-[#4a6243]">{dragRescheduleResult.customerName}</strong> è stato spostato a:
            </p>
            <div className="bg-[#F4F1EB] rounded-2xl p-4 border border-[#c3c8bd]/30 font-bold font-serif text-[#4a6243] text-lg">
              {dragRescheduleResult.whenText}
            </div>
            
            {dragRescheduleResult.waHref ? (
              <>
                <p className="text-xs text-[#8C9A86] font-medium uppercase tracking-wider">
                  Avvisa il cliente su WhatsApp del cambio di orario:
                </p>
                <WhatsAppButton href={dragRescheduleResult.waHref} />
              </>
            ) : (
              <p className="text-xs text-[#8C9A86] italic">
                Nessun numero di telefono registrato per questo cliente.
              </p>
            )}

            <button
              onClick={() => setDragRescheduleResult(null)}
              className="text-xs font-bold text-[#8C9A86] uppercase tracking-wider cursor-pointer hover:opacity-85"
            >
              Chiudi
            </button>
          </div>
        </Sheet>
      )}

      {/* Real-time Toast alert */}
      {toast && (
        <div 
          onClick={() => {
            setDate(toast.apptDateStr);
            setToast(null);
          }}
          className="notification-toast fixed top-6 right-6 left-6 md:left-auto md:w-96 bg-white border border-[#4D5A46]/20 shadow-lg rounded-2xl p-4 z-50 flex items-start gap-3.5 cursor-pointer hover:shadow-xl transition-all duration-300"
        >
          <div className="h-10 w-10 rounded-full bg-[#FAF8F5] border border-[#E8E4DE] flex items-center justify-center text-[#4D5A46] shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-[20px] animate-bounce">notifications_active</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-serif font-bold text-sm text-[#4D5A46] leading-none mb-1">{toast.title}</h4>
            <p className="text-xs text-[#8C9A86] font-medium leading-relaxed mb-1.5">{toast.body}</p>
            <span className="text-[10px] text-[#4D5A46] font-bold uppercase tracking-wider block">
              Clicca per visualizzare nell&apos;agenda
            </span>
          </div>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setToast(null); 
            }} 
            className="text-[#8C9A86] hover:text-[#4D5A46] shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Notifications Drawer Sheet */}
      <Sheet open={notifBellOpen} onClose={() => setNotifBellOpen(false)} title="Notifiche Prenotazioni" dismissible={true}>
        <div className="space-y-4 py-2">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-[#8C9A86] text-[48px] opacity-40 mb-3 block">notifications_off</span>
              <p className="text-sm text-[#8C9A86] italic">Nessuna nuova prenotazione in questa sessione.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      setDate(n.apptDateStr);
                      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
                      setNotifBellOpen(false);
                    }}
                    className={cn(
                      "glass-card p-4 rounded-2xl border cursor-pointer hover:shadow-sm hover:translate-y-[-1px] transition-all duration-300 relative",
                      n.read ? "opacity-75 border-[#c3c8bd]/20 bg-white/40" : "border-[#4D5A46]/20 bg-[#FAF8F5]/80 shadow-[0_2px_8px_rgba(77,90,70,0.04)]"
                    )}
                  >
                    {!n.read && (
                      <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-[#D4AF37]" />
                    )}
                    <h4 className="font-serif font-bold text-sm text-[#4D5A46] mb-1 pr-6">{n.title}</h4>
                    <p className="text-xs text-[#8C9A86] leading-relaxed mb-2 font-medium">{n.body}</p>
                    <span className="text-[10px] text-[#8C9A86]/70 font-semibold uppercase tracking-wider block">
                      {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => {
                  setNotifications([]);
                  setNotifBellOpen(false);
                }}
                className="w-full text-center py-2 text-xs font-bold text-[#8C9A86] uppercase tracking-wider border-t border-[#c3c8bd]/25 pt-3 hover:text-[#4D5A46] transition-colors cursor-pointer"
              >
                Cancella tutte le notifiche
              </button>
            </div>
          )}
        </div>
      </Sheet>

      {/* Slide down entry animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes slideInNotification {
          0% { transform: translateY(-20px) scale(0.95); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .notification-toast {
          animation: slideInNotification 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
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
  businessName,
  onClose,
  onChanged,
  restrictToEmployeeId,
  apiRescheduleAppointment,
  apiCancelAppointment,
  apiUpdateOwnerNotes,
}: {
  appt: Appointment;
  employees: Employee[];
  tz: string;
  businessName: string;
  onClose: () => void;
  onChanged: () => void;
  restrictToEmployeeId?: string;
  apiRescheduleAppointment: (arg: any) => Promise<any>;
  apiCancelAppointment: (id: string) => Promise<any>;
  apiUpdateOwnerNotes: (id: string, notes: string) => Promise<any>;
}) {
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [result, setResult] = useState<{ text: string; href?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rDate, setRDate] = useState(dayKey(new Date(appt.starts_at), tz));
  const [rTime, setRTime] = useState(fmtTime(new Date(appt.starts_at), tz));
  const [rEmp, setREmp] = useState(appt.employee_id);

  // Sync state if restrictToEmployeeId changes
  useEffect(() => {
    if (restrictToEmployeeId) {
      setREmp(restrictToEmployeeId);
    }
  }, [restrictToEmployeeId]);

  // Owner notes state and handler
  const [oNotes, setONotes] = useState(appt.owner_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function saveNotes() {
    setSavingNotes(true);
    const res = await apiUpdateOwnerNotes(appt.id, oNotes);
    setSavingNotes(false);
    if (res.ok) {
      onChanged();
    }
  }

  async function doReschedule() {
    setPending(true);
    setError(null);
    const res = await apiRescheduleAppointment({
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
    const res = await apiCancelAppointment(appt.id);
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
              <p className="font-bold text-sm text-[#4D5A46]">Avvisa il cliente su WhatsApp:</p>
              <WhatsAppButton href={result.href} />
              <button onClick={onClose} className="w-full py-2.5 text-[#8C9A86] text-sm font-bold border-none bg-transparent cursor-pointer">
                Chiudi
              </button>
            </>
          ) : (
            <button className="w-full ios-btn-primary" onClick={onClose}>
              Chiudi
            </button>
          )}
        </div>
      ) : mode === "view" ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--line)] divide-y divide-[var(--line)] overflow-hidden bg-[var(--surface-2)]/30">
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
          <div className="space-y-1.5 p-1 border-t border-[var(--line)] pt-3">
            <label className="block text-xs font-bold text-[#4D5A46] uppercase tracking-wider">
              Note Trattamento (Cosa hai fatto al cliente)
            </label>
            <textarea
              value={oNotes}
              onChange={(e) => setONotes(e.target.value)}
              placeholder="Inserisci formule colore, taglio o note utili per la prossima volta..."
              rows={3}
              className="w-full rounded-xl bg-[#F4F1EB] text-[#4D5A46] placeholder-[#8C9A86]/70 px-4 py-3 outline-none border border-transparent focus:border-[var(--ink)] transition-all font-medium resize-none shadow-sm text-sm"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-1 px-4 py-2 bg-[#4D5A46] text-white rounded-full text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none"
            >
              {savingNotes ? "Salvataggio..." : "Salva Note"}
            </button>
          </div>

          {error && <p className="text-sm font-semibold text-[#ba1a1a]">{error}</p>}

          <div className="space-y-2.5">
            {appt.customer_phone && (
              <a
                href={`https://wa.me/${appt.customer_phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                  `Ciao ${appt.customer_name.split(" ")[0] || appt.customer_name}! ⏰\n\n` +
                  `Ti ricordiamo il tuo appuntamento da ${businessName} (${appt.service_name}) confermato per ${fmtWhen(new Date(appt.starts_at), tz)}.\n\n` +
                  `Ti aspettiamo! 👋`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-full border border-[var(--line)] text-[#4D5A46] font-bold flex items-center justify-center gap-2 hover:bg-[#F4F1EB] transition-all active:scale-[0.98] cursor-pointer shadow-sm bg-white"
              >
                <span className="material-symbols-outlined text-[20px]">sms</span>
                Invia promemoria WhatsApp
              </a>
            )}
            <button
              onClick={() => setMode("reschedule")}
              className="w-full ios-btn-primary h-12 rounded-full font-bold transition-all"
            >
              Sposta appuntamento
            </button>
            <button
              onClick={doCancel}
              className="w-full h-12 rounded-full border border-[#ba1a1a] text-[#ba1a1a] font-bold hover:bg-[#ba1a1a]/5 transition-all active:scale-[0.98] cursor-pointer bg-transparent"
            >
              Annulla appuntamento
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="mb-1.5 block px-1 text-xs font-bold text-[#4D5A46] uppercase tracking-wider">
                Data
              </span>
              <input
                type="date"
                value={rDate}
                onChange={(e) => setRDate(e.target.value)}
                className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] text-sm text-[#4D5A46] font-medium"
              />
            </label>
            <label className="w-[38%]">
              <span className="mb-1.5 block px-1 text-xs font-bold text-[#4D5A46] uppercase tracking-wider">
                Ora
              </span>
              <input
                type="time"
                value={rTime}
                onChange={(e) => setRTime(e.target.value)}
                className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] text-center text-sm text-[#4D5A46] font-medium"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block px-1 text-xs font-bold text-[#4D5A46] uppercase tracking-wider">
              Operatore
            </span>
            <select
              value={rEmp}
              onChange={(e) => setREmp(e.target.value)}
              disabled={!!restrictToEmployeeId}
              className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] disabled:opacity-75 text-sm text-[#4D5A46] font-medium"
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
              className="flex-1 ios-btn-secondary h-12 text-sm font-bold border border-[var(--line)] bg-white"
            >
              Indietro
            </button>
            <button
              onClick={doReschedule}
              className="flex-1 ios-btn-primary h-12 text-sm font-bold"
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
  restrictToEmployeeId,
  apiCreateOwnerAppointment,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  services: Service[];
  defaultDate: string;
  onCreated: () => void;
  restrictToEmployeeId?: string;
  apiCreateOwnerAppointment: (arg: any) => Promise<any>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [empId, setEmpId] = useState(restrictToEmployeeId ?? employees[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if restrictToEmployeeId changes
  useEffect(() => {
    if (restrictToEmployeeId) {
      setEmpId(restrictToEmployeeId);
    }
  }, [restrictToEmployeeId]);

  const service = services.find((s) => s.id === serviceId);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Inserisci il nome del cliente.");
    if (!service) return setError("Scegli un servizio.");
    if (!empId) return setError("Scegli un operatore.");

    setPending(true);
    const res = await apiCreateOwnerAppointment({
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
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[#4D5A46]"
        />
        <input
          type="tel"
          placeholder="Numero WhatsApp (facoltativo)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[#4D5A46]"
        />
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[#4D5A46]"
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
          disabled={!!restrictToEmployeeId}
          className="w-full h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium disabled:opacity-75 text-sm text-[#4D5A46]"
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
            className="flex-1 h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[#4D5A46]"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-[38%] h-12 rounded-xl bg-[#F4F1EB] px-4 outline-none border border-transparent focus:border-[var(--ink)] text-center font-medium text-sm text-[#4D5A46]"
          />
        </div>

        {error && <p className="px-1 text-sm font-semibold text-[#ba1a1a]">{error}</p>}

        <button
          onClick={submit}
          disabled={pending}
          className="w-full h-14 rounded-full ios-btn-primary font-sans text-xs font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3"
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
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-bold text-white transition-all active:scale-[0.97] border-none cursor-pointer shadow-sm"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.8 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-1.13.24-3.66-.77-3.08-1.24-5.05-4.38-5.2-4.58-.15-.2-1.24-1.65-1.24-3.15s.79-2.24 1.07-2.55c.28-.31.61-.38.82-.38.2 0 .41 0 .59.01.19.01.44-.07.69.53.24.6.83 2.06.9 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.37 1.46.3.15.47.12.65-.07.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.28.1 1.74.82 2.04.97.3.15.5.22.57.35.07.12.07.72-.17 1.4Z" />
      </svg>
      Invia Messaggio WhatsApp
    </a>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-xs font-bold text-[#8C9A86] w-20 shrink-0 pt-0.5 uppercase tracking-wider">{label}</span>
      <span className="flex-1 font-bold text-sm text-[#4D5A46]">{value}</span>
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
