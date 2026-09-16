"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Show the drag handle and allow swipe dismissal. Close/Escape remain available. */
  dismissible?: boolean;
}

/** A centered desktop dialog and mobile sheet with one scrollable, readable surface. */
export function Sheet({ open, onClose, children, title, dismissible = true }: SheetProps) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panel.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab" || !panel.current) return;
      const elements = [...panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  return <AnimatePresence>
    {open && <div className="app-sheet-overlay fixed inset-0 z-[60] flex justify-center">
      <motion.div className="absolute inset-0" style={{ background: "var(--scrim)" }}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0 : 0.18 }} onClick={onClose} />
      <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={title ?? "Dettagli"} tabIndex={-1}
        className="app-sheet-panel material relative w-full" style={{ boxShadow: "var(--shadow-sheet)" }}
        initial={{ opacity: 0, y: reduce ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : 24 }}
        transition={{ duration: reduce ? 0 : 0.22, ease: [0.23, 1, 0.32, 1] }}
        drag={reduce || !dismissible ? false : "y"} dragControls={controls} dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.02, bottom: 0.5 }}
        onDragEnd={(_, info) => { if (info.offset.y + info.velocity.y * 0.15 > 120) onClose(); }}>
        {dismissible && <div aria-hidden="true" className="flex justify-center pt-3 pb-1 touch-none" onPointerDown={event => controls.start(event)}><div className="h-1 w-10 rounded-full bg-[var(--ink-3)] opacity-40" /></div>}
        <div className="app-sheet-header">
          {title && <h2>{title}</h2>}
          <button className="app-sheet-close" type="button" aria-label="Chiudi" onClick={onClose}>
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div className="app-sheet-body">{children}</div>
      </motion.div>
    </div>}
  </AnimatePresence>;
}
