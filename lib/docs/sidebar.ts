import "server-only";
import matter from "gray-matter";
import {
  listObjects,
  readObjectText,
  type StorageBlob,
} from "@/lib/storage/gcs";
import { unstable_cache } from "next/cache";
import type { DocFormat } from "./write";

export interface SidebarItem {
  title: string;
  slug: string;
  order: number;
  description?: string;
  children?: SidebarItem[];
  isFolder?: boolean;
  format?: DocFormat;
}

function toTitleCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Extensions that represent doc files (for sidebar discovery) */
const DOC_EXTENSIONS: [string, DocFormat][] = [
  [".mdx", "mdx"],
  [".html", "html"],
  [".tex", "tex"],
];

function getDocFormat(pathname: string): DocFormat | null {
  for (const [ext, fmt] of DOC_EXTENSIONS) {
    if (pathname.endsWith(ext)) return fmt;
  }
  return null;
}

function stripDocExtension(name: string): string {
  for (const [ext] of DOC_EXTENSIONS) {
    if (name.endsWith(ext)) return name.slice(0, -ext.length);
  }
  return name;
}

async function buildSidebar(stream: string): Promise<SidebarItem[]> {
  const blobs: StorageBlob[] = [];
  let cursor: string | undefined;
  try {
    do {
      const res = await listObjects(`content/${stream}/`, cursor);
      blobs.push(...res.blobs);
      cursor = res.cursor;
    } while (cursor);
  } catch {
    return [];
  }

  const itemMap = new Map<string, SidebarItem>();
  const rootPath = `content/${stream}`;
  itemMap.set(rootPath, {
    title: stream,
    slug: stream,
    order: 0,
    children: [],
    isFolder: true,
  });

  // Include all supported doc formats, skip internal files (_*, .*)
  const docBlobs = blobs.filter((b) => {
    if (b.pathname.includes("/_") || b.pathname.includes("/.")) return false;
    return getDocFormat(b.pathname) !== null;
  });

  await Promise.all(
    docBlobs.map(async (blob) => {
      const format = getDocFormat(blob.pathname)!;
      const parts = blob.pathname.replace(`${rootPath}/`, "").split("/");

      // Ensure parent folders exist in the map
      let currentPath = rootPath;
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath + "/" + parts[i];
        if (!itemMap.has(currentPath)) {
          itemMap.set(currentPath, {
            title: toTitleCase(parts[i]),
            slug: currentPath.replace("content/", ""),
            order: 999,
            isFolder: true,
            children: [],
          });
        }
      }

      const filename = parts[parts.length - 1];
      const isIndex = filename === "index.mdx";

      if (isIndex && parts.length > 1) {
        // index.mdx describes its parent folder
        let raw = "";
        try {
          raw = (await readObjectText(blob.pathname)) ?? "";
        } catch {}
        const { data } = matter(raw);
        const folderObj = itemMap.get(currentPath);
        if (folderObj) {
          folderObj.title = data.title ?? folderObj.title;
          folderObj.order = data.order ?? folderObj.order;
        }
      } else if (!isIndex) {
        // Regular doc
        let title: string;
        let description: string | undefined;
        let order = 999;

        if (format === "mdx") {
          // Parse frontmatter for MDX
          let raw = "";
          try {
            raw = (await readObjectText(blob.pathname)) ?? "";
          } catch {}
          const { data } = matter(raw);
          title =
            (data.title as string | undefined) ??
            toTitleCase(stripDocExtension(filename));
          description = data.description as string | undefined;
          order = (data.order as number | undefined) ?? 999;
        } else if (format === "html") {
          // Extract <title> from HTML if present
          let raw = "";
          try {
            raw = (await readObjectText(blob.pathname)) ?? "";
          } catch {}
          const htmlTitle = raw
            .match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
            ?.trim();
          title = htmlTitle ?? toTitleCase(stripDocExtension(filename));
        } else {
          // LaTeX: extract \title{...} if present
          let raw = "";
          try {
            raw = (await readObjectText(blob.pathname)) ?? "";
          } catch {}
          const texTitle = raw.match(/\\title\{([^}]+)\}/)?.[1]?.trim();
          title = texTitle ?? toTitleCase(stripDocExtension(filename));
        }

        const fileSlug = blob.pathname
          .replace("content/", "")
          .replace(/\.(mdx|html|tex)$/, "");

        itemMap.set(blob.pathname, {
          title,
          slug: fileSlug,
          order,
          description,
          isFolder: false,
          format,
        });
      }
    }),
  );

  const rootItems: SidebarItem[] = [];

  for (const [path, item] of itemMap.entries()) {
    if (path === rootPath) continue;

    const parentParts = path.split("/");
    parentParts.pop();
    const parentPath = parentParts.join("/");

    if (parentPath === rootPath) {
      rootItems.push(item);
    } else {
      const parent = itemMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(item);
      }
    }
  }

  function sortTree(items: SidebarItem[]) {
    items.sort((a, b) => {
      // 1. Folders first
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      // 2. Then by order
      if (a.order !== b.order) return a.order - b.order;

      // 3. Then alphabetical
      return a.title.localeCompare(b.title);
    });
    for (const item of items) {
      if (item.children) sortTree(item.children);
    }
  }

  sortTree(rootItems);
  return rootItems;
}

export const getSidebar = unstable_cache(buildSidebar, ["sidebar-cache"], {
  tags: ["docs"],
  revalidate: process.env.NODE_ENV === "development" ? 1 : 3600,
});

export function flattenSidebar(items: SidebarItem[]): SidebarItem[] {
  const result: SidebarItem[] = [];
  for (const item of items) {
    if (!item.isFolder) result.push(item);
    if (item.children) result.push(...flattenSidebar(item.children));
  }
  return result;
}

export function getFirstDoc(items: SidebarItem[]): SidebarItem | null {
  for (const item of items) {
    if (!item.isFolder) return item;
    if (item.children) {
      const found = getFirstDoc(item.children);
      if (found) return found;
    }
  }
  return null;
}
