"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { CalendarLogo } from "@/components/CalendarLogo";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { fmtTime, dayKey, fmtWhen, zonedToUtc } from "@/lib/time";
import { addDaysStr, dayTitle, relLabel } from "@/lib/days";
import { formatPrice, WEEKDAYS_LONG } from "@/lib/constants";
import type { Appointment, Business, BusinessHours, Employee, Service } from "@/lib/types";
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

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = date.getTime();
  date.setUTCMonth(0, 1);
  if (date.getUTCDay() !== 4) {
    date.setUTCMonth(0, 1 + ((4 - date.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - date.getTime()) / 604800000);
}

const timeToPercent = (timeStr: string): number => {
  const [h, m] = timeStr.split(":").map(Number);
  const startTotalMinutes = 8 * 60; // 08:00
  const endTotalMinutes = 20 * 60; // 20:00
  const totalMinutes = endTotalMinutes - startTotalMinutes; // 720 min
  
  const currentMinutes = h * 60 + m;
  const offset = currentMinutes - startTotalMinutes;
  
  return Math.max(0, Math.min(100, (offset / totalMinutes) * 100));
};

// Google Calendar-style grid geometry: fixed px per hour
const HOUR_PX = 64;

const parseHM = (t: string | null | undefined, fallback: number): number => {
  if (!t) return fallback;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return fallback;
  return h * 60 + (m || 0);
};

// Readable text color on a colored event block: white on dark colors, dark on light ones
const readableTextOn = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? "#33402e" : "#ffffff";
};

