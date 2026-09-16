"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { LandingGlass } from "@/components/landing/LandingGlass";

function AppGlass({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <LandingGlass floating tone="light" className={className}>{children}</LandingGlass>;
}

export function AppHeader({ children, backHref }: { children?: ReactNode; backHref?: string }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const update = () => setCompact(previous => window.scrollY > (previous ? 24 : 72));
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header className="app-topbar" data-compact={compact}>
      <AppGlass className="app-brand-pill">
        <Link href="/" aria-label="PrenotaEasy, pagina iniziale" className="app-brand-link"><Wordmark tagline={null} /></Link>
      </AppGlass>
      {(children || backHref) && <AppGlass className="app-actions-pill">
        <div className="app-header-actions">
          {backHref && <Link href={backHref} className="app-icon-button" aria-label="Torna indietro"><span className="material-symbols-outlined" aria-hidden="true">arrow_back</span></Link>}
          {children}
        </div>
      </AppGlass>}
    </header>
  );
}

export interface AppNavItem {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}
export function AppNav({ items, label = "Navigazione principale" }: { items: AppNavItem[]; label?: string }) {
  return (
    <nav className="app-dock" aria-label={label}>
      <AppGlass>
        <div className="app-dock-items">
          {items.map(item => {
            const content = <><span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><span>{item.label}</span></>;
            return item.href
              ? <Link key={item.label} href={item.href} className="app-dock-item" data-active={item.active} aria-current={item.active ? "page" : undefined}>{content}</Link>
              : <button key={item.label} type="button" onClick={() => {
                item.onClick?.();
                if (!item.active) window.scrollTo({ top: 0, behavior: "instant" });
              }} className="app-dock-item" data-active={item.active} aria-pressed={item.active}>{content}</button>;
          })}
        </div>
      </AppGlass>
    </nav>
  );
}

export function AppPageHeading({ eyebrow, title, description, children }: {
  eyebrow?: string; title: ReactNode; description?: ReactNode; children?: ReactNode;
}) {
  return <div className="app-page-heading">
    <div>{eyebrow && <p className="app-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="app-page-description">{description}</p>}</div>
    {children && <div className="app-page-actions">{children}</div>}
  </div>;
}
