import { fmtTime, zonedToUtc } from "./time";

export type BusyInterval = { start: number; end: number }; // epoch ms, half-open
export type Slot = { time: string; startUtc: string }; // 'HH:mm', ISO instant

export interface DayHours {
  isClosed: boolean;
  open: string | null; // 'HH:mm[:ss]'
  close: string | null;
  breakStart: string | null;
  breakEnd: string | null;
}

/**
 * All bookable start times for one business-local day, given the day's opening
 * hours, the service duration, a step granularity, and the busy intervals of
 * the target employee(s). Past slots (before now + lead) are excluded.
 */
export function computeSlots(opts: {
  dateStr: string; // 'yyyy-MM-dd' business-local
  tz: string;
  hours: DayHours | null;
  durationMin: number;
  stepMin: number;
  busy: BusyInterval[];
  nowMs: number;
  leadMin: number;
}): Slot[] {
  const { dateStr, tz, hours, durationMin, stepMin, busy, nowMs, leadMin } = opts;
  if (!hours || hours.isClosed || !hours.open || !hours.close) return [];

  const windows: Array<[string, string]> = [];
  if (hours.breakStart && hours.breakEnd) {
    windows.push([hours.open, hours.breakStart]);
    windows.push([hours.breakEnd, hours.close]);
  } else {
    windows.push([hours.open, hours.close]);
  }

  const durMs = durationMin * 60_000;
  const stepMs = Math.max(1, stepMin) * 60_000;
  const minStartMs = nowMs + leadMin * 60_000;
  const slots: Slot[] = [];

  for (const [ws, we] of windows) {
    const winStart = zonedToUtc(dateStr, ws, tz).getTime();
    const winEnd = zonedToUtc(dateStr, we, tz).getTime();

    for (let s = winStart; s + durMs <= winEnd; s += stepMs) {
      const e = s + durMs;
      if (s < minStartMs) continue;
      const overlaps = busy.some((b) => s < b.end && e > b.start);
      if (overlaps) continue;
      slots.push({ time: fmtTime(new Date(s), tz), startUtc: new Date(s).toISOString() });
    }
  }

  return slots;
}

/** Merge slot lists from multiple employees, de-duplicated by start instant. */
export function unionSlots(lists: Slot[][]): Slot[] {
  const byStart = new Map<string, Slot>();
  for (const list of lists) {
    for (const slot of list) byStart.set(slot.startUtc, slot);
  }
  return [...byStart.values()].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}
