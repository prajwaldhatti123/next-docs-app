import "server-only";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import PDFDocument from "pdfkit";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportFormat = "html" | "pdf" | "latex";

// ─── MDX → clean markdown (strip frontmatter) ─────────────────────────────────

function stripFrontmatter(raw: string): {
  body: string;
  title: string;
  description: string;
} {
  const { content, data } = matter(raw);
  return {
    body: content.trim(),
    title: (data.title as string | undefined) ?? "Document",
    description: (data.description as string | undefined) ?? "",
  };
}

// ─── HTML Export ──────────────────────────────────────────────────────────────

export async function exportAsHtml(raw: string): Promise<Buffer> {
  const { body, title, description } = stripFrontmatter(raw);

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(body);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}" />` : ""}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.7;
      color: #1a1a2e;
      max-width: 860px;
      margin: 0 auto;
      padding: 2.5rem 2rem 4rem;
      background: #fff;
    }
    h1, h2, h3, h4, h5, h6 {
      line-height: 1.3;
      margin-top: 2rem;
      margin-bottom: 0.6rem;
      color: #0f0f23;
      font-weight: 700;
    }
    h1 { font-size: 2.2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    h2 { font-size: 1.6rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem; }
    h3 { font-size: 1.25rem; }
    p { margin: 0.75rem 0; }
    a { color: #4f46e5; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background: #f1f5f9;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-family: "Fira Code", "Cascadia Code", Consolas, monospace;
      font-size: 0.88em;
    }
    pre {
      background: #0f172a;
      color: #e2e8f0;
      padding: 1.25rem;
      border-radius: 8px;
      overflow-x: auto;
      line-height: 1.6;
    }
    pre code { background: none; padding: 0; font-size: 0.9rem; color: inherit; }
    blockquote {
      border-left: 4px solid #6366f1;
      margin: 1.25rem 0;
      padding: 0.75rem 1.25rem;
      background: #f8f7ff;
      border-radius: 0 6px 6px 0;
      color: #4a4a7a;
    }
    table { width: 100%; border-collapse: collapse; margin: 1.25rem 0; }
    th { background: #f1f5f9; font-weight: 600; }
    th, td { border: 1px solid #e2e8f0; padding: 0.6rem 1rem; text-align: left; }
    tr:nth-child(even) td { background: #f8fafc; }
    ul, ol { margin: 0.75rem 0 0.75rem 1.5rem; }
    li { margin: 0.3rem 0; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    .doc-meta {
      font-size: 0.8rem;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      margin-top: 4rem;
      padding-top: 1rem;
    }
  </style>
</head>
<body>
${String(file)}
<div class="doc-meta">Exported from Docs Platform · ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export async function exportAsPdf(raw: string): Promise<Buffer> {
  const { body, title } = stripFrontmatter(raw);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margins: { top: 60, bottom: 60, left: 72, right: 72 },
      info: { Title: title, Creator: "Docs Platform" },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#0f0f23")
      .text(title, { align: "left" });
    doc.moveDown(0.5);

    // Thin rule
    doc
      .moveTo(72, doc.y)
      .lineTo(doc.page.width - 72, doc.y)
      .lineWidth(0.5)
      .strokeColor("#c7d2fe")
      .stroke();
    doc.moveDown(1);

    // Parse and render markdown line by line
    const lines = body.split("\n");
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    function flushCodeBlock() {
      if (codeBlockLines.length > 0) {
        doc
          .font("Courier")
          .fontSize(9)
          .fillColor("#e2e8f0")
          .rect(
            72,
            doc.y,
            doc.page.width - 144,
            codeBlockLines.length * 14 + 20,
          )
          .fill("#0f172a")
          .fillColor("#e2e8f0")
          .text(
            codeBlockLines.join("\n"),
            82,
            doc.y - codeBlockLines.length * 14 - 16,
            {
              lineGap: 3,
            },
          );
        doc.moveDown(1);
        codeBlockLines = [];
      }
    }

    for (const line of lines) {
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          flushCodeBlock();
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      if (line.startsWith("# ")) {
        doc
          .font("Helvetica-Bold")
          .fontSize(18)
          .fillColor("#0f0f23")
          .text(line.slice(2), { paragraphGap: 5 });
        doc.moveDown(0.3);
      } else if (line.startsWith("## ")) {
        doc.moveDown(0.5);
        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#1e1b4b")
          .text(line.slice(3), { paragraphGap: 4 });
        doc.moveDown(0.2);
      } else if (line.startsWith("### ")) {
        doc.moveDown(0.3);
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#312e81")
          .text(line.slice(4), { paragraphGap: 3 });
        doc.moveDown(0.1);
      } else if (line.startsWith("> ")) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(10)
          .fillColor("#6366f1")
          .text(line.slice(2), { indent: 12, lineGap: 2 });
        doc.moveDown(0.3);
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        const text = stripInlineMarkdown(line.slice(2));
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#1a1a2e")
          .text(`• ${text}`, { indent: 12, lineGap: 2 });
      } else if (/^\d+\.\s/.test(line)) {
        const text = stripInlineMarkdown(line.replace(/^\d+\.\s/, ""));
        const num = line.match(/^(\d+)\./)?.[1] ?? "1";
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#1a1a2e")
          .text(`${num}. ${text}`, { indent: 12, lineGap: 2 });
      } else if (line.startsWith("---") && line.length <= 6) {
        doc.moveDown(0.5);
        doc
          .moveTo(72, doc.y)
          .lineTo(doc.page.width - 72, doc.y)
          .lineWidth(0.5)
          .strokeColor("#e2e8f0")
          .stroke();
        doc.moveDown(0.5);
      } else if (line.trim() === "") {
        doc.moveDown(0.4);
      } else {
        const text = stripInlineMarkdown(line);
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#1a1a2e")
          .text(text, { lineGap: 2 });
      }
    }

    // Footer
    doc.moveDown(2);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#94a3b8")
      .text(
        `Exported from Docs Platform · ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        { align: "center" },
      );

    doc.end();
  });
}

// ─── LaTeX Export ─────────────────────────────────────────────────────────────

export async function exportAsLatex(raw: string): Promise<Buffer> {
  const { body, title, description } = stripFrontmatter(raw);
  const lines = body.split("\n");
  const latexLines: string[] = [];

  const preamble = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{geometry}
\\geometry{margin=2.5cm}
\\usepackage{hyperref}
\\hypersetup{colorlinks=true, linkcolor=blue, urlcolor=blue}
\\usepackage{listings}
\\lstset{basicstyle=\\ttfamily\\small, breaklines=true, frame=single}
\\usepackage{xcolor}
\\usepackage{booktabs}
\\usepackage{enumitem}

\\title{${escapeLatex(title)}}
${description ? `\\date{${escapeLatex(description)}}` : `\\date{\\today}`}
\\author{Docs Platform}

\\begin{document}
\\maketitle
`;

  let inCodeBlock = false;
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        latexLines.push("\\end{lstlisting}");
        inCodeBlock = false;
      } else {
        if (inList) {
          latexLines.push("\\end{itemize}");
          inList = false;
        }
        const lang = line.slice(3).trim();
        latexLines.push(
          `\\begin{lstlisting}${lang ? `[language=${lang}]` : ""}`,
        );
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      latexLines.push(line);
      continue;
    }

    // headings
    if (line.startsWith("# ")) {
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push(`\\section{${escapeLatex(line.slice(2).trim())}}`);
    } else if (line.startsWith("## ")) {
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push(`\\subsection{${escapeLatex(line.slice(3).trim())}}`);
    } else if (line.startsWith("### ")) {
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push(`\\subsubsection{${escapeLatex(line.slice(4).trim())}}`);
    } else if (line.startsWith("#### ")) {
      latexLines.push(`\\paragraph{${escapeLatex(line.slice(5).trim())}}`);
    } else if (line.startsWith("> ")) {
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push(
        `\\begin{quote}${escapeLatex(line.slice(2))}\\end{quote}`,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        latexLines.push("\\begin{itemize}");
        inList = true;
      }
      latexLines.push(`  \\item ${inlineLatex(line.slice(2))}`);
    } else if (/^\d+\.\s/.test(line)) {
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push(`\\begin{enumerate}`);
      latexLines.push(`  \\item ${inlineLatex(line.replace(/^\d+\.\s/, ""))}`);
      latexLines.push(`\\end{enumerate}`);
    } else if (line.match(/^---+$/)) {
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push("\\hrule\\medskip");
    } else if (line.trim() === "") {
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push("");
    } else {
      // regular paragraph — check if previous line was also paragraph
      if (inList) {
        latexLines.push("\\end{itemize}");
        inList = false;
      }
      latexLines.push(inlineLatex(line));
    }
  }

  if (inList) latexLines.push("\\end{itemize}");

  const latex = preamble + latexLines.join("\n") + "\n\n\\end{document}\n";
  return Buffer.from(latex, "utf-8");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeLatex(str: string): string {
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}");
}

/** Minimal inline markdown → plain text for PDF renderer */
function stripInlineMarkdown(txt: string): string {
  return txt
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/** Inline markdown → LaTeX equivalents */
function inlineLatex(txt: string): string {
  let t = escapeLatex(txt);
  // Re-apply bold/italic/code AFTER escaping
  t = t.replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}");
  t = t.replace(/\*(.+?)\*/g, "\\textit{$1}");
  t = t.replace(/`(.+?)`/g, "\\texttt{$1}");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "\\href{$2}{$1}");
  return t;
}
