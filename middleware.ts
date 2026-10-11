import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = [
  "/access",
  "/company",
  "/dashboard",
  "/directory",
  "/documents-and-policies",
  "/documents",
  "/early-employment",
  "/employees",
  "/home",
  "/leaves",
  "/manager",
  "/me",
  "/onboarding",
  "/org-chart",
  "/people",
  "/performance",
  "/policies",
  "/reports",
  "/setup",
] as const;
const PUBLIC_PATHS = ["/admin/login"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path);
}

function redirectToAuth(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("AUTH_MIDDLEWARE_ENV_MISSING", {
      pathname,
      has_supabase_url: Boolean(supabaseUrl),
      has_supabase_anon_key: Boolean(supabaseAnonKey),
    });
    return redirectToAuth(request);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response = NextResponse.next({ request });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToAuth(request);
  }

  return response;
}

export const config = {
  matcher: [
    "/access/:path*",
    "/access",
    "/company/:path*",
    "/company",
    "/dashboard/:path*",
    "/directory/:path*",
    "/directory",
    "/documents-and-policies/:path*",
    "/documents-and-policies",
    "/documents/:path*",
    "/documents",
    "/early-employment/:path*",
    "/early-employment",
    "/employees/:path*",
    "/home/:path*",
    "/home",
    "/leaves/:path*",
    "/manager/:path*",
    "/manager",
    "/me/:path*",
    "/me",
    "/onboarding/:path*",
    "/org-chart/:path*",
    "/org-chart",
    "/people/:path*",
    "/performance/:path*",
    "/performance",
    "/policies/:path*",
    "/policies",
    "/reports/:path*",
    "/reports",
    "/setup/:path*",
    "/setup",
    "/admin/login",
  ],
};
