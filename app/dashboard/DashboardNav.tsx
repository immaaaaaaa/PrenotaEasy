"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/dashboard", label: "Agenda", icon: CalendarIcon },
  { href: "/dashboard/share", label: "Condividi", icon: QrIcon },
  { href: "/dashboard/settings", label: "Impostazioni", icon: GearIcon },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="material pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)]">
      <div className="mx-auto flex max-w-[720px] items-stretch">
        {TABS.map((t) => {
          const active =
            t.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[0.7rem] font-[540] transition-colors",
                active ? "text-[var(--accent)]" : "text-[var(--ink-3)]",
              )}
            >
              <Icon active={active} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.1 : 1.8} stroke="currentColor">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" strokeLinecap="round" />
    </svg>
  );
}
function QrIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.1 : 1.8} stroke="currentColor">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <path d="M13.5 13.5h3v3M20.5 13.5v3M20.5 20.5h-4M16.5 20.5v0" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.1 : 1.8} stroke="currentColor">
      <circle cx="12" cy="12" r="3.2" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
