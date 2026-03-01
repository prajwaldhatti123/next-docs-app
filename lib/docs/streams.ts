import "server-only";
import { list, put } from "@vercel/blob";
import { unstable_cache } from "next/cache";

export interface StreamMeta {
  slug: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const STREAM_DEFAULTS: Record<string, Partial<StreamMeta>> = {
  tech: {
    label: "Tech",
    description: "Engineering docs, architecture, and API references.",
    icon: "⚙️",
    color: "blue",
  },
  marketing: {
    label: "Marketing",
    description: "Brand guidelines, campaigns, and go-to-market strategies.",
    icon: "📣",
    color: "purple",
  },
  sales: {
    label: "Sales",
    description: "Sales playbooks, pricing, and customer collateral.",
    icon: "💼",
    color: "green",
  },
  hr: {
    label: "HR",
    description: "Onboarding, policies, and people operations.",
    icon: "👥",
    color: "orange",
  },
};

function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, " ");
}

async function fetchStreamList(): Promise<StreamMeta[]> {
  let blobs: any[] = [];
  try {
    const res = await list({ prefix: "content/" });
    blobs = res.blobs;
  } catch (error) {
    console.error("Vercel Blob list error:", error);
    return [];
  }

  const streamSlugs = new Set<string>();
  const metaMap = new Map<string, Partial<StreamMeta>>();

  for (const blob of blobs) {
    const parts = blob.pathname.split("/");
    if (parts.length >= 2) {
      streamSlugs.add(parts[1].toLowerCase());
    }
  }

  const requiredStreams = ["tech", "marketing", "sales"];
  for (const req of requiredStreams) {
    if (!streamSlugs.has(req)) {
      streamSlugs.add(req);
      const defaults = STREAM_DEFAULTS[req] ?? {};
      try {
        await put(`content/${req}/_meta.json`, JSON.stringify(defaults), {
          access: "public",
          addRandomSuffix: false,
        });
      } catch (err) {}
    }
  }

  // Fetch meta json blobs in parallel
  const metaBlobs = blobs.filter(
    (b) =>
      b.pathname.split("/").length === 3 && b.pathname.endsWith("_meta.json"),
  );
  await Promise.all(
    metaBlobs.map(async (blob) => {
      const slug = blob.pathname.split("/")[1].toLowerCase();
      try {
        const res = await fetch(blob.url);
        const str = await res.text();
        metaMap.set(slug, JSON.parse(str));
      } catch {}
    }),
  );

  const streams: StreamMeta[] = [];
  for (const slug of Array.from(streamSlugs)) {
    const fileMeta = metaMap.get(slug) || {};
    const defaults = STREAM_DEFAULTS[slug] ?? {};
    streams.push({
      slug,
      label: fileMeta.label ?? defaults.label ?? toTitleCase(slug),
      description:
        fileMeta.description ??
        defaults.description ??
        `Documentation for the ${toTitleCase(slug)} team.`,
      icon: fileMeta.icon ?? defaults.icon ?? "📄",
      color: fileMeta.color ?? defaults.color ?? "gray",
    });
  }

  return streams.sort((a, b) => a.label.localeCompare(b.label));
}

export const getAvailableStreams = unstable_cache(
  fetchStreamList,
  ["available-streams"],
  {
    tags: ["docs"],
    revalidate: process.env.NODE_ENV === "development" ? false : 3600,
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
