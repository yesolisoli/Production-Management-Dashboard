// Shown instantly during navigation between dashboard routes while the
// target segment compiles (dev) / streams in (prod). Gives immediate
// visual feedback so menu clicks never feel frozen. Mirrors the common
// page shape: dark AppHeader bar + a grid of content cards, each filled
// with shimmering placeholder rows so it reads as actively loading.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <div className="skeleton-shimmer skeleton-shimmer-dark sticky top-0 z-20 flex items-center justify-between border-b border-slate-700 bg-[linear-gradient(135deg,#0f172a_0%,#111827_68%,#0b1220_100%)] px-6 py-4">
        <div>
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="mt-2 h-6 w-48 rounded bg-white/15" />
        </div>
        <div className="flex items-center gap-2 text-white/60">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-shimmer flex h-40 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 rounded bg-slate-200" />
                  <div className="h-3 w-1/3 rounded bg-slate-100" />
                </div>
              </div>
              <div className="mt-1 space-y-2">
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-3 w-5/6 rounded bg-slate-100" />
                <div className="h-3 w-4/6 rounded bg-slate-100" />
              </div>
              <div className="mt-auto flex gap-2">
                <div className="h-6 w-16 rounded-full bg-slate-200" />
                <div className="h-6 w-12 rounded-full bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
