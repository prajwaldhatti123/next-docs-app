/**
 * lib/docs/toc.ts
 * Extract a Table of Contents from raw MDX source.
 *
 * Regex-parses ## and ### headings from the raw file content.
 * Returns items with an ID suitable for in-page anchor links.
 */

export interface TocItem {
  id: string; // URL-safe anchor ID
  text: string; // Display text
  level: 2 | 3; // h2 or h3
}

/**
 * Extract TOC entries from raw MDX string.
 * Supports ## and ### headings (h2, h3).
 */
export function extractToc(rawSource: string): TocItem[] {
  const items: TocItem[] = [];

  // Match ## and ### headings, ignoring #### and deeper
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(rawSource)) !== null) {
    const level = match[1].length as 2 | 3;
    const text = match[2]
      .replace(/\*\*(.+?)\*\*/g, "$1") // strip bold
      .replace(/\*(.+?)\*/g, "$1") // strip italic
      .replace(/`(.+?)`/g, "$1") // strip code
      .replace(/\[(.+?)\]\(.+?\)/g, "$1") // strip links
      .trim();

    const id = slugifyHeading(text);

    items.push({ id, text, level });
  }

  return items;
}

/**
 * Convert heading text to a URL-safe anchor ID.
 * Matches the ID generation used by rehype-slug.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove non-word chars except hyphens
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}
