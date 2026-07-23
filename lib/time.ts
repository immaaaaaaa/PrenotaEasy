import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { it } from "date-fns/locale";

/**
 * Combine a business-local calendar day + wall-clock time into a UTC instant.
 * @param dateStr 'yyyy-MM-dd'
 * @param timeStr 'HH:mm' or 'HH:mm:ss'
 */
export function zonedToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return fromZonedTime(`${dateStr}T${t}`, tz);
}

/** Weekday of a business-local day, 0 = Monday … 6 = Sunday. */
export function weekdayMonday0(dateStr: string, tz: string): number {
  const instant = fromZonedTime(`${dateStr}T12:00:00`, tz); // noon avoids DST edges
  return Number(formatInTimeZone(instant, tz, "i")) - 1;
}

/** 'yyyy-MM-dd' for the given instant in the business timezone. */
export function dayKey(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

export function fmtTime(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "HH:mm");
}

/** e.g. "lunedì 14 luglio" */
export function fmtDateLong(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "EEEE d MMMM", { locale: it });
}

/** e.g. "lun 14 lug" */
export function fmtDateShort(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "EEE d MMM", { locale: it });
}

/** e.g. "lunedì 14 luglio alle 15:30" — used in WhatsApp messages. */
export function fmtWhen(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "EEEE d MMMM 'alle' HH:mm", { locale: it });
}
