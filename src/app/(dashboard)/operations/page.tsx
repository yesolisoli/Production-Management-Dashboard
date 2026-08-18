import { OperationsDashboardClient } from "@/features/operations-dashboard/components/operations-dashboard-client";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function OperationsPage() {
  await requireRouteAccess("operations");
  return (
    <div className="flex min-h-full flex-col">
      <OperationsDashboardClient />
    </div>
  );
}
