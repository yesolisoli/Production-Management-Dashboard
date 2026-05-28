import { AppHeader } from "@/components/layout/app-header";
import { DailyLineupDashboard } from "@/features/daily-lineup/components/daily-lineup-dashboard";
import { requireRouteAccess } from "@/lib/route-guard";
import { DailyLineupHeaderActions } from "./header-actions";

export default async function DailyLineupPage() {
  await requireRouteAccess("daily-lineup");

  return (
    <div className="flex h-full min-h-full flex-col">
      <AppHeader
        eyebrow="Dashboard"
        title="Daily Lineup"
        actions={<DailyLineupHeaderActions />}
      />

      <div className="min-h-0 flex-1 overflow-auto p-6">
        <DailyLineupDashboard />
      </div>
    </div>
  );
}
