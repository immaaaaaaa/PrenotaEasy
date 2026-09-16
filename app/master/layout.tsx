import { redirect } from "next/navigation";
import { getSessionBusiness, isMaster } from "@/lib/auth";
import "@/app/management-design.css";

export const dynamic = "force-dynamic";

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getSessionBusiness();
  if (!user || !isMaster(user)) {
    redirect("/login");
  }

  return (
    <div className="management-layout">
      {children}
    </div>
  );
}
