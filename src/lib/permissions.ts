// Central permission source for the role-aware frontend.
// RLS is intentionally not enabled yet — this file gates UI and routes only.

export type Role = "admin" | "supervisor" | "production_planner" | "basic";

export const DEFAULT_ROLE: Role = "basic";

export type RouteKey =
  | "home"
  | "assignment-board"
  | "hog-intake"
  | "primal-calc"
  | "orders-allocation"
  | "production-planner"
  | "settings"
  | "history"
  | "tv-display";

// Access matrix.
//   admin              — everything
//   supervisor         — home, assignment-board, history, tv-display
//   production_planner — everything except assignment-board
//   basic              — history only
const ROLE_ROUTES: Record<Role, ReadonlyArray<RouteKey>> = {
  admin: [
    "home",
    "assignment-board",
    "hog-intake",
    "primal-calc",
    "orders-allocation",
    "production-planner",
    "settings",
    "history",
    "tv-display",
  ],
  supervisor: ["home", "assignment-board", "history", "tv-display"],
  production_planner: [
    "home",
    "hog-intake",
    "primal-calc",
    "orders-allocation",
    "production-planner",
    "settings",
    "history",
    "tv-display",
  ],
  basic: ["history"],
};

// Landing path per role — used when redirecting away from a disallowed
// route. Must always be a route the role can access (otherwise the
// middleware would loop).
const ROLE_DEFAULT_PATH: Record<Role, string> = {
  admin: "/",
  supervisor: "/",
  production_planner: "/",
  basic: "/history",
};

export function canAccessRoute(role: Role, routeKey: RouteKey): boolean {
  return ROLE_ROUTES[role].includes(routeKey);
}

export function defaultPathForRole(role: Role): string {
  return ROLE_DEFAULT_PATH[role];
}

const PATH_TO_ROUTE_KEY: ReadonlyArray<{ pattern: RegExp; key: RouteKey }> = [
  { pattern: /^\/$/, key: "home" },
  { pattern: /^\/assignment-board(?:\/|$)/, key: "assignment-board" },
  { pattern: /^\/hog-intake(?:\/|$)/, key: "hog-intake" },
  { pattern: /^\/primal-calc(?:\/|$)/, key: "primal-calc" },
  { pattern: /^\/orders-allocation(?:\/|$)/, key: "orders-allocation" },
  { pattern: /^\/production-planner(?:\/|$)/, key: "production-planner" },
  { pattern: /^\/settings(?:\/|$)/, key: "settings" },
  { pattern: /^\/history(?:\/|$)/, key: "history" },
  { pattern: /^\/tv-display(?:\/|$)/, key: "tv-display" },
];

export function pathnameToRouteKey(pathname: string): RouteKey | null {
  for (const { pattern, key } of PATH_TO_ROUTE_KEY) {
    if (pattern.test(pathname)) return key;
  }
  return null;
}
