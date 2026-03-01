import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { getStreamMeta } from "@/lib/docs/streams";
import { getSidebar } from "@/lib/docs/sidebar";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import { CsrfProvider } from "@/components/providers/CsrfProvider";

interface StreamLayoutProps {
  params: Promise<{ stream: string }>;
  children: ReactNode;
}

/**
 * Stream layout — wraps ALL docs pages for a stream.
 * Navbar and Sidebar live here so they PERSIST across doc navigation,
 * preserving sidebar open/close state without reset.
 */
export default async function StreamLayout({
  params,
  children,
}: StreamLayoutProps) {
  const { stream } = await params;

  const session = await getSession();
  if (!session) redirect("/login");

  // Admins can access any stream; others must have the stream in their teams
  if (session.role !== "admin" && !session.teams.includes(stream)) {
    redirect("/dashboard?error=forbidden");
  }

  const streamMeta = await getStreamMeta(stream);
  if (!streamMeta) redirect("/dashboard");

  const sidebar = await getSidebar(stream);

  const canWrite =
    session.role === "admin" ||
    (session.role === "writer" && session.teams.includes(stream));

  return (
    <CsrfProvider>
      <Navbar
        username={session.username}
        stream={streamMeta}
        role={session.role}
      />

      <div className="docs-root">
        <Sidebar
          items={sidebar}
          stream={streamMeta.label}
          canWrite={canWrite}
          currentStream={stream}
        />

        {/* Page content (MDX + TOC) rendered here */}
        {children}
      </div>
    </CsrfProvider>
  );
}
