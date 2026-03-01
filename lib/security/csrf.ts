/**
 * lib/security/csrf.ts
 * Double-submit cookie CSRF protection.
 *
 * Flow:
 * 1. Client fetches GET /api/csrf → receives token in JSON + cookie
 * 2. Client sends token in X-CSRF-Token header on mutating requests
 * 3. Server validates: header token === cookie token (constant-time)
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

function getCsrfSecret(): string {
  const secret = process.env.CSRF_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CSRF_SECRET must be set and at least 32 characters.");
  }
  return secret;
}

/**
 * Generate a random 32-byte hex CSRF token.
 * Uses the CSRF_SECRET as a prefix to bind it to this deployment.
 */
export function generateCsrfToken(): string {
  const prefix = getCsrfSecret().slice(0, 8);
  const random = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `${prefix}${random}`;
}

/**
 * Set CSRF token in a cookie and return the token.
 * Cookie is NOT HttpOnly (must be readable by JS for the double-submit pattern).
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // intentional: client reads this to send in header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 3600, // 1 hour
    path: "/",
  });
}

/**
 * Validate CSRF: compare X-CSRF-Token header vs csrf_token cookie.
 * Uses constant-time comparison to prevent timing attacks.
 * Returns true if valid.
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;

  if (!headerToken || !cookieToken) return false;

  // Ensure same length before Buffer comparison
  if (headerToken.length !== cookieToken.length) return false;

  try {
    const a = Buffer.from(headerToken, "utf8");
    const b = Buffer.from(cookieToken, "utf8");
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Extract the CSRF cookie value from a request (used in middleware).
 */
export function getCsrfTokenFromRequest(
  request: NextRequest,
): string | undefined {
  return request.cookies.get(CSRF_COOKIE)?.value;
}
