"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Hide the drag handle (e.g. non-dismissible flows). */
  dismissible?: boolean;
}

/**
 * Bottom sheet, Apple-style:
 *  - translucent material with a scrim behind (dim to focus)
 *  - enters and exits along the same path (up from / down to the bottom)
 *  - drag down to dismiss with 1:1 tracking, velocity projection on release,
 *    and rubber-banding when dragged upward past the top
 *  - reduced-motion → plain cross-fade
 */
export function Sheet({
  open,
  onClose,
  children,
  title,
  dismissible = true,
}: SheetProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div
            className="absolute inset-0"
            style={{ background: "var(--scrim)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="material pb-safe relative w-full max-w-[520px] rounded-t-[var(--r-xl)]"
            style={{ boxShadow: "var(--shadow-sheet)" }}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={spring.sheet}
            drag={reduce || !dismissible ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              // Project where the throw is heading, then decide (velocity sign + distance).
              const projected = info.offset.y + info.velocity.y * 0.2;
              if (projected > 130) onClose();
            }}
          >
            {dismissible && (
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="h-[5px] w-10 rounded-full bg-[var(--ink-3)] opacity-50" />
              </div>
            )}
            {title && (
              <h2 className="text-headline px-5 pt-1 pb-2 text-center">
                {title}
              </h2>
            )}
            <div className="px-5 pt-1 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
