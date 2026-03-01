/**
 * proxy.ts — Edge Runtime (Next.js 16 "proxy" convention)
 *
 * ⚠️  SECURITY NOTE (CVE-2025-29927):
 * This proxy is the FIRST line of defence — redirects + RBAC routing.
 * Auth is ALSO enforced inside Server Components (getSession()) and
 * Route Handlers. Never rely on this layer alone.
 *
 * Responsibilities:
 * 1. Apply security headers to ALL responses
 * 2. Protect /dashboard and /docs/[stream]/... — redirect to /login if no session
 * 3. Stream-level RBAC — if user's teams[] exclude the stream → redirect to dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifySession } from "@/lib/auth/session";
import { applySecurityHeaders } from "@/lib/security/headers";

// Paths that require authentication
const PROTECTED_PATHS = ["/dashboard", "/docs"];

// Paths always publicly accessible (no auth check)
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/csrf",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

/**
 * Extract the stream segment from a /docs/[stream]/... path.
 * Returns null if not a stream path.
 */
function extractStream(pathname: string): string | null {
  const match = pathname.match(/^\/docs\/([^/]+)/);
  return match ? match[1] : null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always apply security headers — clone a base response first
  let response = NextResponse.next();

  // Skip middleware logic for Next.js internals and static assets
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|css|js|woff2?)$/)
  ) {
    return applySecurityHeaders(response);
  }

  // Public paths: just apply security headers and let through
  if (isPublicPath(pathname)) {
    return applySecurityHeaders(response);
  }

  // Protected paths: verify session
  if (isProtectedPath(pathname)) {
    const token = getTokenFromRequest(request);

    if (!token) {
      // No session → redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      response = NextResponse.redirect(loginUrl);
      return applySecurityHeaders(response);
    }

    let session;
    try {
      session = await verifySession(token);
    } catch {
      // Expired or tampered token → redirect to login
      const loginUrl = new URL("/login", request.url);
      response = NextResponse.redirect(loginUrl);
      const redirectResponse = applySecurityHeaders(response);
      // Clear the bad cookie
      redirectResponse.cookies.set("docs_session", "", {
        maxAge: 0,
        path: "/",
      });
      return redirectResponse;
    }

    // Stream-level RBAC check for /docs/[stream]/...
    const stream = extractStream(pathname);
    if (stream) {
      const hasAccess = session.teams.includes(stream.toLowerCase());
      if (!hasAccess) {
        // User is authenticated but not authorized for this stream
        // Return 403 JSON for API calls, redirect to dashboard for page nav
        const acceptHeader = request.headers.get("accept") ?? "";
        if (acceptHeader.includes("application/json")) {
          response = NextResponse.json(
            { error: `Access denied to stream: ${stream}` },
            { status: 403 },
          );
        } else {
          // Redirect to dashboard with error hint
          const dashboardUrl = new URL("/dashboard", request.url);
          dashboardUrl.searchParams.set("error", "forbidden");
          response = NextResponse.redirect(dashboardUrl);
        }
        return applySecurityHeaders(response);
      }
    }

    // Attach username and teams to request headers for downstream server components
    response = NextResponse.next({
      request: {
        headers: new Headers({
          ...Object.fromEntries(request.headers.entries()),
          "x-user": session.username,
          "x-user-teams": session.teams.join(","),
        }),
      },
    });

    return applySecurityHeaders(response);
  }

  // Root / → redirect to dashboard (or login if no session)
  if (pathname === "/") {
    const token = getTokenFromRequest(request);
    const target = token ? "/dashboard" : "/login";
    response = NextResponse.redirect(new URL(target, request.url));
    return applySecurityHeaders(response);
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
