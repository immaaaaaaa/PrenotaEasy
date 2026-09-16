import { requireBusiness } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirects to /login or /onboarding when appropriate.
  await requireBusiness();

  return (
    <div className="dashboard-shell">
      {children}
    </div>
  );
}
