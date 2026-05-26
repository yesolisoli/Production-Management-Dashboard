import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_ENABLED } from "@/lib/config";
import {
  canAccessRoute,
  defaultPathForRole,
  DEFAULT_ROLE,
  pathnameToRouteKey,
  type Role,
} from "@/lib/permissions";

export async function proxy(request: NextRequest) {
  if (!AUTH_ENABLED) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  const isAuthCallback = pathname.startsWith("/auth/callback");

  if (!user && !isLoginPage && !isAuthCallback) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && !isLoginPage && !isAuthCallback) {
    const routeKey = pathnameToRouteKey(pathname);
    if (routeKey) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const role: Role = (profile?.role as Role | undefined) ?? DEFAULT_ROLE;
      if (!canAccessRoute(role, routeKey)) {
        return NextResponse.redirect(
          new URL(defaultPathForRole(role), request.url)
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
