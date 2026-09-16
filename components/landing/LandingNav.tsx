"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMotionValueEvent, useScroll } from "motion/react";
import { Wordmark } from "@/components/Wordmark";
import { LandingGlass } from "./LandingGlass";
import { Icon } from "./LandingIcon";

function RollingLabel({ children }: { children: string }) {
  return (
    <span className="nav-rolling-label">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}

export function LandingNav() {
  const [compact, setCompact] = useState(false);
  const [dark, setDark] = useState(true);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (position) => {
    // Hysteresis keeps the pills from bouncing at the collapse threshold.
    setCompact((previous) => (previous ? position > 28 : position > 88));
  });

  useEffect(() => {
    setCompact(window.scrollY > 88);
    const sections = document.querySelectorAll(".landing [data-dark-backdrop]");
    let observer: IntersectionObserver;
    const observe = () => {
      observer?.disconnect();
      const visible = new Set<Element>();
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setDark(visible.size > 0);
      }, { rootMargin: `-16px 0px -${Math.max(0, window.innerHeight - 92)}px 0px` });
      sections.forEach((section) => observer.observe(section));
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, []);

  return (
    <header className="split-nav" data-compact={compact} data-tone={dark ? "dark" : "light"}>
      <LandingGlass className="nav-logo-pill" floating tone={dark ? "dark" : "light"}>
        <a href="#main" className="nav-brand" aria-label="PrenotaEasy, torna all’inizio">
          <Wordmark tagline={null} />
        </a>
      </LandingGlass>
      <LandingGlass className="nav-action-pill" floating tone={dark ? "dark" : "light"}>
        <nav className="nav-pill-actions" aria-label="Accesso e demo">
          <Link href="/login" className="nav-signin">
            <RollingLabel>Accedi</RollingLabel>
            <Icon name="arrow" size={20} />
          </Link>
          <a href="#demo" className="nav-demo">
            <RollingLabel>Prova la demo</RollingLabel>
            <span className="nav-demo-arrow"><Icon name="arrow" size={20} /></span>
          </a>
        </nav>
      </LandingGlass>
    </header>
  );
}
