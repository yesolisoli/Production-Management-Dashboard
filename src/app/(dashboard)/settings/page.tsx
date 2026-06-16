import { AppHeader } from "@/components/layout/app-header";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function SettingsPage() {
  await requireRouteAccess("settings");


  return (
    <div className="flex min-h-full flex-col">
      <AppHeader eyebrow="System Module" title="Settings" />

      <div className="p-4 sm:p-6">
        <div className="rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold sm:text-2xl">Settings</h2>
          <p className="mt-2 text-slate-600">Coming soon.</p>
        </div>
      </div>
    </div>
  );
}
