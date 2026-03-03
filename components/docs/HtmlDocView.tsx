"use client";

interface HtmlDocViewProps {
  content: string;
}

/**
 * Renders a raw HTML document inside an isolated <article> wrapper.
 * Only writers/admins can create content, so dangerouslySetInnerHTML is acceptable.
 */
export default function HtmlDocView({ content }: HtmlDocViewProps) {
  // Strip doctype / <html> / <head> / <body> wrappers so we render just the body
  const body = extractHtmlBody(content);

  return (
    <article
      className="prose html-doc"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

function extractHtmlBody(html: string): string {
  // If the file has a <body> tag, extract just that content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) return bodyMatch[1].trim();

  // If it's a full document without explicit body tags, strip doctype + <html>/<head>
  const stripped = html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<html[^>]*>/gi, "")
    .replace(/<\/html>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .trim();

  return stripped || html;
}
