import { OrdersAllocationClient } from "@/features/orders-allocation/components/orders-allocation-client";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function OrdersAllocationPage() {
  await requireRouteAccess("orders-allocation");

  return (
    <div className="flex min-h-full flex-col">
      <OrdersAllocationClient />
    </div>
  );
}
