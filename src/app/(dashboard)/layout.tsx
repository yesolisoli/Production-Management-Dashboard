import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardUserProvider } from "@/components/layout/dashboard-user-context";
import { AUTH_ENABLED } from "@/lib/config";
import { DEFAULT_ROLE, type Role } from "@/lib/permissions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let userEmail = "";
  let role: Role | null = null;

  if (AUTH_ENABLED) {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    userEmail = user.email ?? "";

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    role = (profile?.role as Role | undefined) ?? DEFAULT_ROLE;
  }

  return (
    <div className="h-screen overflow-hidden bg-white">
      <div className="flex h-full flex-col md:flex-row">
        <DashboardUserProvider userEmail={userEmail} role={role}>
          <AppSidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <main className="min-h-0 flex-1 overflow-auto">{children}</main>
          </div>
        </DashboardUserProvider>
      </div>
    </div>
  );
}
