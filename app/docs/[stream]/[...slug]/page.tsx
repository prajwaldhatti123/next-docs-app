import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { compileMdx, DocNotFoundError } from "@/lib/docs/mdx";
import { extractToc } from "@/lib/docs/toc";
import TableOfContents from "@/components/layout/TableOfContents";
import DocEditor from "@/components/docs/DocEditor";

interface DocsPageProps {
  params: Promise<{ stream: string; slug: string[] }>;
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { stream, slug } = await params;
  try {
    const { frontmatter } = await compileMdx(stream, slug);
    return { title: frontmatter.title, description: frontmatter.description };
  } catch {
    return { title: "Not Found" };
  }
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { stream, slug } = await params;

  // Defence in depth — layout already checked, re-verify in data layer
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && !session.teams.includes(stream)) {
    redirect("/dashboard?error=forbidden");
  }

  let compiled;
  try {
    compiled = await compileMdx(stream, slug);
  } catch (err) {
    if (err instanceof DocNotFoundError) notFound();
    throw err;
  }

  const { content, frontmatter, rawSource } = compiled;
  const toc = extractToc(rawSource);

  const canWrite =
    session.role === "admin" ||
    (session.role === "writer" && session.teams.includes(stream));

  return (
    <>
      <main className="docs-main-wrap" id="main-content">
        {canWrite && (
          <div className="doc-edit-bar">
            <DocEditor
              stream={stream}
              slug={slug}
              initialContent={rawSource}
              title={frontmatter.title}
            />
          </div>
        )}

        <article className="prose">{content}</article>

        <footer className="docs-footer">
          <span>{frontmatter.title}</span>
          <a href="/dashboard">← All streams</a>
        </footer>
      </main>

      <TableOfContents items={toc} />
    </>
  );
}
