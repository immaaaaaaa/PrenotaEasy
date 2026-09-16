"use client";

// Adapted from ddoemonn's Text Reveal, retrieved through the 21st MCP.
// https://21st.dev/@ddoemonn/components/text-reveal
import { Fragment, useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

const EASE = [0.23, 1, 0.32, 1] as const;

export function TextReveal({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reducedMotion = useReducedMotion();
  const words = text.trim().split(/\s+/);
  const step = Math.min(0.055, 0.7 / Math.max(1, words.length - 1));

  return (
    <span ref={ref} className={`text-reveal ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, index) => (
          <Fragment key={`${index}-${word}`}>
            {index > 0 ? " " : null}
            <motion.span
              className="reveal-word"
              initial={false}
              animate={
                inView && !reducedMotion
                  ? {
                      opacity: [0.08, 1],
                      transform: ["translateY(12px)", "translateY(0px)"],
                      filter: ["blur(6px)", "blur(0px)"],
                    }
                  : {
                      opacity: 1,
                      transform: "translateY(0px)",
                      filter: "blur(0px)",
                    }
              }
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 0.65, ease: EASE, delay: delay + index * step }
              }
            >
              {word}
            </motion.span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}
