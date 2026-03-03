import "server-only";
import { put, del, list } from "@vercel/blob";
import { revalidatePath, revalidateTag } from "next/cache";

// ─── Types & Constants ─────────────────────────────────────────────────────────

export type DocFormat = "mdx" | "html" | "tex";

const FORMAT_EXT: Record<DocFormat, string> = {
  mdx: "mdx",
  html: "html",
  tex: "tex",
};

const FORMAT_TEMPLATE: Record<DocFormat, (title: string) => string> = {
  mdx: (title) =>
    `---\ntitle: "${title}"\ndescription: ""\norder: 99\n---\n\n# ${title}\n\nStart writing here…\n`,
  html: (title) =>
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>${title}</title>\n</head>\n<body>\n\n<h1>${title}</h1>\n\n<p>Start writing here…</p>\n\n</body>\n</html>\n`,
  tex: (title) =>
    `\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage{hyperref}\n\n\\title{${title}}\n\\author{}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\n\nStart writing here…\n\n\\end{document}\n`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensures paths/slugs are URL-safe and consistent.
 */
export function sanitizeName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

/**
 * Clears docs cache for real-time updates across the app.
 */
export async function clearDocsCache() {
  // Revalidate specific critical paths to ensure UI updates
  // @ts-expect-error Next.js 16 types incorrectly demand a second argument
  revalidateTag("docs");
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/docs", "layout");
}

/**
 * Helper to fetch all blobs matching a prefix, handling pagination.
 */
async function listAllBlobs(prefix: string): Promise<any[]> {
  const blobs: any[] = [];
  let cursor: string | undefined;
  try {
    do {
      const res: any = await list({ prefix, cursor });
      blobs.push(...res.blobs);
      cursor = res.cursor;
    } while (cursor);
  } catch (err) {
    console.error("[listAllBlobs] error:", err);
  }
  return blobs;
}

/** Check every possible extension for a slug and return the first match */
async function findDocBlob(
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

// ─── CRUD Operations ─────────────────────────────────────────────────────────

export interface RawDocResult {
  raw: string;
  format: DocFormat;
}

/**
 * Fetches the raw content of a document by resolving its format.
 */
export async function readRawDoc(
  stream: string,
  slug: string[],
): Promise<RawDocResult | null> {
  try {
    const streamPrefix = `content/${stream.toLowerCase()}/`;
    const blobs = await listAllBlobs(streamPrefix);
    const base = `${streamPrefix}${slug.join("/")}`;
    const found = await findDocBlob(blobs, base);

    if (!found) return null;

    const res = await fetch(found.blob.url, { cache: "no-store" });
    if (!res.ok) return null;

    return { raw: await res.text(), format: found.format };
  } catch (err) {
    console.error("[readRawDoc] error:", err);
    return null;
  }
}

/**
 * Saves (overwrites) an existing document.
 */
export async function saveDoc(
  stream: string,
  slug: string[],
  content: string,
  format: DocFormat = "mdx",
): Promise<void> {
  const ext = FORMAT_EXT[format];
  const path = `content/${stream.toLowerCase()}/${slug.join("/")}.${ext}`;

  await put(path, content, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await clearDocsCache();
}

/**
 * Creates a new document with boilerplate content.
 */
export async function createDoc(
  stream: string,
  slugPath: string[],
  title: string,
  format: DocFormat = "mdx",
) {
  const safeSlug = slugPath.map(sanitizeName).filter(Boolean);
  const ext = FORMAT_EXT[format];
  const streamLower = stream.toLowerCase();
  const path = `content/${streamLower}/${safeSlug.join("/")}.${ext}`;

  // Check if exists
  const blobs = await listAllBlobs(
    `content/${streamLower}/${safeSlug.join("/")}`,
  );
  const base = `content/${streamLower}/${safeSlug.join("/")}`;
  for (const candidateFmt of Object.values(FORMAT_EXT)) {
    if (blobs.some((b) => b.pathname === `${base}.${candidateFmt}`)) {
      throw new Error(`File already exists.`);
    }
  }

  const content = FORMAT_TEMPLATE[format](title);
  await put(path, content, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await clearDocsCache();
  return { content, slug: safeSlug, format };
}

/**
 * Creates a new folder (represented by an index.mdx file).
 */
export async function createFolder(
  stream: string,
  folderPath: string[],
  title: string,
): Promise<void> {
  const safePath = folderPath.map(sanitizeName).filter(Boolean);
  const streamLower = stream.toLowerCase();
  const path = `content/${streamLower}/${safePath.join("/")}/index.mdx`;

  const blobs = await listAllBlobs(path);
  if (blobs.some((b) => b.pathname === path)) {
    throw new Error(`Folder already exists.`);
  }

  const indexStr = `---\ntitle: "${title}"\ndescription: ""\norder: 99\n---\n\n# ${title}\n`;
  await put(path, indexStr, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await clearDocsCache();
}

/**
 * Initializes a new documentation stream.
 */
export async function createStream(
  streamSlug: string,
  meta: any,
): Promise<void> {
  const safe = sanitizeName(streamSlug);
  if (!safe) throw new Error("Invalid stream name.");

  const metaPath = `content/${safe}/_meta.json`;
  const blobs = await listAllBlobs(metaPath);
  if (blobs.some((b) => b.pathname === metaPath)) {
    throw new Error("Stream already exists.");
  }

  const welcome = `---\ntitle: "Welcome to ${meta.label || streamSlug}"\ndescription: "${meta.description || ""}"\norder: 1\n---\n\n# Welcome to ${meta.label || streamSlug}\n\n${meta.description || ""}\n\nStart adding documentation here.\n`;

  await put(`content/${safe}/welcome.mdx`, welcome, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await put(metaPath, JSON.stringify(meta, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await clearDocsCache();
}

/**
 * Updates metadata for an existing stream.
 */
export async function updateStreamMeta(
  streamSlug: string,
  meta: any,
): Promise<void> {
  const safe = streamSlug.toLowerCase(); // Should already be safe
  const path = `content/${safe}/_meta.json`;

  let existing = {};
  try {
    const blobs = await listAllBlobs(path);
    const b = blobs.find((b) => b.pathname === path);
    if (b) {
      const res = await fetch(b.url, { cache: "no-store" });
      if (res.ok) {
        existing = await res.json();
      }
    }
  } catch (err) {
    console.warn("[updateStreamMeta] failed to fetch existing meta:", err);
  }

  const merged = { ...existing, ...meta };

  await put(path, JSON.stringify(merged, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  await clearDocsCache();
}

/**
 * Deletes a document.
 */
export async function deleteDoc(
  stream: string,
  slug: string[],
  format?: DocFormat,
): Promise<void> {
  const streamLower = stream.toLowerCase();
  const base = `content/${streamLower}/${slug.join("/")}`;

  if (format) {
    const path = `${base}.${FORMAT_EXT[format]}`;
    await del(path).catch(() => {});
  } else {
    // Try all formats
    const blobs = await listAllBlobs(base);
    const targets = blobs.filter((b) =>
      Object.values(FORMAT_EXT).some((ext) => b.pathname === `${base}.${ext}`),
    );
    if (targets.length > 0) {
      await del(targets.map((b) => b.url)).catch(() => {});
    }
  }

  await clearDocsCache();
}

/**
 * Deletes a folder and all its contents recursively.
 */
export async function deleteFolder(
  stream: string,
  folderPath: string[],
): Promise<void> {
  const streamLower = stream.toLowerCase();
  const prefix = `content/${streamLower}/${folderPath.join("/")}/`;
  const blobs = await listAllBlobs(prefix);
  const urls = blobs.map((b) => b.url);

  if (urls.length > 0) {
    await del(urls).catch(() => {});
  }

  await clearDocsCache();
}

/**
 * Deletes an entire stream.
 */
export async function deleteStream(streamSlug: string): Promise<void> {
  const safe = sanitizeName(streamSlug);
  const prefix = `content/${safe}/`;
  const blobs = await listAllBlobs(prefix);
  const urls = blobs.map((b) => b.url);

  if (urls.length > 0) {
    await del(urls).catch(() => {});
  }

  await clearDocsCache();
}
