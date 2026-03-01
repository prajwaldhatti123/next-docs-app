import "server-only";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { list } from "@vercel/blob";
import { unstable_cache } from "next/cache";
import type { MDXRemoteProps } from "next-mdx-remote/rsc";
import type { ReactElement } from "react";

export interface DocFrontmatter {
  title: string;
  description?: string;
  order?: number;
}

export interface CompiledDoc {
  content: ReactElement;
  frontmatter: DocFrontmatter;
  rawSource: string;
}

type Components = MDXRemoteProps["components"];

export const getMdxRawSource = unstable_cache(
  async (stream: string, slugStr: string): Promise<string | null> => {
    let blobs: any[] = [];
    try {
      const res = await list({ prefix: `content/${stream}/` });
      blobs = res.blobs;
    } catch {
      return null;
    }

    const slug = JSON.parse(slugStr);
    const mdxPath = `content/${stream}/${slug.join("/")}.mdx`;
    const indexPath = `content/${stream}/${slug.join("/")}/index.mdx`;

    const blob =
      blobs.find((b) => b.pathname === mdxPath) ||
      blobs.find((b) => b.pathname === indexPath);
    if (!blob) return null;

    try {
      const fetchedRes = await fetch(blob.url);
      return await fetchedRes.text();
    } catch {
      return null;
    }
  },
  ["mdx-raw-cache"],
  {
    tags: ["docs"],
    revalidate: process.env.NODE_ENV === "development" ? 0 : 3600,
  },
);

export async function compileMdx(
  stream: string,
  slug: string[],
  components?: Components,
): Promise<CompiledDoc> {
  const rawSource = await getMdxRawSource(stream, JSON.stringify(slug));
  if (!rawSource) throw new DocNotFoundError(stream, slug);

  const { data } = matter(rawSource);
  const frontmatter: DocFrontmatter = {
    title:
      (data.title as string | undefined) ?? slug[slug.length - 1] ?? "Untitled",
    description: data.description as string | undefined,
    order: data.order as number | undefined,
  };

  const { content } = await compileMDX<DocFrontmatter>({
    source: rawSource,
    components,
    options: {
      parseFrontmatter: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            { behavior: "wrap", properties: { className: ["anchor-link"] } },
          ],
          [
            rehypePrettyCode,
            {
              theme: "github-dark",
              keepBackground: true,
              onVisitLine(node: { children: { type: string }[] }) {
                if (node.children.length === 0) {
                  node.children = [{ type: "text" }];
                }
              },
            },
          ],
        ],
      },
    },
  });

  return { content, frontmatter, rawSource };
}

export class DocNotFoundError extends Error {
  constructor(stream: string, slug: string[]) {
    super(`Doc not found: /content/${stream}/${slug.join("/")}.mdx`);
    this.name = "DocNotFoundError";
  }
}
