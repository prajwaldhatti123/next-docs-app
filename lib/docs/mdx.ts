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
import type { DocFormat, RawDocResult } from "./write";

export type { DocFormat };

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

// ─── Multi-format blob lookup ─────────────────────────────────────────────────

async function findDocBlobInternal(
  blobs: any[],
  base: string,
): Promise<{ blob: any; format: DocFormat } | null> {
  const candidates: [string, DocFormat][] = [
    [`${base}.mdx`, "mdx"],
    [`${base}.html`, "html"],
    [`${base}.tex`, "tex"],
    [`${base}/index.mdx`, "mdx"],
  ];
  for (const [path, fmt] of candidates) {
    const blob = blobs.find((b) => b.pathname === path);
    if (blob) return { blob, format: fmt };
  }
  return null;
}

// ─── Cached: get raw source + format ─────────────────────────────────────────

export const getDocRaw = unstable_cache(
  async (stream: string, slugStr: string): Promise<RawDocResult | null> => {
    let blobs: any[] = [];
    try {
      const res = await list({ prefix: `content/${stream}/` });
      blobs = res.blobs;
    } catch {
      return null;
    }

    const slug = JSON.parse(slugStr) as string[];
    const base = `content/${stream}/${slug.join("/")}`;
    const found = await findDocBlobInternal(blobs, base);
    if (!found) return null;

    try {
      const res = await fetch(found.blob.url);
      return { raw: await res.text(), format: found.format };
    } catch {
      return null;
    }
  },
  ["doc-raw-v2-cache"],
  {
    tags: ["docs"],
    revalidate: process.env.NODE_ENV === "development" ? false : 3600,
  },
);

// ─── Legacy cache (used by export API, raw API route) ────────────────────────

export const getMdxRawSource = unstable_cache(
  async (stream: string, slugStr: string): Promise<string | null> => {
    let blobs: any[] = [];
    try {
      const res = await list({ prefix: `content/${stream}/` });
      blobs = res.blobs;
    } catch {
      return null;
    }

    const slug = JSON.parse(slugStr) as string[];
    const base = `content/${stream}/${slug.join("/")}`;
    const found = await findDocBlobInternal(blobs, base);
    if (!found) return null;

    try {
      const fetchedRes = await fetch(found.blob.url);
      return await fetchedRes.text();
    } catch {
      return null;
    }
  },
  ["mdx-raw-cache"],
  {
    tags: ["docs"],
    revalidate: process.env.NODE_ENV === "development" ? false : 3600,
  },
);

// ─── MDX compiler ─────────────────────────────────────────────────────────────

const MDX_OPTIONS = {
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
} as const;

/** Compile raw MDX string into a React element + frontmatter */
export async function compileMdxFromRaw(
  rawSource: string,
  components?: Components,
): Promise<CompiledDoc> {
  const { data } = matter(rawSource);
  const frontmatter: DocFrontmatter = {
    title: (data.title as string | undefined) ?? "Untitled",
    description: data.description as string | undefined,
    order: data.order as number | undefined,
  };

  const { content } = await compileMDX<DocFrontmatter>({
    source: rawSource,
    components,
    options: MDX_OPTIONS as any,
  });

  return { content, frontmatter, rawSource };
}

/** Convenience: resolve from blob then compile — kept for backward compat */
export async function compileMdx(
  stream: string,
  slug: string[],
  components?: Components,
): Promise<CompiledDoc> {
  const result = await getDocRaw(stream, JSON.stringify(slug));
  if (!result) throw new DocNotFoundError(stream, slug);
  if (result.format !== "mdx") {
    // Non-MDX docs are rendered differently in the page; compileMdx is MDX-only
    throw new DocNotFoundError(stream, slug);
  }
  return compileMdxFromRaw(result.raw, components);
}

export class DocNotFoundError extends Error {
  constructor(stream: string, slug: string[]) {
    super(`Doc not found: /content/${stream}/${slug.join("/")}`);
    this.name = "DocNotFoundError";
  }
}
