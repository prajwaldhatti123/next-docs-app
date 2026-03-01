import "server-only";
import { put, del, list } from "@vercel/blob";
import { revalidatePath } from "next/cache";

export function sanitizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function clearDocsCache() {
  revalidatePath("/", "layout");
}

export async function readRawDoc(
  stream: string,
  slug: string[],
): Promise<string | null> {
  let blobs: any[] = [];
  try {
    const res = await list({ prefix: `content/${stream}/` });
    blobs = res.blobs;
  } catch (err) {
    return null;
  }
  const exact = `content/${stream}/${slug.join("/")}.mdx`;
  const index = `content/${stream}/${slug.join("/")}/index.mdx`;
  const blob = blobs.find((b) => b.pathname === exact || b.pathname === index);
  if (!blob) return null;
  const res = await fetch(blob.url);
  return await res.text();
}

export async function saveDoc(
  stream: string,
  slug: string[],
  content: string,
): Promise<void> {
  const path = `content/${stream}/${slug.join("/")}.mdx`;
  await put(path, content, { access: "public", addRandomSuffix: false });
  clearDocsCache();
}

export async function createDoc(
  stream: string,
  slugPath: string[],
  title: string,
) {
  const safeSlug = slugPath.map(sanitizeName).filter(Boolean);
  const path = `content/${stream}/${safeSlug.join("/")}.mdx`;
  let blobs: any[] = [];
  try {
    const res = await list({ prefix: path });
    blobs = res.blobs;
  } catch {}
  if (blobs.some((b) => b.pathname === path))
    throw new Error(`File already exists.`);
  const content = `---\ntitle: "${title}"\ndescription: ""\norder: 99\n---\n\n# ${title}\n\nStart writing here…\n`;
  await put(path, content, { access: "public", addRandomSuffix: false });
  clearDocsCache();
  return { content, slug: safeSlug };
}

export async function createFolder(
  stream: string,
  folderPath: string[],
  title: string,
): Promise<void> {
  const safePath = folderPath.map(sanitizeName).filter(Boolean);
  const path = `content/${stream}/${safePath.join("/")}/index.mdx`;
  let blobs: any[] = [];
  try {
    const res = await list({ prefix: path });
    blobs = res.blobs;
  } catch {}
  if (blobs.some((b) => b.pathname === path))
    throw new Error(`Folder already exists.`);
  const indexStr = `---\ntitle: "${title}"\ndescription: ""\norder: 99\n---\n\n# ${title}\n`;
  await put(path, indexStr, { access: "public", addRandomSuffix: false });
  clearDocsCache();
}

export async function createStream(
  streamSlug: string,
  meta: any,
): Promise<void> {
  const safe = sanitizeName(streamSlug);
  if (!safe) throw new Error("Invalid stream name.");

  const welcome = `---\ntitle: "Welcome to ${meta.label}"\ndescription: "${meta.description}"\norder: 1\n---\n\n# Welcome to ${meta.label}\n\n${meta.description}\n\nStart adding documentation here.\n`;
  await put(`content/${safe}/welcome.mdx`, welcome, {
    access: "public",
    addRandomSuffix: false,
  });
  await put(`content/${safe}/_meta.json`, JSON.stringify(meta, null, 2), {
    access: "public",
    addRandomSuffix: false,
  });
  clearDocsCache();
}

export async function updateStreamMeta(
  streamSlug: string,
  meta: any,
): Promise<void> {
  const safe = sanitizeName(streamSlug);
  const path = `content/${safe}/_meta.json`;
  let existing = {};
  try {
    const { blobs } = await list({ prefix: path });
    const b = blobs.find((b) => b.pathname === path);
    if (b) {
      const res = await fetch(b.url);
      existing = await res.json();
    }
  } catch {}
  await put(path, JSON.stringify({ ...existing, ...meta }, null, 2), {
    access: "public",
    addRandomSuffix: false,
  });
  clearDocsCache();
}

export async function deleteDoc(stream: string, slug: string[]): Promise<void> {
  const path = `content/${stream}/${slug.join("/")}.mdx`;
  await del(path);
  clearDocsCache();
}

export async function deleteFolder(
  stream: string,
  folderPath: string[],
): Promise<void> {
  const prefix = `content/${stream}/${folderPath.join("/")}/`;
  const { blobs } = await list({ prefix });
  const urls = blobs.map((b) => b.url);
  if (urls.length > 0) {
    await del(urls);
  }
  clearDocsCache();
}

export async function deleteStream(streamSlug: string): Promise<void> {
  const safe = sanitizeName(streamSlug);
  const prefix = `content/${safe}/`;
  const { blobs } = await list({ prefix });
  const urls = blobs.map((b) => b.url);
  if (urls.length > 0) {
    await del(urls);
  }
  clearDocsCache();
}
