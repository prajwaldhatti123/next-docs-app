/**
 * app/api/auth/logout/route.ts
 * POST /api/auth/logout
 *
 * Clears the session cookie and redirects to /login.
 * Middleware guards this route — only authenticated users can reach it.
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json(
    { success: true, redirect: "/login" },
    { status: 200 },
  );
  clearSessionCookie(response);
  return response;
}

// Block all other HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
