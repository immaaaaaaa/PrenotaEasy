"use client";

import { useCallback, useRef, useSyncExternalStore, type ReactNode } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

const CHAPTER_MOTION = "(min-width: 1001px) and (min-height: 680px) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
function useChapterMotion() {
  const subscribe = useCallback((onChange: () => void) => {
    const media = window.matchMedia(CHAPTER_MOTION);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(subscribe, () => window.matchMedia(CHAPTER_MOTION).matches, () => false);
}

export function HeroScene({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const enabled = useChapterMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  const radius = useTransform(scrollYProgress, [0, 0.8], [48, 110]);
  return (
    <motion.section ref={ref} className="hero" data-dark-backdrop aria-labelledby="hero-title"
      style={enabled ? { scale, borderRadius: radius } : undefined}>
      {children}
    </motion.section>
  );
}

function ManifestoWord({ word, index, total, progress, enabled }: {
  word: string; index: number; total: number; progress: MotionValue<number>; enabled: boolean;
}) {
  const opacity = useTransform(progress, [index / total * 0.8, (index + 1) / total * 0.8], [0.28, 1]);
  return <motion.span style={enabled ? { opacity } : undefined}>{word} </motion.span>;
}

export function ScrollManifesto() {
  const ref = useRef<HTMLElement>(null);
  const enabled = useChapterMotion();
  const text = "Tu pensa alla bellezza. Al resto, diamo ordine.";
  const words = text.split(" ");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  return (
    <section ref={ref} className="manifesto landing-container" aria-labelledby="manifesto-title">
      <span className="eyebrow">UN ALTRO RITMO</span>
      <h2 id="manifesto-title">
        <span className="sr-only">{text}</span>
        <span aria-hidden="true">{words.map((word, index) => (
          <ManifestoWord key={index} word={word} index={index} total={words.length} progress={scrollYProgress} enabled={enabled} />
        ))}</span>
      </h2>
    </section>
  );
}

/** One native-scroll sequence. Small screens and reduced motion stay in document flow. */
export function CapsuleStory({ booking, agenda, care }: { booking: ReactNode; agenda: ReactNode; care: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const enabled = useChapterMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const firstScale = useTransform(scrollYProgress, [0, 0.2, 0.34, 0.54], [0.68, 1, 1, 0.94]);
  const firstOpacity = useTransform(scrollYProgress, [0.34, 0.56], [1, 0.55]);
  const detailOpacity = useTransform(scrollYProgress, [0.08, 0.19], [0, 1]);
  const secondY = useTransform(scrollYProgress, [0.3, 0.53], ["110%", "0%"]);
  const secondScale = useTransform(scrollYProgress, [0.66, 0.87], [1, 0.94]);
  const secondOpacity = useTransform(scrollYProgress, [0.67, 0.89], [1, 0.55]);
  const thirdY = useTransform(scrollYProgress, [0.65, 0.88], ["110%", "0%"]);
  return (
    <section ref={ref} id="funzionalita" className="capsule-story" data-motion={enabled} aria-label="Dalla prenotazione al tuo prossimo cliente">
      <div className="capsule-stage">
        <motion.article className="story-scene story-booking" style={enabled ? { scale: firstScale, opacity: firstOpacity } : undefined}>
          <div className="story-copy"><motion.span className="eyebrow" style={enabled ? { opacity: detailOpacity } : undefined}>PRENOTAZIONI</motion.span><h2>Prenotano.<br /><span>Quando vogliono.</span></h2><motion.p style={enabled ? { opacity: detailOpacity } : undefined}>Un link. Nessuna app.</motion.p></div>
          <motion.div className="story-visual" style={enabled ? { opacity: detailOpacity } : undefined}>{booking}</motion.div>
        </motion.article>
        <motion.article className="story-scene story-agenda" style={enabled ? { y: secondY, scale: secondScale, opacity: secondOpacity } : undefined}>
          <div className="story-copy"><span className="eyebrow">AGENDA & TEAM</span><h2>Tutto.<br /><span>Al suo posto.</span></h2><p>Ogni cliente. Ogni collaboratore.</p></div>
          <div className="story-visual">{agenda}</div>
        </motion.article>
        <motion.article className="story-scene story-care" data-dark-backdrop style={enabled ? { y: thirdY } : undefined}>
          {care}
          <div className="story-copy"><span className="eyebrow">IL TUO TALENTO</span><h2>Più tempo.<br /><span>Per ciò che ami.</span></h2></div>
        </motion.article>
      </div>
    </section>
  );
}
