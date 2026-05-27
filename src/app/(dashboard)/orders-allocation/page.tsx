import { AppHeader } from "@/components/layout/app-header";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function OrdersAllocationPage() {
  await requireRouteAccess("orders-allocation");


  return (
    <div className="flex min-h-full flex-col">
      <AppHeader eyebrow="Operations Module" title="Orders & Allocation" />

      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold">Orders & Allocation</h2>
          <p className="mt-2 text-slate-600">Coming soon.</p>
        </div>
      </div>
    </div>
  );
}
