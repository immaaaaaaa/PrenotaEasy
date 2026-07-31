import { CalendarLogo } from "@/components/CalendarLogo";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-4">
      <CalendarLogo size={56} className="animate-pulse" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div className="h-full w-1/3 rounded-full bg-[var(--accent)] animate-[loading-slide_1s_ease-in-out_infinite]" />
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`,
        }}
      />
    </div>
  );
}
