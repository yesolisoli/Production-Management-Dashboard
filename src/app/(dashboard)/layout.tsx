import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardUserProvider } from "@/components/layout/dashboard-user-context";
import { AUTH_ENABLED } from "@/lib/config";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail = "";

  if (AUTH_ENABLED) {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userEmail = user.email ?? "";
  }
  
  return (
    <div className="h-screen overflow-hidden bg-white">
      <div className="flex h-full">
        <AppSidebar />
        <DashboardUserProvider userEmail={userEmail}>
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            <main className="min-h-0 flex-1 overflow-auto">{children}</main>
          </div>
        </DashboardUserProvider>
      </div>
    </div>
  );
}
