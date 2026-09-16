import { Spinner } from "@/components/ui/Spinner";
export default function DashboardLoading() {
  return <div className="app-loading" role="status"><Spinner className="h-8 w-8" /><p>Prepariamo la tua agenda.</p></div>;
}