const computeOverlappingSlots = (dayAppts: Appointment[]) => {
  const sorted = [...dayAppts].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const groups: Appointment[][] = [];
  
  for (const appt of sorted) {
    let placed = false;
    for (const group of groups) {
      const apptStart = new Date(appt.starts_at).getTime();
      const apptEnd = new Date(appt.ends_at).getTime();
      
      const overlaps = group.some(g => {
        const gStart = new Date(g.starts_at).getTime();
        const gEnd = new Date(g.ends_at).getTime();
        return apptStart < gEnd && gStart < apptEnd;
      });
      
      if (overlaps) {
        group.push(appt);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([appt]);
    }
  }
  
  const apptStyles = new Map<string, { left: number; width: number }>();
  
  for (const group of groups) {
    const lanes: (Appointment | null)[] = [];
    
    for (const appt of group) {
      const apptStart = new Date(appt.starts_at).getTime();
      const apptEnd = new Date(appt.ends_at).getTime();
      
      let laneIndex = 0;
      while (true) {
        const lastApptInLane = lanes[laneIndex];
        if (!lastApptInLane) {
          lanes[laneIndex] = appt;
          break;
        }
        
        const laneStart = new Date(lastApptInLane.starts_at).getTime();
        const laneEnd = new Date(lastApptInLane.ends_at).getTime();
        
        if (apptStart >= laneEnd) {
          lanes[laneIndex] = appt;
          break;
        }
        
        laneIndex++;
      }
      
      apptStyles.set(appt.id, {
        left: laneIndex,
        width: 1,
      });
    }
    
    const totalLanes = lanes.length;
    for (const appt of group) {
      const style = apptStyles.get(appt.id)!;
      style.left = (style.left / totalLanes) * 100;
      style.width = (1 / totalLanes) * 100;
    }
  }
  
  return apptStyles;
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
  businessHours = [],
  initialDayAppts,
  initialMonthAppts,
  initialTodayStats,
}: {
  business: Business;
  timezone: string;
  employees: Employee[];
  services: Service[];
  todayStr: string;
  restrictToEmployeeId?: string;
  holidays?: any[];
  businessHours?: BusinessHours[];
  initialDayAppts?: Appointment[];
  initialMonthAppts?: Appointment[];
  initialTodayStats?: {
    apptsCount: number;
    totalRevenue: number;
    newCustomersCount: number;
    todayAppts: Appointment[];
  };
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
  const [appts, setAppts] = useState<Appointment[]>(initialDayAppts ?? []);
  const [loading, setLoading] = useState(!initialDayAppts);

  // Appt detail sheet states
  const [active, setActive] = useState<Appointment | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // Calendar states
  const [currentYear, setCurrentYear] = useState(new Date(date).getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date(date).getMonth());
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">("week");

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

  // Time slot preselected by tapping an empty calendar cell
  const [newApptTime, setNewApptTime] = useState("10:00");

  // Current-time tick for the red "now" line (refreshes every minute)
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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
  // Month appointments cached per month: navigation merges data in, never blanks the grid
  const initialMonthKey = `${Number(todayStr.slice(0, 4))}-${Number(todayStr.slice(5, 7)) - 1}`;
  const [monthApptsMap, setMonthApptsMap] = useState<Record<string, Appointment[]>>(
    initialMonthAppts ? { [initialMonthKey]: initialMonthAppts } : {},
  );
  const loadedMonthsRef = useRef<Set<string>>(new Set(initialMonthAppts ? [initialMonthKey] : []));
  const monthAppts = useMemo(() => Object.values(monthApptsMap).flat(), [monthApptsMap]);

  const fetchMonth = useCallback(async (year: number, month: number, force = false) => {
    const key = `${year}-${month}`;
    if (!force && loadedMonthsRef.current.has(key)) return;
    loadedMonthsRef.current.add(key);
    try {
      const data = await apiGetMonthAppointments(year, month);
      setMonthApptsMap(prev => ({ ...prev, [key]: data }));
    } catch (err) {
      loadedMonthsRef.current.delete(key);
      console.error("Failed to load month appointments:", err);
    }
  }, [apiGetMonthAppointments]);

  const refreshMonths = useCallback(() => {
    for (const key of Array.from(loadedMonthsRef.current)) {
      const [y, m] = key.split("-").map(Number);
      fetchMonth(y, m, true);
    }
  }, [fetchMonth]);
  const [todayStats, setTodayStats] = useState<{
    apptsCount: number;
    totalRevenue: number;
    newCustomersCount: number;
    todayAppts: Appointment[];
  }>(initialTodayStats ?? {
    apptsCount: 0,
    totalRevenue: 0,
    newCustomersCount: 0,
    todayAppts: [],
  });

  const weeksOfTabMonth = useMemo(() => {
    const firstOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = (firstOfMonth.getDay() + 6) % 7; // Monday = 0, ..., Sunday = 6
    
    const cursor = new Date(currentYear, currentMonth, 1 - startDay);
    const weeksList = [];
    
    for (let w = 0; w < 6; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      weeksList.push(week);
      
      const lastDay = week[6];
      if (lastDay.getMonth() !== currentMonth && cursor.getMonth() !== currentMonth) {
        break;
      }
    }
    return weeksList;
  }, [currentYear, currentMonth]);

  const filteredMonthAppts = useMemo(() => {
    return monthAppts.filter(a => {
      if (a.status === "cancelled") return false;
      return employeeFilter === "all" || a.employee_id === employeeFilter;
    });
  }, [monthAppts, employeeFilter]);

  const currentWeekDays = useMemo(() => {
    const cursor = new Date(date);
    const dayNum = (cursor.getDay() + 6) % 7; // Monday = 0, ..., Sunday = 6
    const monday = new Date(cursor.setDate(cursor.getDate() - dayNum));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(monday));
      monday.setDate(monday.getDate() + 1);
    }
    return days;
  }, [date]);

  useEffect(() => {
    const d = new Date(date);
    if (!isNaN(d.getTime())) {
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
    }
  }, [date]);

  const loadTodayStats = useCallback(async () => {
    try {
      const stats = await apiGetTodayStats(todayStr);
      setTodayStats(stats);
    } catch (err) {
      console.error("Failed to load today's stats:", err);
    }
  }, [todayStr, apiGetTodayStats]);

  const skipInitialStatsRef = useRef(Boolean(initialTodayStats));
  useEffect(() => {
    if (skipInitialStatsRef.current) {
      skipInitialStatsRef.current = false;
      return;
    }
    loadTodayStats();
  }, [loadTodayStats]);

  // Load every month visible in the current views (month grid + week edges)
  useEffect(() => {
    const needed = new Set<string>([`${currentYear}-${currentMonth}`]);
    for (const d of currentWeekDays) needed.add(`${d.getFullYear()}-${d.getMonth()}`);
    for (const week of weeksOfTabMonth) {
      for (const d of week) needed.add(`${d.getFullYear()}-${d.getMonth()}`);
    }
    for (const key of Array.from(needed)) {
      const [y, m] = key.split("-").map(Number);
      fetchMonth(y, m);
    }
  }, [currentYear, currentMonth, currentWeekDays, weeksOfTabMonth, fetchMonth]);

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

  // Closed days: weekly closing day or holiday range
  const hoursByWeekday = useMemo(
    () => new Map(businessHours.map((h) => [h.weekday, h])),
    [businessHours],
  );
  const isClosedDate = useCallback((keyStr: string) => {
    if (holidays.some((h) => keyStr >= h.start_date && keyStr <= h.end_date)) return true;
    const d = new Date(`${keyStr}T00:00:00`);
    const bh = hoursByWeekday.get(((d.getDay() + 6) % 7) as BusinessHours["weekday"]);
    return bh ? bh.is_closed : false;
  }, [hoursByWeekday, holidays]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAppts(await apiGetDayAppointments(date));
      refreshMonths();
      loadTodayStats();
    } finally {
      setLoading(false);
    }
  }, [date, refreshMonths, loadTodayStats, apiGetDayAppointments]);

  // Skip the very first client fetch when the server already provided the data
  const skipInitialLoadRef = useRef(Boolean(initialDayAppts));
  useEffect(() => {
    if (skipInitialLoadRef.current) {
      skipInitialLoadRef.current = false;
      return;
    }
    load();
  }, [load]);

  // Warm up the routes reachable from the dashboard nav
  useEffect(() => {
    if (!restrictToEmployeeId) {
      router.prefetch("/dashboard/settings");
      router.prefetch("/dashboard/analytics");
    }
  }, [router, restrictToEmployeeId]);

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

  // Pointer-based drag & drop: works with mouse and touch (long-press to lift)
  const gridRef = useRef<HTMLDivElement | null>(null);
  const gridDayKeysRef = useRef<string[]>([]);
  const justDraggedRef = useRef(false);
  const gridRangeRef = useRef<{ startMin: number; endMin: number }>({ startMin: 8 * 60, endMin: 20 * 60 });
  const [dragTarget, setDragTarget] = useState<{ apptId: string; durMin: number; col: number; slot: number; valid: boolean; reason: "past" | "closed" | null } | null>(null);
  const dragTargetRef = useRef<typeof dragTarget>(null);
  // Month view: drop target is a whole day cell (same time, new date)
  const [monthDragTarget, setMonthDragTarget] = useState<{ apptId: string; dayKey: string; valid: boolean; reason: "past" | "closed" | null } | null>(null);
  const monthDragTargetRef = useRef<typeof monthDragTarget>(null);
  // Confirm sheet after a month-view drop: lets the owner adjust the time too
  const [monthDropPrompt, setMonthDropPrompt] = useState<{ appt: Appointment; dateStr: string } | null>(null);
  const [monthDropTime, setMonthDropTime] = useState("09:00");

  const rescheduleTo = async (targetAppt: Appointment, targetDateStr: string, timeStr: string) => {
    setLoading(true);
    const res = await apiRescheduleAppointment({
      id: targetAppt.id,
      dateStr: targetDateStr,
      timeStr,
      employeeId: targetAppt.employee_id,
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

  const startApptDrag = (e: React.PointerEvent, a: Appointment) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (loading) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const isTouch = e.pointerType !== "mouse";
    let active = false;

    const setTarget = (t: { apptId: string; durMin: number; col: number; slot: number; valid: boolean; reason: "past" | "closed" | null } | null) => {
      dragTargetRef.current = t;
      setDragTarget(t);
    };

    const updateTarget = (x: number, y: number) => {
      const grid = gridRef.current;
      const dayKeys = gridDayKeysRef.current;
      if (!grid || dayKeys.length === 0) return;
      const rect = grid.getBoundingClientRect();
      const { startMin, endMin } = gridRangeRef.current;
      const slotsCount = ((endMin - startMin) / 60) * 2;
      const col = Math.max(0, Math.min(dayKeys.length - 1, Math.floor(((x - rect.left) / rect.width) * dayKeys.length)));
      const slot = Math.max(0, Math.min(slotsCount - 1, Math.floor((y - rect.top) / (HOUR_PX / 2))));
      // A drop target is invalid on closed days and in the past
      const total = startMin + slot * 30;
      const slotTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      const inPast = zonedToUtc(dayKeys[col], slotTime, tz).getTime() < Date.now();
      const reason = inPast ? ("past" as const) : isClosedDate(dayKeys[col]) ? ("closed" as const) : null;
      setTarget({ apptId: a.id, durMin: a.duration_min, col, slot, valid: reason === null, reason });
    };

    const begin = (x: number, y: number) => {
      active = true;
      if (navigator.vibrate) navigator.vibrate(25);
      updateTarget(x, y);
    };

    const timer = window.setTimeout(() => begin(startX, startY), isTouch ? 260 : 160);

    const cleanup = () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", cleanup);
      document.removeEventListener("touchmove", blockScroll);
      setTarget(null);
    };

    const onMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
          if (isTouch) {
            // Finger moved before the long-press completed: it is a scroll, not a drag
            cleanup();
          } else {
            window.clearTimeout(timer);
            begin(ev.clientX, ev.clientY);
          }
        }
        return;
      }
      updateTarget(ev.clientX, ev.clientY);
    };

    const blockScroll = (ev: TouchEvent) => {
      if (active) ev.preventDefault();
    };

    const onUp = () => {
      const target = active ? dragTargetRef.current : null;
      cleanup();
      if (!target) return;
      justDraggedRef.current = true;
      window.setTimeout(() => { justDraggedRef.current = false; }, 350);
      if (!target.valid) {
        // Explain the rejection: a silent red ghost reads as a broken feature
        setToast({
          title: "Spostamento non consentito",
          body:
            target.reason === "past"
              ? "Non puoi spostare un appuntamento nel passato."
              : "Il giorno di destinazione è chiuso.",
          apptDateStr: a.starts_at.slice(0, 10),
        });
        return;
      }
      const total = gridRangeRef.current.startMin + target.slot * 30;
      const timeStr = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      const targetDateStr = gridDayKeysRef.current[target.col];
      const sameSlot = a.starts_at.slice(0, 10) === targetDateStr && fmtTime(new Date(a.starts_at), tz) === timeStr;
      if (targetDateStr && !sameSlot) rescheduleTo(a, targetDateStr, timeStr);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", cleanup);
    document.addEventListener("touchmove", blockScroll, { passive: false });
  };

  // Month view drag: move the appointment to another day, keeping its time.
  // Cells are found via elementFromPoint (row heights vary with content).
  const startMonthApptDrag = (e: React.PointerEvent, a: Appointment) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (loading) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const isTouch = e.pointerType !== "mouse";
    let active = false;
    const timeStr = fmtTime(new Date(a.starts_at), tz);

    const setTarget = (t: { apptId: string; dayKey: string; valid: boolean; reason: "past" | "closed" | null } | null) => {
      monthDragTargetRef.current = t;
      setMonthDragTarget(t);
    };

    const updateTarget = (x: number, y: number) => {
      const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest("[data-daykey]") as HTMLElement | null;
      const key = el?.dataset.daykey;
      if (!key) {
        setTarget(null);
        return;
      }
      const inPast = zonedToUtc(key, timeStr, tz).getTime() < Date.now();
      const reason = inPast ? ("past" as const) : isClosedDate(key) ? ("closed" as const) : null;
      setTarget({ apptId: a.id, dayKey: key, valid: reason === null, reason });
    };

    const begin = (x: number, y: number) => {
      active = true;
      if (navigator.vibrate) navigator.vibrate(25);
      updateTarget(x, y);
    };

    const timer = window.setTimeout(() => begin(startX, startY), isTouch ? 260 : 160);

    const cleanup = () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", cleanup);
      document.removeEventListener("touchmove", blockScroll);
      setTarget(null);
    };

    const onMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
          if (isTouch) {
            cleanup();
          } else {
            window.clearTimeout(timer);
            begin(ev.clientX, ev.clientY);
          }
        }
        return;
      }
      updateTarget(ev.clientX, ev.clientY);
    };

    const blockScroll = (ev: TouchEvent) => {
      if (active) ev.preventDefault();
    };

    const onUp = () => {
      const target = active ? monthDragTargetRef.current : null;
      cleanup();
      if (!target) return;
      justDraggedRef.current = true;
      window.setTimeout(() => { justDraggedRef.current = false; }, 350);
      if (!target.valid) {
        setToast({
          title: "Spostamento non consentito",
          body:
            target.reason === "past"
              ? "Non puoi spostare un appuntamento nel passato."
              : "Il giorno di destinazione è chiuso.",
          apptDateStr: a.starts_at.slice(0, 10),
        });
        return;
      }
      if (target.dayKey !== a.starts_at.slice(0, 10)) {
        // Confirm with an editable time instead of moving straight away
        setMonthDropTime(timeStr);
        setMonthDropPrompt({ appt: a, dateStr: target.dayKey });
      }
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", cleanup);
    document.addEventListener("touchmove", blockScroll, { passive: false });
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

  // Sheets stay mounted so the close animation matches the open one;
  // the last payload is kept so content stays visible while sliding out.
  const lastActiveRef = useRef<Appointment | null>(null);
  if (active) lastActiveRef.current = active;
  const apptSheetData = active ?? lastActiveRef.current;

  const lastClientRef = useRef<any>(null);
  if (selectedClient) lastClientRef.current = selectedClient;
  const clientSheetData = selectedClient ?? lastClientRef.current;

  const lastMonthDropRef = useRef<typeof monthDropPrompt>(null);
  if (monthDropPrompt) lastMonthDropRef.current = monthDropPrompt;
  const monthDropData = monthDropPrompt ?? lastMonthDropRef.current;

  const lastDragResultRef = useRef<typeof dragRescheduleResult>(null);
  if (dragRescheduleResult) lastDragResultRef.current = dragRescheduleResult;
  const dragResultData = dragRescheduleResult ?? lastDragResultRef.current;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pb-24 font-sans overflow-x-clip">
      {/* TopAppBar */}
      <header className="w-full top-0 sticky z-40 bg-[var(--bg)]/85 backdrop-blur-md border-b border-[var(--line)]">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <CalendarLogo size={48} />
            <h1 className="font-bold text-xl tracking-tight text-[var(--ink)]">PrenotaEasy</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setQrOpen(true)}
              className="material-symbols-outlined text-[var(--ink-2)] cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
              title="Codice QR di Prenotazione"
            >
              qr_code
            </button>
            <button 
              onClick={() => setNotifBellOpen(true)}
              className="relative material-symbols-outlined text-[var(--ink-2)] cursor-pointer hover:opacity-80 transition-opacity active:scale-95"
            >
              notifications
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] border-2 border-[#FBF8FA] animate-ping" />
                  <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] border-2 border-[#FBF8FA]" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 mt-6">
        {/* TAB 1: DASHBOARD */}
        {ownerTab === "dashboard" && (
          <div>
            {/* Dashboard Title */}
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--ink)] tracking-tight">
                {restrictToEmployeeId ? "Agenda Personale" : "Dashboard Titolare"}
              </h2>
              <p className="text-[var(--ink-2)] text-sm mt-1">
                {restrictToEmployeeId 
                  ? `Benvenuto ${employees.find(e => e.id === restrictToEmployeeId)?.name ?? ""}, ecco la tua panoramica.`
                  : "Benvenuto, ecco la panoramica di oggi."}
              </p>
            </div>

            {/* Quick Actions */}
            <section className="mb-8">
              <h3 className="text-xs font-bold text-[var(--ink-2)] uppercase tracking-widest mb-4">Azioni Rapide</h3>
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
                      className="flex-shrink-0 ios-btn-secondary h-12 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border border-[var(--line)] shadow-sm bg-[var(--surface)]"
                    >
                      <span className="material-symbols-outlined text-lg">settings_suggest</span>
                      Gestisci Servizi
                    </button>
                    <button
                      onClick={() => router.push("/dashboard/analytics")}
                      className="flex-shrink-0 ios-btn-secondary h-12 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border border-[var(--line)] shadow-sm bg-[var(--surface)]"
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
                    className="grid h-10 w-10 place-items-center rounded-full text-[var(--ink)] hover:bg-[var(--surface-2)] active:scale-95 border-none bg-transparent cursor-pointer"
                  >
                    <ChevronLeft />
                  </button>
                  <h3 className="text-lg font-bold text-[var(--ink)] capitalize tracking-tight">
                    {rel ?? dayTitle(date)}
                  </h3>
                  <button
                    onClick={() => setDate(addDaysStr(date, 1))}
                    className="grid h-10 w-10 place-items-center rounded-full text-[var(--ink)] hover:bg-[var(--surface-2)] active:scale-95 border-none bg-transparent cursor-pointer"
                  >
                    <ChevronRight />
                  </button>
                </div>
                {date !== todayStr && (
                  <span onClick={() => setDate(todayStr)} className="text-[var(--ink-2)] text-xs font-bold underline cursor-pointer hover:opacity-85">
                    Torna a oggi
                  </span>
                )}
              </div>

              {/* Timeline Container */}
              <div className="space-y-4 relative pl-6">
                {visible.length > 0 && (
                  <div className="absolute left-2.5 top-2 bottom-2 w-[1px] bg-[#D9C3CF]"></div>
                )}

                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                  ))
                ) : visible.length === 0 ? (
                  <div className="py-12 text-center text-[var(--ink-2)]">
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
                          <div className="absolute left-[-23px] top-[30px] w-3 h-3 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(138,61,110,0.2)] animate-pulse z-10"></div>
                        ) : (
                          <div className="absolute left-[-21px] top-[32px] w-2 h-2 rounded-full bg-[#8A7D85] z-10"></div>
                        )}

                        <div
                          onClick={() => setActive(a)}
                          className={cn(
                            "ios-card p-4 flex justify-between items-center group cursor-pointer hover:shadow-md transition-all active:scale-[0.99] border-none bg-[var(--surface)]",
                            isLive && "bg-[var(--bg)] ring-2 ring-[var(--accent)]/50 shadow-md"
                          )}
                        >
                          <div className="flex gap-4 items-center">
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-[var(--surface-2)] text-primary/70">
                              <span className="material-symbols-outlined text-[28px]">person</span>
                            </div>
                            <div>
                              <p className="font-bold text-[var(--ink)] flex items-center gap-2 text-sm">
                                {a.customer_name}
                                {isLive && (
                                  <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span>
                                )}
                              </p>
                              <p className="text-xs text-[var(--ink-2)] mt-0.5 font-medium">
                                {a.service_name}
                                {a.addons && a.addons.length > 0 ? ` +${a.addons.length} extra` : ""}
                                {emp ? ` · ${emp.name}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-sm font-bold", isLive ? "text-[var(--accent)]" : "text-[var(--ink)]")}>
                              {isLive ? "ORA" : fmtTime(new Date(a.starts_at), tz)}
                            </p>
                            <span className="text-[10px] bg-[var(--surface-3)] px-2 py-0.5 rounded text-[var(--ink-2)] font-bold mt-1 inline-block">
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

            {/* Key Bento Metrics (bottom of the dashboard) */}
            <section className={cn("grid grid-cols-1 gap-4 mb-8", restrictToEmployeeId ? "md:grid-cols-2" : "md:grid-cols-3")}>
              <div className="ios-card rounded-2xl p-5 border border-[var(--line)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200 bg-[var(--surface)]">
                <span className="text-[var(--ink-2)] text-xs font-semibold uppercase tracking-wider">Appuntamenti Oggi</span>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-[var(--ink)] tracking-tight">{todayStats.apptsCount}</span>
                  <span className="text-[var(--ink)] bg-[var(--accent-2)]/30 px-2.5 py-1 rounded-full text-xs font-bold">Oggi</span>
                </div>
              </div>
              {!restrictToEmployeeId && (
                <div className="ios-card rounded-2xl p-5 border border-[var(--line)] border-l-4 border-l-[var(--accent)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200 bg-[var(--surface)]">
                  <span className="text-[var(--ink-2)] text-xs font-semibold uppercase tracking-wider">Ricavo Totale</span>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-black text-[var(--ink)] tracking-tight">{formatPrice(todayStats.totalRevenue)}</span>
                    <span className="material-symbols-outlined text-[var(--accent)]">payments</span>
                  </div>
                </div>
              )}
              <div className="ios-card rounded-2xl p-5 border border-[var(--line)] flex flex-col justify-between h-32 hover:translate-y-[-2px] transition-transform duration-200 bg-[var(--surface)]">
                <span className="text-[var(--ink-2)] text-xs font-semibold uppercase tracking-wider">Nuovi Clienti</span>
                <div className="flex items-end justify-between">
                  <span className="text-3xl font-black text-[var(--ink)] tracking-tight">{todayStats.newCustomersCount}</span>
                  <div className="flex -space-x-2">
                    {todayStats.todayAppts.slice(0, 3).map((a) => (
                      <div
                        key={a.id}
                        className="w-8 h-8 rounded-full border border-white bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center text-[10px] font-bold"
                      >
                        {a.customer_name.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {todayStats.newCustomersCount > 3 && (
                      <div className="w-8 h-8 rounded-full border border-white bg-[var(--accent)] flex items-center justify-center text-[10px] font-bold text-[var(--on-accent)]">
                        +{todayStats.newCustomersCount - 3}
                      </div>
                    )}
                  </div>
                </div>
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
                      ? "bg-[var(--ink)] !text-[var(--bg)]"
                      : "bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                  )}
                >
                  <span className={employeeFilter === "all" ? "!text-[var(--bg)]" : ""}>Tutti gli operatori</span>
                </button>
                {employees.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setEmployeeFilter(e.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 border-none",
                      employeeFilter === e.id
                        ? "bg-[var(--ink)] !text-[var(--bg)]"
                        : "bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--surface-3)]"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                    <span className={employeeFilter === e.id ? "!text-[var(--bg)]" : ""}>{e.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Calendar Controls — compact header */}
            <div className="mb-4 flex items-center justify-between gap-1.5">
              <div className="flex items-center min-w-0">
                <button
                  onClick={() => {
                    if (calendarView === "month") {
                      if (currentMonth === 0) {
                        setCurrentMonth(11);
                        setCurrentYear(y => y - 1);
                      } else {
                        setCurrentMonth(m => m - 1);
                      }
                    } else {
                      const d = new Date(`${date}T00:00:00`);
                      d.setDate(d.getDate() - (calendarView === "week" ? 7 : 1));
                      setDate(formatDateLocal(d));
                    }
                  }}
                  aria-label="Periodo precedente"
                  className="p-1.5 rounded-full hover:bg-[var(--surface-2)] active:scale-95 material-symbols-outlined border-none bg-transparent cursor-pointer text-[var(--ink)] text-[22px]"
                >
                  chevron_left
                </button>
                <button
                  onClick={() => {
                    if (calendarView === "month") {
                      if (currentMonth === 11) {
                        setCurrentMonth(0);
                        setCurrentYear(y => y + 1);
                      } else {
                        setCurrentMonth(m => m + 1);
                      }
                    } else {
                      const d = new Date(`${date}T00:00:00`);
                      d.setDate(d.getDate() + (calendarView === "week" ? 7 : 1));
                      setDate(formatDateLocal(d));
                    }
                  }}
                  aria-label="Periodo successivo"
                  className="p-1.5 rounded-full hover:bg-[var(--surface-2)] active:scale-95 material-symbols-outlined border-none bg-transparent cursor-pointer text-[var(--ink)] text-[22px]"
                >
                  chevron_right
                </button>
                <h3 className="ml-1 text-sm sm:text-lg font-extrabold text-[var(--ink)] tracking-tight capitalize truncate">
                  {calendarView === "month"
                    ? `${MONTH_LABELS[currentMonth]} ${currentYear}`
                    : calendarView === "week"
                    ? currentWeekDays[0].getMonth() === currentWeekDays[6].getMonth()
                      ? `${currentWeekDays[0].getDate()} – ${currentWeekDays[6].getDate()} ${MONTH_LABELS[currentWeekDays[0].getMonth()]}`
                      : `${currentWeekDays[0].getDate()} ${MONTH_LABELS[currentWeekDays[0].getMonth()].slice(0, 3)} – ${currentWeekDays[6].getDate()} ${MONTH_LABELS[currentWeekDays[6].getMonth()].slice(0, 3)}`
                    : dayTitle(date)}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {date !== todayStr && (
                  <button
                    onClick={() => setDate(todayStr)}
                    className="h-8 px-2.5 rounded-full border border-[var(--line)] bg-[var(--surface)] text-[11px] font-bold text-[var(--ink)] cursor-pointer active:scale-95 transition-all"
                  >
                    Oggi
                  </button>
                )}
                <div className="bg-[var(--surface-2)] p-0.5 rounded-full flex border border-[var(--line)]">
                  {(["day", "week", "month"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setCalendarView(v)}
                      aria-pressed={calendarView === v}
                      className={cn(
                        "h-8 px-2.5 sm:px-4 rounded-full text-[11px] sm:text-xs font-bold transition-all border-none cursor-pointer",
                        calendarView === v
                          ? "bg-[var(--ink)] !text-[var(--bg)] shadow-sm"
                          : "bg-transparent text-[var(--ink-2)]"
                      )}
                    >
                      <span className="sm:hidden">{v === "day" ? "G" : v === "week" ? "S" : "M"}</span>
                      <span className="hidden sm:inline">{v === "day" ? "Giorno" : v === "week" ? "Settimana" : "Mese"}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Conditionally Render Day / Week / Month Views */}
            {calendarView === "month" ? (
              /* MONTH VIEW — full-width fluid grid, Google Calendar style */
              <div className="mb-6 rounded-2xl border border-[var(--line)] shadow-sm bg-[var(--surface)] overflow-hidden">
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[var(--ink-2)] uppercase tracking-wider border-b border-[var(--line)]">
                  {WEEKDAY_SHORT_LABELS.map((w, idx) => (
                    <div key={idx} className="py-2">{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="min-h-[76px] sm:min-h-[112px] border-b border-r border-[var(--line)]/40 bg-[var(--bg)]/60" />;
                    }
                    const dayKeyStr = formatDateLocal(day);
                    const isSelected = date === dayKeyStr;
                    const isToday = todayStr === dayKeyStr;
                    const closed = isClosedDate(dayKeyStr);
                    const dayAppts = filteredMonthAppts.filter(a => a.starts_at.slice(0, 10) === dayKeyStr);
                    return (
                      <div
                        key={day.toISOString()}
                        data-daykey={dayKeyStr}
                        onClick={() => {
                          selectCalendarDate(day);
                          setCalendarView("day");
                        }}
                        className={cn(
                          "min-h-[76px] sm:min-h-[112px] border-b border-r border-[var(--line)]/40 p-1 sm:p-1.5 flex flex-col gap-1 cursor-pointer transition-colors overflow-hidden",
                          closed ? "bg-[var(--surface-2)]/70" : "hover:bg-[var(--bg)]",
                          monthDragTarget?.dayKey === dayKeyStr &&
                            (monthDragTarget.valid
                              ? "ring-2 ring-inset ring-[var(--ink)] bg-[var(--ink)]/5"
                              : "ring-2 ring-inset ring-[#ba1a1a] bg-[#ba1a1a]/5")
                        )}
                      >
                        <span className={cn(
                          "self-center shrink-0 text-[11px] sm:text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                          isToday ? "bg-[#ba1a1a] text-white" : isSelected ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--ink)]"
                        )}>
                          {day.getDate()}
                        </span>
                        {closed && dayAppts.length === 0 && (
                          <span className="text-[7px] sm:text-[8px] font-extrabold uppercase tracking-widest text-[var(--ink-2)]/60 text-center select-none">
                            Chiuso
                          </span>
                        )}
                        <div className="flex flex-col gap-0.5">
                          {dayAppts.map(a => {
                            const emp = empById.get(a.employee_id);
                            return (
                              <button
                                key={a.id}
                                onPointerDown={(e) => startMonthApptDrag(e, a)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (justDraggedRef.current) return;
                                  setActive(a);
                                }}
                                style={{ backgroundColor: emp?.color ?? "#A18A97", color: readableTextOn(emp?.color ?? "#A18A97") }}
                                className={cn(
                                  "w-full text-left rounded-[3px] px-1.5 py-0.5 text-[8px] sm:text-[10px] font-bold truncate border-none cursor-grab active:cursor-grabbing leading-tight",
                                  monthDragTarget?.apptId === a.id && "opacity-40"
                                )}
                              >
                                <span className="hidden sm:inline">{fmtTime(new Date(a.starts_at), tz)} </span>
                                {a.customer_name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* DAY & WEEK VIEW — unified Google Calendar time grid */
              (() => {
                const isWeek = calendarView === "week";
                const gridDays = isWeek ? currentWeekDays : [new Date(`${date}T00:00:00`)];
                const dayKeys = gridDays.map(formatDateLocal);
                gridDayKeysRef.current = dayKeys;

                // Real working-hours range, expanded so every appointment stays visible
                let startMin = 8 * 60;
                let endMin = 20 * 60;
                const openRows = businessHours.filter(h => !h.is_closed);
                if (openRows.length > 0) {
                  startMin = Math.min(...openRows.map(h => parseHM(h.open_time, 8 * 60)));
                  endMin = Math.max(...openRows.map(h => parseHM(h.close_time, 20 * 60)));
                }
                for (const a of filteredMonthAppts) {
                  if (!dayKeys.includes(a.starts_at.slice(0, 10))) continue;
                  const s = parseHM(fmtTime(new Date(a.starts_at), tz), startMin);
                  const e = parseHM(fmtTime(new Date(a.ends_at), tz), endMin);
                  if (s < startMin) startMin = s;
                  if (e > endMin) endMin = e;
                }
                startMin = Math.floor(startMin / 60) * 60;
                endMin = Math.ceil(endMin / 60) * 60;
                gridRangeRef.current = { startMin, endMin };
                const gridPx = ((endMin - startMin) / 60) * HOUR_PX;
                const hoursCount = (endMin - startMin) / 60;
                const slotsCount = hoursCount * 2;
                const toPx = (timeStr: string) => {
                  const [hh, mm] = timeStr.split(":").map(Number);
                  return Math.max(0, Math.min(gridPx, ((hh * 60 + mm - startMin) / 60) * HOUR_PX));
                };
                const nowPx = toPx(fmtTime(nowTick, tz));
                const nowVisible = nowPx > 0 && nowPx < gridPx;
                const halfHourSlots = Array.from({ length: slotsCount }).map((_, idx) => {
                  const total = startMin + idx * 30;
                  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                });
                return (
                  <div className="mb-6 rounded-2xl border border-[var(--line)] shadow-sm bg-[var(--surface)] overflow-hidden">
                    {/* Day headers */}
                    <div className="flex border-b border-[var(--line)]">
                      <div className="w-11 sm:w-14 shrink-0" />
                      {gridDays.map((day, idx) => {
                        const dayKeyStr = formatDateLocal(day);
                        const isToday = todayStr === dayKeyStr;
                        const isSelected = date === dayKeyStr;
                        return (
                          <div
                            key={dayKeyStr}
                            onClick={() => selectCalendarDate(day)}
                            className="flex-1 min-w-0 flex flex-col items-center py-1.5 cursor-pointer"
                          >
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--ink-2)]">
                              {isWeek ? WEEKDAY_SHORT_LABELS[idx] : WEEKDAYS_LONG[(day.getDay() + 6) % 7]}
                            </span>
                            <span className={cn(
                              "text-sm sm:text-base font-extrabold w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full mt-0.5",
                              isToday ? "bg-[#ba1a1a] text-white" : isSelected && isWeek ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--ink)]"
                            )}>
                              {day.getDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time grid: no inner scroll, the page itself scrolls */}
                    <div>
                      <div className="relative flex" style={{ height: gridPx }}>
                        {/* Hour labels gutter */}
                        <div className="relative w-11 sm:w-14 shrink-0">
                          {Array.from({ length: hoursCount }).map((_, idx) => (
                            idx > 0 ? (
                              <span
                                key={idx}
                                style={{ top: idx * HOUR_PX }}
                                className="absolute right-1.5 sm:right-2 -translate-y-1/2 text-[9px] sm:text-[10px] font-bold text-[var(--ink-2)]"
                              >
                                {String(startMin / 60 + idx).padStart(2, "0")}:00
                              </span>
                            ) : null
                          ))}
                        </div>

                        {/* Day columns */}
                        <div ref={gridRef} className="relative flex-1 flex">
                          {/* Hour and half-hour background lines */}
                          {Array.from({ length: slotsCount }).map((_, idx) => (
                            <div
                              key={idx}
                              style={{ top: (idx * HOUR_PX) / 2 }}
                              className={cn(
                                "absolute left-0 right-0 pointer-events-none z-0",
                                idx % 2 === 0 ? "border-t border-[var(--line)]" : "border-t border-dashed border-[var(--line)]/50"
                              )}
                            />
                          ))}

                          {gridDays.map((day) => {
                            const dayKeyStr = formatDateLocal(day);
                            const isToday = todayStr === dayKeyStr;
                            const dayAppts = filteredMonthAppts.filter(a => a.starts_at.slice(0, 10) === dayKeyStr);
                            const positionStyles = computeOverlappingSlots(dayAppts);
                            const closed = isClosedDate(dayKeyStr);
                            return (
                              <div
                                key={dayKeyStr}
                                className={cn(
                                  "relative flex-1 min-w-0 border-l border-[var(--line)]/40",
                                  closed ? "bg-[var(--surface-2)]/70" : isWeek && isToday && "bg-[#ba1a1a]/[0.03]"
                                )}
                              >
                                {closed && (
                                  <div className="absolute inset-x-0 top-2 z-0 text-center text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-[var(--ink-2)]/70 select-none pointer-events-none">
                                    Chiuso
                                  </div>
                                )}
                                {/* Tap-to-create and drop targets */}
                                {!closed && halfHourSlots.map((slot, idx) => (
                                  <div
                                    key={slot}
                                    onClick={() => {
                                      setDate(dayKeyStr);
                                      setNewApptTime(slot);
                                      setNewOpen(true);
                                    }}
                                    style={{ top: (idx * HOUR_PX) / 2, height: HOUR_PX / 2 }}
                                    className="absolute left-0 right-0 z-0 cursor-pointer active:bg-[var(--ink)]/10 transition-colors"
                                  />
                                ))}

                                {/* Appointment blocks */}
                                {dayAppts.map((a) => {
                                  const emp = empById.get(a.employee_id);
                                  const startStr = fmtTime(new Date(a.starts_at), tz);
                                  const endStr = fmtTime(new Date(a.ends_at), tz);
                                  const topPx = toPx(startStr);
                                  const heightPx = Math.max(24, toPx(endStr) - topPx);
                                  const lane = positionStyles.get(a.id) || { left: 0, width: 100 };
                                  return (
                                    <div
                                      key={a.id}
                                      onPointerDown={(e) => startApptDrag(e, a)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (justDraggedRef.current) return;
                                        setActive(a);
                                      }}
                                      style={{
                                        top: topPx + 1,
                                        height: heightPx - 2,
                                        left: `${lane.left}%`,
                                        width: `calc(${lane.width}% - 3px)`,
                                        backgroundColor: emp?.color ?? "#3E1B33",
                                        color: readableTextOn(emp?.color ?? "#3E1B33"),
                                      }}
                                      className={cn(
                                        "absolute z-10 rounded-[4px] sm:rounded-[6px] px-1.5 py-0.5 sm:px-2 sm:py-1 overflow-hidden cursor-grab active:cursor-grabbing shadow-sm hover:brightness-105 transition-[opacity,filter] duration-150 flex flex-col",
                                        heightPx <= 40 ? "justify-center" : "justify-start",
                                        dragTarget?.apptId === a.id && "opacity-40"
                                      )}
                                    >
                                      <p className={cn(
                                        "font-bold truncate leading-tight select-none",
                                        isWeek ? "text-[9px] sm:text-[11px]" : "text-[11px] sm:text-xs"
                                      )}>
                                        {a.customer_name}
                                      </p>
                                      {(!isWeek || heightPx > 36) && (
                                        <p className={cn(
                                          "truncate leading-tight opacity-90 select-none",
                                          isWeek ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]"
                                        )}>
                                          {isWeek
                                            ? startStr
                                            : `${startStr} – ${endStr} · ${a.service_name}${a.addons && a.addons.length > 0 ? ` +${a.addons.length} extra` : ""}`}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Drag ghost preview */}
                                {dragTarget && dayKeys[dragTarget.col] === dayKeyStr && (
                                  <div
                                    style={{
                                      top: (dragTarget.slot * HOUR_PX) / 2,
                                      height: (dragTarget.durMin / 60) * HOUR_PX,
                                    }}
                                    className={cn(
                                      "absolute left-0 right-0 z-30 rounded-[6px] border-2 border-dashed pointer-events-none",
                                      dragTarget.valid
                                        ? "border-[var(--ink)] bg-[var(--ink)]/10"
                                        : "border-[#ba1a1a] bg-[#ba1a1a]/10"
                                    )}
                                  />
                                )}

                                {/* Now indicator */}
                                {isToday && nowVisible && (
                                  <div style={{ top: nowPx }} className="absolute left-0 right-0 z-20 pointer-events-none">
                                    <div className="h-[2px] bg-[#ba1a1a]" />
                                    <div className="absolute left-0 -top-[3px] w-2 h-2 rounded-full bg-[#ba1a1a]" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Floating action button: new appointment */}
            <button
              onClick={() => {
                setNewApptTime("10:00");
                setNewOpen(true);
              }}
              aria-label="Nuovo appuntamento"
              className="fixed bottom-24 right-5 z-40 h-14 w-14 rounded-2xl bg-[#8A3D6E] hover:bg-[#6F2F57] !text-white shadow-xl flex items-center justify-center active:scale-95 transition-all border-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-[28px]">add</span>
            </button>
          </div>
        )}

        {/* TAB 3: CLIENT CONTACTS */}
        {ownerTab === "clients" && (
          <div>
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--ink)] tracking-tight">Contatti Clienti</h2>
                <p className="text-[var(--ink-2)] text-sm mt-1">Visualizza la lista dei clienti registrati ed il loro storico trattamenti.</p>
              </div>

              {/* Search bar */}
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  placeholder="Cerca cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 rounded-xl bg-[var(--surface)] border border-[var(--line)] outline-none focus:border-[var(--ink)] px-10 text-sm font-medium shadow-sm"
                />
                <span className="material-symbols-outlined absolute left-3 top-3 text-[var(--ink-2)] text-lg">search</span>
              </div>
            </div>

            {loadingClients ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="ios-card rounded-2xl p-12 text-center text-[var(--ink-2)] bg-[var(--surface)]">
                <span className="material-symbols-outlined text-4xl">contacts</span>
                <p className="mt-2 text-sm">Nessun cliente corrispondente alla ricerca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredClients.map(c => (
                  <div
                    key={c.id}
                    onClick={() => loadClientHistoryDetails(c)}
                    className="ios-card rounded-xl p-4 border border-[var(--line)] hover:border-[var(--ink)] hover:shadow-md cursor-pointer transition-all flex items-center justify-between bg-[var(--surface)]"
                  >
                    <div className="flex gap-4 items-center min-w-0">
                      <div className="w-10 h-10 rounded-full bg-[var(--accent-2)]/30 text-[var(--ink)] flex items-center justify-center font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-[var(--ink)] truncate">{c.name}</h4>
                        <p className="text-xs text-[var(--ink-2)] mt-0.5">{c.phone}</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-[var(--ink-2)] hover:text-[var(--ink)]">chevron_right</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 bg-[var(--surface)]/85 backdrop-blur-md shadow-[0_-8px_30px_rgba(62,27,51,0.06)] border-t border-[var(--line)]/20">
        <div className="flex justify-around items-center w-full px-6 py-3 pb-safe max-w-screen-md mx-auto">
          <button
            onClick={() => setOwnerTab("dashboard")}
            className={cn(
              "flex flex-col items-center justify-center gap-1 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent",
              ownerTab === "dashboard" ? "text-[var(--ink)] font-bold" : "text-[var(--ink-2)] hover:opacity-85"
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
              ownerTab === "calendar" ? "text-[var(--ink)] font-bold" : "text-[var(--ink-2)] hover:opacity-85"
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
              ownerTab === "clients" ? "text-[var(--ink)] font-bold" : "text-[var(--ink-2)] hover:opacity-85"
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
              className="flex flex-col items-center justify-center gap-1 text-[var(--ink-2)] hover:opacity-85 active:scale-95 transition-all duration-200 cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined text-[24px]">content_cut</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Servizi</span>
            </button>
          )}
        </div>
      </nav>

      {/* Appointment detail / edit / cancel sheet */}
      {apptSheetData && (
        <ApptSheet
          key={apptSheetData.id}
          open={!!active}
          appt={apptSheetData}
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
        defaultTime={newApptTime}
        restrictToEmployeeId={restrictToEmployeeId}
        apiCreateOwnerAppointment={apiCreateOwnerAppointment}
        onCreated={() => {
          setNewOpen(false);
          load();
        }}
      />

      {/* Client Detail & History history sheet */}
      <Sheet
          open={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          title={`Scheda Cliente: ${clientSheetData?.name ?? ""}`}
          dismissible={true}
        >
        {clientSheetData && (<>
          <div className="space-y-5 py-2">
            <div className="rounded-2xl border border-[var(--line)] divide-y divide-[var(--line)] overflow-hidden bg-[var(--surface-2)]/30">
              <DetailRow label="Nome" value={clientSheetData.name} />
              <DetailRow label="WhatsApp" value={clientSheetData.phone} />
            </div>

            <div className="space-y-2 mt-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4">
              <h4 className="text-base font-bold text-[var(--ink)] pb-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">assignment</span> Note Generali Contatto
              </h4>
              <p className="text-[10px] text-[var(--ink-2)] font-bold uppercase tracking-wider">
                Da ricordare assolutamente (es. allergie, formule colore)
              </p>
              <textarea
                className="w-full h-24 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] placeholder-[var(--ink-2)]/70 p-3 outline-none border border-transparent focus:border-[var(--ink)] transition-all font-medium text-xs resize-none"
                value={customerNotesText}
                onChange={(e) => setCustomerNotesText(e.target.value)}
                placeholder="Scrivi qui formule colore, allergie o cose da ricordare..."
              />
              <button
                onClick={async () => {
                  setSavingCustomerNotes(true);
                  const res = await updateCustomerNotes(clientSheetData.id, customerNotesText);
                  setSavingCustomerNotes(false);
                  if (res.ok) {
                    clientSheetData.notes = customerNotesText;
                    setAllClients(prev => prev.map(c => c.id === clientSheetData.id ? { ...c, notes: customerNotesText } : c));
                    alert("Note salvate con successo!");
                  } else {
                    alert(res.error || "Errore.");
                  }
                }}
                disabled={savingCustomerNotes}
                className="w-full h-11 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-press)] !text-[var(--on-accent)] font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-md border-none"
              >
                {savingCustomerNotes ? "Salvataggio..." : "Salva Note Contatto"}
              </button>
            </div>

            <h4 className="text-base font-bold text-[var(--ink)] border-b border-[var(--line)] pb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">history</span> Cronologia Trattamenti
            </h4>

            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--surface-2)]" />
                ))}
              </div>
            ) : clientHistory.length === 0 ? (
              <p className="text-xs text-[var(--ink-2)] italic">Nessun appuntamento completato in precedenza.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[300px] no-scrollbar">
                {clientHistory.map(a => (
                  <div key={a.id} className="ios-card rounded-xl p-3 border border-[var(--line)] bg-[var(--surface)] shadow-sm space-y-2">
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-[var(--ink)] text-sm block">{a.service_name}</span>
                        <span className="text-[var(--ink-2)]">{formatHistoryDate(a.starts_at)}</span>
                      </div>
                      <span className={cn(
                        "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded",
                        a.status === "cancelled" ? "bg-[#ba1a1a]/10 text-[#ba1a1a]" : "bg-[var(--bg)] text-[var(--ink-2)]"
                      )}>
                        {a.status}
                      </span>
                    </div>

                    {a.owner_notes && (
                      <div className="bg-[var(--surface-2)]/40 p-2.5 rounded-lg border border-[var(--line)] text-[11px] leading-relaxed">
                        <span className="font-bold text-[var(--ink)] block mb-0.5">Nota Titolare:</span>
                        <span className="text-[var(--ink-2)] italic">{a.owner_notes}</span>
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
                </>)}
      </Sheet>

      {/* QR Code Share Sheet */}
      <Sheet
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          title="QR Code di Prenotazione"
          dismissible={true}
        >
          <div className="space-y-6 py-2 text-center">
            <p className="text-[var(--ink-2)] text-xs font-semibold uppercase tracking-wider">
              Mostra questo QR Code al cliente o stampalo per il tuo negozio.
            </p>

            <div ref={qrRef} className="mx-auto w-fit rounded-2xl bg-[var(--surface)] p-4 border border-[var(--line-strong)]/30 shadow-sm">
              <QRCodeCanvas value={`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/b/${business.slug}`} size={200} level="M" marginSize={0} />
            </div>

            <div className="bg-[var(--bg)] rounded-xl p-3 border border-[var(--line-strong)]/20 break-all text-xs font-bold text-[var(--ink)]">
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
                className="flex-1 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--line-strong)]/30 font-semibold text-xs text-[var(--ink)] active:scale-95 transition-all cursor-pointer"
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
                          h1 { color: #3E1B33; font-size: 24px; margin: 0 0 10px 0; }
                          p { color: #A18A97; font-size: 16px; margin: 0; }
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
              className="text-xs font-bold text-[var(--ink-2)] uppercase tracking-wider cursor-pointer hover:opacity-85"
            >
              Chiudi
            </button>
          </div>
        </Sheet>

      {/* Month-view drop confirmation: target day fixed, time adjustable */}
      <Sheet
          open={!!monthDropPrompt}
          onClose={() => setMonthDropPrompt(null)}
          title="Sposta appuntamento"
          dismissible={true}
        >
        {monthDropData && (<>
          <div className="space-y-5 py-2">
            <p className="text-sm text-[var(--ink-2)] text-center">
              Spostare l&apos;appuntamento di{" "}
              <strong className="text-[var(--accent)]">{monthDropData.appt.customer_name}</strong> a{" "}
              <strong className="text-[var(--accent)] capitalize">{dayTitle(monthDropData.dateStr)}</strong>?
            </p>
            <label className="block max-w-[180px] mx-auto">
              <span className="mb-1.5 block text-center text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                Orario
              </span>
              <input
                type="time"
                value={monthDropTime}
                onChange={(e) => setMonthDropTime(e.target.value)}
                className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] text-center text-base text-[var(--ink)] font-bold"
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setMonthDropPrompt(null)}
                className="flex-1 ios-btn-secondary h-12 text-sm font-bold border border-[var(--line)] bg-[var(--surface)]"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  const p = monthDropData;
                  setMonthDropPrompt(null);
                  if (p && /^\d{2}:\d{2}$/.test(monthDropTime)) {
                    rescheduleTo(p.appt, p.dateStr, monthDropTime);
                  }
                }}
                className="flex-1 ios-btn-primary h-12 text-sm font-bold"
              >
                Conferma
              </button>
            </div>
          </div>
                </>)}
      </Sheet>

      {/* WhatsApp Notify Sheet for Drag & Drop Reschedule */}
      <Sheet
          open={!!dragRescheduleResult}
          onClose={() => setDragRescheduleResult(null)}
          title="Appuntamento Spostato"
          dismissible={true}
        >
        {dragResultData && (<>
          <div className="space-y-6 py-2 text-center">
            <p className="text-[var(--ink-2)] text-sm">
              L&apos;appuntamento di <strong className="text-[var(--accent)]">{dragResultData.customerName}</strong> è stato spostato a:
            </p>
            <div className="bg-[var(--surface-2)] rounded-2xl p-4 border border-[var(--line-strong)]/30 font-bold font-serif text-[var(--accent)] text-lg">
              {dragResultData.whenText}
            </div>
            
            {dragResultData.waHref ? (
              <>
                <p className="text-xs text-[var(--ink-2)] font-medium uppercase tracking-wider">
                  Avvisa il cliente su WhatsApp del cambio di orario:
                </p>
                <WhatsAppButton href={dragResultData.waHref} />
              </>
            ) : (
              <p className="text-xs text-[var(--ink-2)] italic">
                Nessun numero di telefono registrato per questo cliente.
              </p>
            )}

            <button
              onClick={() => setDragRescheduleResult(null)}
              className="text-xs font-bold text-[var(--ink-2)] uppercase tracking-wider cursor-pointer hover:opacity-85"
            >
              Chiudi
            </button>
          </div>
                </>)}
      </Sheet>

      {/* Real-time Toast alert */}
      {toast && (
        <div 
          onClick={() => {
            setDate(toast.apptDateStr);
            setToast(null);
          }}
          className="notification-toast fixed top-6 right-6 left-6 md:left-auto md:w-96 bg-[var(--surface)] border border-[var(--ink)]/20 shadow-lg rounded-2xl p-4 z-50 flex items-start gap-3.5 cursor-pointer hover:shadow-xl transition-all duration-300"
        >
          <div className="h-10 w-10 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center text-[var(--ink)] shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-[20px] animate-bounce">notifications_active</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-serif font-bold text-sm text-[var(--ink)] leading-none mb-1">{toast.title}</h4>
            <p className="text-xs text-[var(--ink-2)] font-medium leading-relaxed mb-1.5">{toast.body}</p>
            <span className="text-[10px] text-[var(--ink)] font-bold uppercase tracking-wider block">
              Clicca per visualizzare nell&apos;agenda
            </span>
          </div>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setToast(null); 
            }} 
            className="text-[var(--ink-2)] hover:text-[var(--ink)] shrink-0 cursor-pointer"
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
              <span className="material-symbols-outlined text-[var(--ink-2)] text-[48px] opacity-40 mb-3 block">notifications_off</span>
              <p className="text-sm text-[var(--ink-2)] italic">Nessuna nuova prenotazione in questa sessione.</p>
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
                      n.read ? "opacity-75 border-[var(--line-strong)]/20 bg-[var(--surface)]/40" : "border-[var(--ink)]/20 bg-[var(--bg)]/80 shadow-[0_2px_8px_rgba(62,27,51,0.04)]"
                    )}
                  >
                    {!n.read && (
                      <span className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                    )}
                    <h4 className="font-serif font-bold text-sm text-[var(--ink)] mb-1 pr-6">{n.title}</h4>
                    <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-2 font-medium">{n.body}</p>
                    <span className="text-[10px] text-[var(--ink-2)]/70 font-semibold uppercase tracking-wider block">
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
                className="w-full text-center py-2 text-xs font-bold text-[var(--ink-2)] uppercase tracking-wider border-t border-[var(--line-strong)]/25 pt-3 hover:text-[var(--ink)] transition-colors cursor-pointer"
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
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[var(--ink)]">
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-[var(--ink)]">
      <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Appt detail & edit sheet */
function ApptSheet({
  open,
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
  open: boolean;
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

  // Fresh state every time the sheet reopens
  useEffect(() => {
    if (open) {
      setMode("view");
      setResult(null);
      setError(null);
      setONotes(appt.owner_notes ?? "");
      setRDate(dayKey(new Date(appt.starts_at), tz));
      setRTime(fmtTime(new Date(appt.starts_at), tz));
      setREmp(restrictToEmployeeId ?? appt.employee_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    <Sheet open={open} onClose={onClose} title={title} dismissible={false}>
      {result ? (
        <div className="space-y-4 text-center">
          <p className="text-[var(--ink-2)]">{result.text}</p>
          {result.href ? (
            <>
              <p className="font-bold text-sm text-[var(--ink)]">Avvisa il cliente su WhatsApp:</p>
              <WhatsAppButton href={result.href} />
              <button onClick={onClose} className="w-full py-2.5 text-[var(--ink-2)] text-sm font-bold border-none bg-transparent cursor-pointer">
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
            {appt.addons && appt.addons.length > 0 && (
              <DetailRow
                label="Extra"
                value={appt.addons
                  .map((ad) => `${ad.name} (+${ad.extra_min} min · +${formatPrice(ad.extra_price_cents)})`)
                  .join(", ")}
              />
            )}
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
            <label className="block text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
              Note Trattamento (Cosa hai fatto al cliente)
            </label>
            <textarea
              value={oNotes}
              onChange={(e) => setONotes(e.target.value)}
              placeholder="Inserisci formule colore, taglio o note utili per la prossima volta..."
              rows={3}
              className="w-full rounded-xl bg-[var(--surface-2)] text-[var(--ink)] placeholder-[var(--ink-2)]/70 px-4 py-3 outline-none border border-transparent focus:border-[var(--ink)] transition-all font-medium resize-none shadow-sm text-sm"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-1 px-4 py-2 bg-[var(--ink)] text-[var(--bg)] rounded-full text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none"
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
                  `Ti ricordiamo il tuo appuntamento da ${businessName} (${appt.service_name}${appt.addons && appt.addons.length > 0 ? ` + ${appt.addons.map((ad) => ad.name).join(" + ")}` : ""}) confermato per ${fmtWhen(new Date(appt.starts_at), tz)}.\n\n` +
                  `Ti aspettiamo! 👋`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-full border border-[var(--line)] text-[var(--ink)] font-bold flex items-center justify-center gap-2 hover:bg-[var(--surface-2)] transition-all active:scale-[0.98] cursor-pointer shadow-sm bg-[var(--surface)]"
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
              <span className="mb-1.5 block px-1 text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                Data
              </span>
              <input
                type="date"
                value={rDate}
                min={dayKey(new Date(), tz)}
                onChange={(e) => setRDate(e.target.value)}
                className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] text-sm text-[var(--ink)] font-medium"
              />
            </label>
            <label className="w-[38%]">
              <span className="mb-1.5 block px-1 text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
                Ora
              </span>
              <input
                type="time"
                value={rTime}
                onChange={(e) => setRTime(e.target.value)}
                className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] text-center text-sm text-[var(--ink)] font-medium"
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block px-1 text-xs font-bold text-[var(--ink)] uppercase tracking-wider">
              Operatore
            </span>
            <select
              value={rEmp}
              onChange={(e) => setREmp(e.target.value)}
              disabled={!!restrictToEmployeeId}
              className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] disabled:opacity-75 text-sm text-[var(--ink)] font-medium"
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
              className="flex-1 ios-btn-secondary h-12 text-sm font-bold border border-[var(--line)] bg-[var(--surface)]"
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
  defaultTime,
  onCreated,
  restrictToEmployeeId,
  apiCreateOwnerAppointment,
}: {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  services: Service[];
  defaultDate: string;
  defaultTime?: string;
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

  // Prefill date and time from the tapped calendar slot
  useEffect(() => {
    if (open) {
      setDate(defaultDate);
      setTime(defaultTime ?? "10:00");
    }
  }, [open, defaultDate, defaultTime]);

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
          className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[var(--ink)]"
        />
        <input
          type="tel"
          placeholder="Numero WhatsApp (facoltativo)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[var(--ink)]"
        />
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[var(--ink)]"
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
          className="w-full h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium disabled:opacity-75 text-sm text-[var(--ink)]"
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
            className="flex-1 h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] font-medium text-sm text-[var(--ink)]"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-[38%] h-12 rounded-xl bg-[var(--surface-2)] px-4 outline-none border border-transparent focus:border-[var(--ink)] text-center font-medium text-sm text-[var(--ink)]"
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
      <span className="text-xs font-bold text-[var(--ink-2)] w-20 shrink-0 pt-0.5 uppercase tracking-wider">{label}</span>
      <span className="flex-1 font-bold text-sm text-[var(--ink)]">{value}</span>
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
