import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { AccessPreview } from "./AccessPreview";

export const dynamic = "force-dynamic";

export default async function DevAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  return <AccessPreview view={view ?? "auth"} todayStr={formatInTimeZone(new Date(), "Europe/Rome", "yyyy-MM-dd")} />;
}
