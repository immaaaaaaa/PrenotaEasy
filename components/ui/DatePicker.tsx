"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { MONTHS_LONG, WEEKDAYS_SHORT } from "@/lib/constants";
import { spring } from "@/lib/motion";

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysInMonth = (y: number, m: number) =>
  new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const firstWeekdayMon0 = (y: number, m: number) =>
  (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Month calendar (Monday-first), inspired by Cal.com's Booker date picker.
 * Disables past days, days beyond the booking horizon, and weekly closed days.
 */
export function DatePicker({
  value,
  onChange,
  todayStr,
  horizonDays,
  closedWeekdays,
}: {
  value: string;
  onChange: (dateStr: string) => void;
  todayStr: string;
  horizonDays: number;
  closedWeekdays: number[];
}) {
  const reduce = useReducedMotion();
  const closedSet = useMemo(() => new Set(closedWeekdays), [closedWeekdays]);
  const maxDate = useMemo(
    () => addDaysStr(todayStr, Math.max(0, horizonDays - 1)),
    [todayStr, horizonDays],
  );

  const [vy, vm] = value.split("-").map(Number);
  const [view, setView] = useState({ y: vy, m: vm - 1 }); // m is 0-based
  const [dir, setDir] = useState(0);

  const minMonth = { y: Number(todayStr.slice(0, 4)), m: Number(todayStr.slice(5, 7)) - 1 };
  const maxMonth = { y: Number(maxDate.slice(0, 4)), m: Number(maxDate.slice(5, 7)) - 1 };
  const monthIndex = (mm: { y: number; m: number }) => mm.y * 12 + mm.m;
  const canPrev = monthIndex(view) > monthIndex(minMonth);
  const canNext = monthIndex(view) < monthIndex(maxMonth);

  function shift(delta: number) {
    setDir(delta);
    setView((v) => {
      const idx = v.y * 12 + v.m + delta;
      return { y: Math.floor(idx / 12), m: idx % 12 };
    });
  }

  const cells = useMemo(() => {
    const lead = firstWeekdayMon0(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const arr: (string | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(key(view.y, view.m, d));
    return arr;
  }, [view]);

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          onClick={() => shift(-1)}
          disabled={!canPrev}
          aria-label="Mese precedente"
          className="grid h-9 w-9 place-items-center rounded-full transition-colors active:bg-[var(--surface-2)] disabled:opacity-30"
        >
          <Chevron dir="left" />
        </button>
        <div className="text-headline">
          {MONTHS_LONG[view.m]} {view.y}
        </div>
        <button
          onClick={() => shift(1)}
          disabled={!canNext}
          aria-label="Mese successivo"
          className="grid h-9 w-9 place-items-center rounded-full transition-colors active:bg-[var(--surface-2)] disabled:opacity-30"
        >
          <Chevron dir="right" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[0.72rem] font-[560] text-[var(--ink-3)]">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={`${view.y}-${view.m}`}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -24 }}
            transition={spring.snappy}
            className="grid grid-cols-7 gap-1"
          >
            {cells.map((cell, i) => {
              if (!cell) return <div key={`e${i}`} />;
              const weekday0 = (firstWeekdayMon0(view.y, view.m) + (Number(cell.slice(8)) - 1)) % 7;
              const disabled =
                cell < todayStr || cell > maxDate || closedSet.has(weekday0);
              const selected = cell === value;
              const isToday = cell === todayStr;
              return (
                <button
                  key={cell}
                  disabled={disabled}
                  onClick={() => onChange(cell)}
                  className={cn(
                    "relative mx-auto grid h-10 w-10 place-items-center rounded-full text-[0.95rem] transition-[transform,background-color] duration-100 active:scale-90",
                    selected && "bg-[var(--accent)] font-[600] text-[var(--on-accent)]",
                    !selected && !disabled && "hover:bg-[var(--surface-2)]",
                    disabled && "text-[var(--ink-3)] opacity-40",
                  )}
                >
                  {Number(cell.slice(8))}
                  {isToday && !selected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--accent)]" />
                  )}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="text-[var(--ink)]">
      <path
        d={dir === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
