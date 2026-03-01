/**
 * lib/auth/users.ts
 * Parse DOCS_USERS env var — server-side only.
 *
 * Format: username:base64(bcrypt_hash):team1,team2:role
 *         ─────────────────────────────────────────────
 *         role = reader | writer | admin  (default: reader)
 *
 * ⚠️  Base64-encode hashes to avoid $ expansion by @next/env:
 *   node -e "console.log(Buffer.from('<bcrypt_hash>').toString('base64'))"
 *
 * Users separated by |
 */
import "server-only";

export type UserRole = "reader" | "writer" | "admin";

export interface UserRecord {
  username: string;
  hash: string; // decoded bcrypt hash
  teams: string[]; // stream slugs this user can access
  role: UserRole; // access level
}

type UserMap = Map<string, UserRecord>;

let _cachedUsers: UserMap | null = null;

export function getUserMap(): UserMap {
  if (_cachedUsers) return _cachedUsers;

  const raw = process.env.DOCS_USERS ?? "";
  if (!raw) throw new Error("DOCS_USERS environment variable is not set.");

  const map: UserMap = new Map();

  for (const entry of raw.split("|")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Format: username:base64hash:teams[:role]
    // base64 has no ":" so we can split safely on all colons
    const parts = trimmed.split(":");
    if (parts.length < 3) continue;

    const username = parts[0].trim().toLowerCase();
    const hashB64 = parts[1].trim();
    const teamsStr = parts[2].trim();
    const roleRaw = parts[3]?.trim() ?? "reader";

    const teams = teamsStr
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const role: UserRole =
      roleRaw === "writer"
        ? "writer"
        : roleRaw === "admin"
          ? "admin"
          : "reader";

    // Decode base64 → raw bcrypt hash
    let hash: string;
    try {
      const decoded = Buffer.from(hashB64, "base64").toString("utf8");
      hash = decoded.startsWith("$2") ? decoded : hashB64;
    } catch {
      hash = hashB64;
    }

    if (username && hash) {
      map.set(username, { username, hash, teams, role });
    }
  }

  if (map.size === 0) throw new Error("DOCS_USERS has no valid entries.");

  _cachedUsers = map;
  return map;
}

export function getUserRecord(username: string): UserRecord | undefined {
  return getUserMap().get(username.toLowerCase());
}
