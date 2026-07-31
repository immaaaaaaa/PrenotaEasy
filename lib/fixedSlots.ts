import { fmtTime, zonedToUtc } from "./time";
import type { ServiceSlot, ServiceSlotException } from "./types";

/**
 * One concrete bookable occurrence of a fixed-slot service on a given date.
 * `employeeId === null` means "any operator", resolved at booking time.
 */
export type FixedSlotOccurrence = {
  time: string; // 'HH:mm' business-local
  startUtc: string; // ISO instant
  employeeId: string | null;
  slotId: string | null; // null for one-off 'extra' occurrences
};

const normalizeTime = (t: string): string => t.slice(0, 5); // 'HH:mm:ss' → 'HH:mm'

/**
 * Expand the recurring pattern + per-date exceptions into the concrete
 * occurrences of one business-local day. Pure: shared by /api/availability
 * (listing) and /api/book (validation) so they can never disagree.
 *
 * Fixed slots deliberately ignore business opening hours (the owner picked
 * them explicitly); holidays are the caller's responsibility.
 */
export function computeFixedSlotOccurrences(opts: {
  dateStr: string; // 'yyyy-MM-dd' business-local
  tz: string;
  weekday: number; // 0 = Monday … 6 = Sunday, for dateStr
  slots: ServiceSlot[];
  exceptions: ServiceSlotException[];
  nowMs: number;
  leadMin: number;
}): FixedSlotOccurrence[] {
  const { dateStr, tz, weekday, slots, exceptions, nowMs, leadMin } = opts;

  const dayExceptions = exceptions.filter((e) => e.date === dateStr);
  const removedSlotIds = new Set(
    dayExceptions.filter((e) => e.kind === "removed" && e.slot_id).map((e) => e.slot_id as string),
  );

  const occurrences: FixedSlotOccurrence[] = [];

  for (const s of slots) {
    if (!s.active || s.weekday !== weekday) continue;
    if (removedSlotIds.has(s.id)) continue;
    const start = zonedToUtc(dateStr, normalizeTime(s.start_time), tz);
    occurrences.push({
      time: fmtTime(start, tz),
      startUtc: start.toISOString(),
      employeeId: s.employee_id,
      slotId: s.id,
    });
  }

  for (const e of dayExceptions) {
    if (e.kind !== "extra" || !e.start_time) continue;
    const start = zonedToUtc(dateStr, normalizeTime(e.start_time), tz);
    occurrences.push({
      time: fmtTime(start, tz),
      startUtc: start.toISOString(),
      employeeId: e.employee_id,
      slotId: null,
    });
  }

  const minStartMs = nowMs + leadMin * 60_000;
  const byStart = new Map<string, FixedSlotOccurrence>();
  for (const o of occurrences) {
    if (new Date(o.startUtc).getTime() < minStartMs) continue;
    // Same instant twice (recurring + extra): keep the first, they are equivalent for booking.
    if (!byStart.has(o.startUtc)) byStart.set(o.startUtc, o);
  }

  return [...byStart.values()].sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}
