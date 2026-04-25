import "server-only";
import {
  listObjects,
  readObjectText,
  type StorageBlob,
} from "@/lib/storage/gcs";
import { unstable_cache } from "next/cache";

export interface StreamMeta {
  slug: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

function toTitleCase(str: string): string {
  return str
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchStreamList(): Promise<StreamMeta[]> {
  const streamSlugs = new Set<string>();
  const metaMap = new Map<string, Partial<StreamMeta>>();
  const blobs: StorageBlob[] = [];
  let cursor: string | undefined;

  try {
    // List all files in the content directory using pagination
    do {
      const res = await listObjects("content/", cursor);
      blobs.push(...res.blobs);
      cursor = res.cursor;
    } while (cursor);
  } catch (error) {
    console.error("Storage list error:", error);
    return [];
  }

  for (const blob of blobs) {
    const parts = blob.pathname.split("/");
    // path pattern: content/<stream>/...
    if (parts.length >= 2) {
      const slug = parts[1].toLowerCase();
      if (slug) streamSlugs.add(slug);
    }
  }

  // Streams are fully dynamic — only what exists in blob appears in the UI.

  // Fetch meta json blobs in parallel
  const metaBlobs = blobs.filter(
    (b) =>
      b.pathname.split("/").length === 3 && b.pathname.endsWith("_meta.json"),
  );
  await Promise.all(
    metaBlobs.map(async (blob) => {
      const slug = blob.pathname.split("/")[1].toLowerCase();
      try {
        const raw = await readObjectText(blob.pathname);
        if (raw) metaMap.set(slug, JSON.parse(raw));
      } catch {}
    }),
  );

  const streams: StreamMeta[] = [];
  for (const slug of Array.from(streamSlugs)) {
    const fileMeta = metaMap.get(slug) || {};
    streams.push({
      slug,
      label: fileMeta.label ?? toTitleCase(slug),
      description:
        fileMeta.description ??
        `Documentation for the ${toTitleCase(slug)} team.`,
      icon: fileMeta.icon ?? "📄",
      color: fileMeta.color ?? "gray",
    });
  }

  return streams.sort((a, b) => a.label.localeCompare(b.label));
}

export const getAvailableStreams = unstable_cache(
  fetchStreamList,
  ["available-streams"],
  {
    tags: ["docs"],
    revalidate: process.env.NODE_ENV === "development" ? 1 : 3600,
  },
);

export async function getStreamMeta(slug: string): Promise<StreamMeta | null> {
  const all = await getAvailableStreams();
  return all.find((s) => s.slug === slug.toLowerCase()) ?? null;
}

export async function getUserStreams(teams: string[]): Promise<StreamMeta[]> {
  const all = await getAvailableStreams();
  const teamSet = new Set(teams.map((t) => t.toLowerCase()));
  return all.filter((s) => teamSet.has(s.slug));
}

export async function getAllStreams(): Promise<StreamMeta[]> {
  return getAvailableStreams();
}
