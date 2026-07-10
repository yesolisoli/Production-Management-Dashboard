import { ProductionPlannerClient } from "@/features/orders-allocation/components/production-planner-client";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function ProductionPlannerPage() {
  await requireRouteAccess("production-planner");

  return (
    <div className="flex min-h-full flex-col">
      <ProductionPlannerClient />
    </div>
  );
}
