import type { Metadata } from "next";
import { getActivities } from "./actions";
import { MasterView } from "./MasterView";

export const metadata: Metadata = { title: "Pannello Master — PrenotaEasy" };
export const dynamic = "force-dynamic";

export default async function MasterPage() {
  const activities = await getActivities();

  return <MasterView initialActivities={activities} />;
}
