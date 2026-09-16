import { notFound } from "next/navigation";
import { ManagementPreview } from "./ManagementPreview";

export const dynamic = "force-dynamic";

export default async function DevManagementPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; empty?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view, empty } = await searchParams;
  return <ManagementPreview view={view ?? "master"} empty={empty === "1"} />;
}
