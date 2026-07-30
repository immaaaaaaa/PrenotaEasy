// Test script for slots logic
const { formatInTimeZone, fromZonedTime } = require('date-fns-tz');

function zonedToUtc(dateStr, timeStr, tz) {
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  return fromZonedTime(`${dateStr}T${t}`, tz);
}

function fmtTime(date, tz) {
  return formatInTimeZone(date, tz, "HH:mm");
}

function testComputeSlots(opts) {
  const { dateStr, tz, hours, durationMin, stepMin, busy, nowMs, leadMin } = opts;
  if (!hours || hours.isClosed || !hours.open || !hours.close) return [];

  const windows = [];
  if (hours.breakStart && hours.breakEnd) {
    windows.push([hours.open, hours.breakStart]);
    windows.push([hours.breakEnd, hours.close]);
  } else {
    windows.push([hours.open, hours.close]);
  }

  const durMs = durationMin * 60_000;
  const stepMs = Math.max(1, stepMin) * 60_000;
  const minStartMs = nowMs + leadMin * 60_000;
  const slots = [];

  for (const [ws, we] of windows) {
    const winStart = zonedToUtc(dateStr, ws, tz).getTime();
    const winEnd = zonedToUtc(dateStr, we, tz).getTime();

    console.log(`Window: ${ws} to ${we}`);
    console.log(`winStart ms: ${winStart}, winEnd ms: ${winEnd}`);
    console.log(`Duration ms: ${durMs}`);

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

const slots = testComputeSlots({
  dateStr: '2026-07-26',
  tz: 'Europe/Rome',
  hours: {
    isClosed: false,
    open: '09:00:00',
    close: '14:00:00',
    breakStart: null,
    breakEnd: null
  },
  durationMin: 180, // 3 hours
  stepMin: 30,
  busy: [],
  nowMs: 0,
  leadMin: 0
});

console.log('Generated slots:', slots);
