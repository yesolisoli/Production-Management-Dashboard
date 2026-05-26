"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/permissions";

// role is null when AUTH_ENABLED=false (prototype mode). Consumers
// treat null as "no gating" — show everything.
type DashboardUser = {
  email: string;
  role: Role | null;
};

const DashboardUserContext = createContext<DashboardUser>({
  email: "",
  role: null,
});

type DashboardUserProviderProps = {
  children: React.ReactNode;
  userEmail: string;
  role: Role | null;
};

export function DashboardUserProvider({
  children,
  userEmail,
  role,
}: DashboardUserProviderProps) {
  return (
    <DashboardUserContext.Provider value={{ email: userEmail, role }}>
      {children}
    </DashboardUserContext.Provider>
  );
}

export function useDashboardUser() {
  return useContext(DashboardUserContext);
}

export function useDashboardUserEmail() {
  return useContext(DashboardUserContext).email;
}
