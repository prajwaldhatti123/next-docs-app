import Link from "next/link";
import LogoutButton from "./LogoutButton";
import type { StreamMeta } from "@/lib/docs/streams";
import type { UserRole } from "@/lib/auth/users";

interface NavbarProps {
  username: string;
  stream?: StreamMeta | null;
  role?: UserRole;
}

const ROLE_BADGE: Record<UserRole, { label: string; color: string }> = {
  reader: { label: "Reader", color: "#6B7280" },
  writer: { label: "Writer", color: "var(--c-sales)" },
  admin: { label: "Admin", color: "var(--c-marketing)" },
};

export default function Navbar({ username, stream, role }: NavbarProps) {
  const badge = role ? ROLE_BADGE[role] : null;

  return (
    <nav className="navbar" aria-label="Main navigation">
      <Link href="/dashboard" className="navbar-brand">
        <span className="navbar-brand-icon">📚</span>
        Docs
      </Link>

      {stream && (
        <>
          <span className="navbar-sep" aria-hidden="true" />
          <div className="navbar-breadcrumb">
            <Link href="/dashboard">Dashboard</Link>
            <span aria-hidden="true">›</span>
            <span className="active">{stream.label}</span>
          </div>
        </>
      )}

      {!stream && <div style={{ flex: 1 }} />}

      <div className="navbar-right">
        {badge && (
          <span
            className="navbar-role-badge"
            style={{ color: badge.color, borderColor: badge.color }}
          >
            {badge.label}
          </span>
        )}
        <span className="navbar-user" title={`Logged in as ${username}`}>
          {username}
        </span>
        <LogoutButton />
      </div>
    </nav>
  );
}
