import "server-only";
import matter from "gray-matter";
import { list } from "@vercel/blob";
import { unstable_cache } from "next/cache";

export interface SidebarItem {
  title: string;
  slug: string;
  order: number;
  description?: string;
  children?: SidebarItem[];
  isFolder?: boolean;
}

function toTitleCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function buildSidebar(stream: string): Promise<SidebarItem[]> {
  let blobs: any[] = [];
  try {
    const res = await list({ prefix: `content/${stream}/` });
    blobs = res.blobs;
  } catch {
    return [];
  }

  const itemMap = new Map<string, any>();
  const rootPath = `content/${stream}`;
  itemMap.set(rootPath, { children: [], isFolder: true, fullPath: rootPath });

  const mdxBlobs = blobs.filter(
    (b) =>
      b.pathname.endsWith(".mdx") &&
      !b.pathname.includes("/_") &&
      !b.pathname.includes("/."),
  );

  await Promise.all(
    mdxBlobs.map(async (blob) => {
      let raw = "";
      try {
        const res = await fetch(blob.url);
        raw = await res.text();
      } catch {
        return;
      }

      const { data } = matter(raw);
      const parts = blob.pathname.replace(`${rootPath}/`, "").split("/");

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
        const folderObj = itemMap.get(currentPath);
        if (folderObj) {
          folderObj.title = data.title ?? folderObj.title;
          folderObj.order = data.order ?? folderObj.order;
        }
      } else if (!isIndex) {
        const fileSlug = blob.pathname
          .replace("content/", "")
          .replace(/\.mdx$/, "");
        itemMap.set(blob.pathname, {
          title: data.title ?? toTitleCase(filename.replace(/\.mdx$/, "")),
          slug: fileSlug,
          order: data.order ?? 999,
          description: data.description,
          isFolder: false,
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

    const parent = itemMap.get(parentPath);
    if (parent && parent.children) {
      parent.children.push(item);
    } else if (parentPath === rootPath) {
      rootItems.push(item);
    }
  }

  function sortTree(items: SidebarItem[]) {
    items.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
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
  revalidate: process.env.NODE_ENV === "development" ? false : 3600,
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
