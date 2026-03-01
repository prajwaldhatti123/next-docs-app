import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getStreamMeta } from "@/lib/docs/streams";
import { getSidebar, getFirstDoc } from "@/lib/docs/sidebar";

interface StreamPageProps {
  params: Promise<{ stream: string }>;
}

export default async function StreamIndexPage({ params }: StreamPageProps) {
  const { stream } = await params;

  // Defence in depth: verify session
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && !session.teams.includes(stream))
    redirect("/dashboard?error=forbidden");

  const meta = await getStreamMeta(stream);
  if (!meta) notFound();

  const sidebar = await getSidebar(stream);
  const firstDoc = getFirstDoc(sidebar);

  if (firstDoc) {
    // Redirect to the first document in this stream
    redirect(`/docs/${firstDoc.slug}`);
  }

  // No docs yet
  return (
    <div
      style={{
        padding: "4rem 2rem",
        textAlign: "center",
        color: "var(--text-3)",
      }}
    >
      <p style={{ fontSize: "2rem", marginBottom: "1rem" }}>{meta.icon}</p>
      <h1 style={{ color: "var(--text-1)", marginBottom: "0.5rem" }}>
        {meta.label}
      </h1>
      <p>No documentation has been added to this stream yet.</p>
    </div>
  );
}
