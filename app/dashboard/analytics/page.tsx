import type { Metadata } from "next";
import { getAnalyticsData } from "../actions";
import { AnalyticsView } from "./AnalyticsView";

export const metadata: Metadata = { title: "Analisi e Report - PrenotaEasy" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const stats = await getAnalyticsData();
  return <AnalyticsView stats={stats} />;
}
