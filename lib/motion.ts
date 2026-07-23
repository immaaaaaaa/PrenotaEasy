/**
 * Spring presets mapped from the values Apple ships (damping ratio + response)
 * to Motion's { bounce, duration } API.
 *   damping 1.0 (critically damped) → bounce 0
 *   under-damped, momentum feel     → bounce ~0.2–0.3
 * Reserve bounce for interactions a gesture/flick preceded; default is calm.
 */
export const spring = {
  /** Default UI move/reposition — no overshoot. */
  default: { type: "spring", bounce: 0, duration: 0.4 },
  /** Snappier default for small elements. */
  snappy: { type: "spring", bounce: 0, duration: 0.26 },
  /** Sheets / drawers — a hair of overshoot as they settle. */
  sheet: { type: "spring", bounce: 0.12, duration: 0.5 },
  /** Momentum-driven, physical — a flick that lands with a little bounce. */
  bouncy: { type: "spring", bounce: 0.26, duration: 0.5 },
} as const;

/** Horizontal step transition for wizard/booking flows. */
export const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 28 : -28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -28 : 28, opacity: 0 }),
};
