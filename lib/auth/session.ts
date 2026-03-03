/**
 * lib/auth/session.ts
 * JWT session management (Edge-compatible via jose).
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { UserRole } from "./users";

const COOKIE_NAME = "docs_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

export interface SessionPayload {
  username: string;
  teams: string[];
  role: UserRole;
}

type SignablePayload = SessionPayload & JWTPayload;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET must be set and at least 32 characters.");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const signable: SignablePayload = { ...payload };
  return new SignJWT(signable)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
  });

  const username = payload["username"];
  const teams = payload["teams"];
  const role = payload["role"];

  if (typeof username !== "string" || !Array.isArray(teams))
    throw new Error("Invalid session payload.");

  return {
    username,
    teams: teams as string[],
    role: (role as UserRole) ?? "reader",
  };
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(Date.now() + SESSION_DURATION_SECONDS * 1000),
    path: "/",
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
    path: "/",
  });
}

export function getTokenFromRequest(request: NextRequest): string | undefined {
  return request.cookies.get(COOKIE_NAME)?.value;
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function canAccessStream(stream: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (session.role === "admin") return true;
  return session.teams.includes(stream.toLowerCase());
}

/** Returns true if user can create/edit docs in the given stream */
export async function canWriteStream(stream: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (session.role === "admin") return true;
  return (
    session.role === "writer" && session.teams.includes(stream.toLowerCase())
  );
}
