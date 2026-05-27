import { AppHeader } from "@/components/layout/app-header";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function HogIntakePage() {
  await requireRouteAccess("hog-intake");


  return (
    <div className="flex min-h-full flex-col">
      <AppHeader eyebrow="Operations Module" title="Hog Intake" />

      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Hog Intake</h2>
          <p className="mt-2 text-slate-600">Coming soon.</p>
        </div>
      </div>
    </div>
  );
}
