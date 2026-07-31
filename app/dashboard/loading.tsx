export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center gap-4">
      <img src="/logo.png" alt="" className="h-14 w-14 rounded-2xl object-contain animate-pulse" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-[#E8E4DE]">
        <div className="h-full w-1/3 rounded-full bg-[#4D5A46] animate-[loading-slide_1s_ease-in-out_infinite]" />
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `@keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`,
        }}
      />
    </div>
  );
}
