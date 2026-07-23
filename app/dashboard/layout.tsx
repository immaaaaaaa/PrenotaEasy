import { requireBusiness } from "@/lib/auth";
import { DashboardNav } from "./DashboardNav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login or /onboarding when appropriate.
  await requireBusiness();

  return (
    <div className="mx-auto min-h-[100dvh] max-w-[720px] pb-[76px] bg-[#FAF8F5]">
      {children}
    </div>
  );
}
