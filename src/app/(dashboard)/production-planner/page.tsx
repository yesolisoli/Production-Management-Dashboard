import { AppHeader } from "@/components/layout/app-header";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function ProductionPlannerPage() {
  await requireRouteAccess("production-planner");


  return (
    <div className="flex min-h-full flex-col">
      <AppHeader eyebrow="Operations Module" title="Production Planner" />

      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold sm:text-2xl">Production Planner</h2>
          <p className="mt-2 text-slate-600">Coming soon.</p>
        </div>
      </div>
    </div>
  );
}
