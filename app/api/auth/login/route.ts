/**
 * app/api/auth/login/route.ts
 * POST /api/auth/login
 *
 * Security layers:
 * 1. Rate limiting (5 attempts / 15 min / IP)
 * 2. CSRF validation (double-submit cookie)
 * 3. Zod input validation
 * 4. bcrypt password comparison (constant-time)
 * 5. Generic error messages (no info leakage)
 * 6. JWT session signed with teams[] for RBAC
 */

import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rateLimit";
import { getUserRecord } from "@/lib/auth/users";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { validateCsrfToken } from "@/lib/security/csrf";

const GENERIC_ERROR = "Invalid credentials";

const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Username is required")
    .max(64)
    .regex(/^[a-zA-Z0-9_\-\.]+$/, "Invalid username format"),
  password: z.string().min(1, "Password is required").max(256),
});

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const ip = getClientIp(request);

    // 1. Rate limit check
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          retryAfter: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds ?? 900),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    // 2. CSRF validation
    if (!validateCsrfToken(request)) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 403 });
    }

    // 3. Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      // Return generic error — don't leak which field is wrong
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const { username, password } = parsed.data;

    // 4. Look up user (server-only — never leaks to client)
    const user = getUserRecord(username);

    // 5. bcrypt compare — ALWAYS run comparison even if user doesn't exist
    //    to prevent timing attacks that reveal valid usernames
    const dummyHash =
      "$2b$10$abcdefghijklmnopqrstuvuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu";
    const hashToCompare = user?.hash ?? dummyHash;
    const isValid = await compare(password, hashToCompare);

    if (!user || !isValid) {
      // Generic error for both "user not found" and "wrong password"
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    // 6. Reset rate limit on successful login
    resetRateLimit(ip);

    // 7. Sign JWT session with username + teams + role for RBAC
    const token = await signSession({
      username: user.username,
      teams: user.teams,
      role: user.role,
    });

    // 8. Build response with session cookie
    const response = NextResponse.json(
      {
        success: true,
        redirect: "/dashboard",
        username: user.username,
        teams: user.teams,
      },
      { status: 200 },
    );

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    // Never leak internal errors
    console.error("[login] Internal error:", error);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
  }
}

// Block all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
