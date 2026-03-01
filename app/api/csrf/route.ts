/**
 * app/api/csrf/route.ts
 * GET /api/csrf — Issues a CSRF token.
 *
 * IDEMPOTENT: If a valid token already exists in the cookie, we reuse it
 * rather than generating a new one. This prevents the mismatch bug where
 * multiple components each call /api/csrf on mount, the cookie gets
 * overwritten by the second call, but the first call's token is still
 * cached in component state → header ≠ cookie → 403.
 *
 * Token stays stable for the cookie's lifetime (1 hour), just like a
 * traditional CSRF synchronizer token.
 */

import { type NextRequest, NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/security/csrf";

const CSRF_COOKIE = "csrf_token";
const TOKEN_LENGTH = 40; // 8 char prefix + 32 char random hex

function isValidToken(token: string, secret: string): boolean {
  const prefix = secret.slice(0, 8);
  return (
    token.length === TOKEN_LENGTH &&
    token.startsWith(prefix) &&
    /^[0-9a-f]+$/.test(token.slice(8))
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CSRF_SECRET ?? "";

  // Reuse the existing cookie token if it's still valid (idempotent behaviour)
  const existing = request.cookies.get(CSRF_COOKIE)?.value;
  if (existing && isValidToken(existing, secret)) {
    // Return the same token — no new cookie needed, client already has it
    return NextResponse.json({ token: existing }, { status: 200 });
  }

  // Generate a fresh token (first visit, or expired/invalid cookie)
  const token = generateCsrfToken();
  const response = NextResponse.json({ token }, { status: 200 });
  setCsrfCookie(response, token);
  return response;
}

// Block other methods
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
