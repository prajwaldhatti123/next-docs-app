import { redirect, notFound } from "next/navigation";
import matter from "gray-matter";
import { getSession } from "@/lib/auth/session";
import { getDocRaw, compileMdxFromRaw } from "@/lib/docs/mdx";
import { extractToc } from "@/lib/docs/toc";
import TableOfContents from "@/components/layout/TableOfContents";
import DocEditor from "@/components/docs/DocEditor";
import ExportButton from "@/components/docs/ExportButton";
import HtmlDocView from "@/components/docs/HtmlDocView";
import LatexDocView from "@/components/docs/LatexDocView";

interface DocsPageProps {
  params: Promise<{ stream: string; slug: string[] }>;
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { stream, slug } = await params;
  const result = await getDocRaw(stream, JSON.stringify(slug));
  if (!result) return { title: "Not Found" };

  if (result.format === "mdx") {
    const { data } = matter(result.raw);
    return {
      title: (data.title as string | undefined) ?? slug.at(-1),
      description: data.description as string | undefined,
    };
  }
  if (result.format === "html") {
    const titleMatch = result.raw.match(/<title[^>]*>([^<]+)<\/title>/i);
    return { title: titleMatch?.[1]?.trim() ?? slug.at(-1) };
  }
  // LaTeX
  const texTitle = result.raw.match(/\\title\{([^}]+)\}/)?.[1];
  return { title: texTitle?.trim() ?? slug.at(-1) };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { stream, slug } = await params;

  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && !session.teams.includes(stream))
    redirect("/dashboard?error=forbidden");

  const result = await getDocRaw(stream, JSON.stringify(slug));
  if (!result) notFound();

  const { raw, format } = result;

  const canWrite =
    session.role === "admin" ||
    (session.role === "writer" && session.teams.includes(stream));

  // — MDX: compile to React element + extract TOC
  if (format === "mdx") {
    let compiled;
    try {
      compiled = await compileMdxFromRaw(raw);
    } catch {
      notFound();
    }
    const { content, frontmatter } = compiled;
    const toc = extractToc(raw);

    return (
      <>
        <main className="docs-main-wrap" id="main-content">
          <div className="doc-edit-bar" id="doc-action-bar">
            {canWrite && (
              <DocEditor
                stream={stream}
                slug={slug}
                initialContent={raw}
                title={frontmatter.title}
                format="mdx"
              />
            )}
            <ExportButton stream={stream} slug={slug} />
          </div>
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

  // — HTML: render raw HTML body
  if (format === "html") {
    const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? slug.at(-1) ?? "Document";

    return (
      <>
        <main className="docs-main-wrap" id="main-content">
          <div className="doc-edit-bar" id="doc-action-bar">
            {canWrite && (
              <DocEditor
                stream={stream}
                slug={slug}
                initialContent={raw}
                title={title}
                format="html"
              />
            )}
            <ExportButton stream={stream} slug={slug} />
          </div>
          <HtmlDocView content={raw} />
          <footer className="docs-footer">
            <span>{title}</span>
            <a href="/dashboard">← All streams</a>
          </footer>
        </main>
        <TableOfContents items={[]} />
      </>
    );
  }

  // — LaTeX: render parsed document view
  const texTitle =
    raw.match(/\\title\{([^}]+)\}/)?.[1]?.trim() ?? slug.at(-1) ?? "Document";

  return (
    <>
      <main className="docs-main-wrap" id="main-content">
        <div className="doc-edit-bar" id="doc-action-bar">
          {canWrite && (
            <DocEditor
              stream={stream}
              slug={slug}
              initialContent={raw}
              title={texTitle}
              format="tex"
            />
          )}
          <ExportButton stream={stream} slug={slug} />
        </div>
        <LatexDocView content={raw} />
        <footer className="docs-footer">
          <span>{texTitle}</span>
          <a href="/dashboard">← All streams</a>
        </footer>
      </main>
      <TableOfContents items={[]} />
    </>
  );
}
