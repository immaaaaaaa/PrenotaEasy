"use client";
import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app/AppChrome";

export function DashboardNav() {
  const pathname = usePathname();
  return <AppNav items={[
    { href: "/dashboard", label: "Oggi", icon: "grid_view", active: pathname === "/dashboard" },
    { href: "/dashboard?tab=calendar", label: "Agenda", icon: "calendar_month" },
    { href: "/dashboard/share", label: "Condividi", icon: "qr_code", active: pathname === "/dashboard/share" },
    { href: "/dashboard/settings", label: "Studio", icon: "tune", active: pathname.startsWith("/dashboard/settings") },
  ]} />;
}
