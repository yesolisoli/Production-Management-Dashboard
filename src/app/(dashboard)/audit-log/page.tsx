import { AuditLogClient } from "@/features/audit-log/components/audit-log-client";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function AuditLogPage() {
  await requireRouteAccess("audit-log");

  return (
    <div className="flex min-h-full flex-col">
      <AuditLogClient />
    </div>
  );
}
