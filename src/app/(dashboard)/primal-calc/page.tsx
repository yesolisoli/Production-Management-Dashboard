import { PrimalCalculationPage } from "@/features/primal-calculation/components/PrimalCalculationPage";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function PrimalCalcPage() {
  await requireRouteAccess("primal-calc");

  return (
    <div className="flex min-h-full flex-col">
      <PrimalCalculationPage />
    </div>
  );
}
