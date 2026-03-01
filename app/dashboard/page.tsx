import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUserStreams, getAllStreams } from "@/lib/docs/streams";
import Navbar from "@/components/layout/Navbar";
import StreamCard from "@/components/dashboard/StreamCard";
import { CsrfProvider } from "@/components/providers/CsrfProvider";
import AdminStreamPanel from "@/components/dashboard/AdminStreamPanel";

interface DashboardPageProps {
  searchParams: Promise<{ error?: string }>;
}

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { error } = await searchParams;

  const isAdmin = session.role === "admin";
  const streams = isAdmin
    ? await getAllStreams()
    : await getUserStreams(session.teams);

  // Auto-redirect single-team non-admin users
  if (!isAdmin && streams.length === 1) {
    redirect(`/docs/${streams[0].slug}`);
  }

  return (
    <CsrfProvider>
      <Navbar username={session.username} role={session.role} />

      <main className="dashboard-root">
        <header className="dashboard-header">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <h1>Welcome back, {session.username} 👋</h1>
              <p>
                {isAdmin
                  ? "Admin view — manage all streams and access."
                  : "Select a documentation stream to get started."}
              </p>
            </div>
            {isAdmin && <AdminStreamPanel />}
          </div>

          {error === "forbidden" && (
            <div className="dashboard-forbidden" role="alert">
              You don&apos;t have access to that documentation stream.
            </div>
          )}
        </header>

        {streams.length === 0 ? (
          <div className="dashboard-empty">
            <p>No documentation streams found.</p>
            {isAdmin && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                Create your first stream using the button above.
              </p>
            )}
            {!isAdmin && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                Contact an admin to be added to a team.
              </p>
            )}
          </div>
        ) : (
          <div className="dashboard-grid">
            {streams.map((stream, i) => (
              <StreamCard
                key={stream.slug}
                stream={stream}
                index={i}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </main>
    </CsrfProvider>
  );
}
