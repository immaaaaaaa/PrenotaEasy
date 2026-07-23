import {
  MONTHS_LONG,
  MONTHS_SHORT,
  WEEKDAYS_LONG,
  WEEKDAYS_SHORT,
} from "./constants";

/** Add (or subtract) calendar days to a 'yyyy-MM-dd' string, DST-safe. */
export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** e.g. "Giovedì 17 luglio" */
export function dayTitle(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday0 = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return `${WEEKDAYS_LONG[weekday0]} ${d} ${MONTHS_LONG[m - 1].toLowerCase()}`;
}

/** "Oggi" / "Domani" / null relative to today. */
export function relLabel(dateStr: string, todayStr: string): string | null {
  if (dateStr === todayStr) return "Oggi";
  if (dateStr === addDaysStr(todayStr, 1)) return "Domani";
  return null;
}

export interface DayCell {
  dateStr: string; // 'yyyy-MM-dd'
  weekday0: number; // 0 = Monday … 6 = Sunday
  dayNum: number;
  weekdayLabel: string;
  monthLabel: string;
  isToday: boolean;
}

/**
 * Build a rail of calendar days starting at `todayStr` (a business-local
 * 'yyyy-MM-dd'). Uses pure UTC date arithmetic so it's immune to DST — these
 * are calendar dates for labelling, not instants.
 */
export function buildDays(todayStr: string, count: number): DayCell[] {
  const [y, m, d] = todayStr.split("-").map(Number);
  const cells: DayCell[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const weekday0 = (dt.getUTCDay() + 6) % 7; // Sun=0 → Mon=0 shift
    cells.push({
      dateStr: dt.toISOString().slice(0, 10),
      weekday0,
      dayNum: dt.getUTCDate(),
      weekdayLabel: WEEKDAYS_SHORT[weekday0],
      monthLabel: MONTHS_SHORT[dt.getUTCMonth()],
      isToday: i === 0,
    });
  }
  return cells;
}
