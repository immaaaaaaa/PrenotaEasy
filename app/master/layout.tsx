import { redirect } from "next/navigation";
import { getSessionBusiness, isMaster } from "@/lib/auth";

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
    <div className="mx-auto min-h-[100dvh] max-w-[800px] px-4 py-8">
      {children}
    </div>
  );
}
