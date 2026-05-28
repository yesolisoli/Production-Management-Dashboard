import { AppHeader } from "@/components/layout/app-header";
import { HogIntakeClient } from "@/features/hog-intake/components/hog-intake-client";
import { requireRouteAccess } from "@/lib/route-guard";

export default async function HogIntakePage() {
  await requireRouteAccess("hog-intake");

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader eyebrow="Operations Module" title="Hog Intake" />
      <HogIntakeClient />
    </div>
  );
}
