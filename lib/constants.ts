import type { Weekday } from "./types";

/** Monday-first, Italian. Index matches the `weekday` column (0 = Monday). */
export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
export const WEEKDAYS_LONG = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export const MONTHS_SHORT = [
  "gen", "feb", "mar", "apr", "mag", "giu",
  "lug", "ago", "set", "ott", "nov", "dic",
];

export const MONTHS_LONG = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export function formatPrice(cents: number): string {
  if (cents === 0) return "Gratis";
  const euros = cents / 100;
  return `€${euros % 1 === 0 ? euros.toFixed(0) : euros.toFixed(2).replace(".", ",")}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Colours assigned to employees, in order. */
export const EMPLOYEE_COLORS = [
  "#c24e63", "#4c7bd0", "#3f9e6b", "#d08b1f",
  "#8b5cf6", "#0ea5a4", "#e0697e", "#ef6c3b",
];

export const DURATION_OPTIONS = [15, 20, 30, 45, 60, 75, 90, 120];

export function eurosToCents(input: string): number {
  const n = parseFloat(input.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centsToEuros(cents: number): string {
  return (cents / 100).toString().replace(".", ",");
}
