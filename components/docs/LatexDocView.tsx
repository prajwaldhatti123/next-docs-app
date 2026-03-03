"use client";

interface LatexDocViewProps {
  content: string;
}

/**
 * Renders a LaTeX (.tex) file as a structured document view.
 * Since we can't compile LaTeX in the browser, we parse the structure
 * and render it in a readable, syntax-highlighted format.
 */
export default function LatexDocView({ content }: LatexDocViewProps) {
  const sections = parseLatex(content);

  return (
    <div className="latex-doc">
      <div className="latex-doc-header">
        <span className="latex-format-badge">
          <TexIcon /> LaTeX Document
        </span>
        <span className="latex-doc-hint">
          Rendered preview — edit the source to modify
        </span>
      </div>

      <div className="latex-doc-body">
        {sections.map((block, i) => {
          if (block.type === "title")
            return (
              <h1 key={i} className="latex-title">
                {block.text}
              </h1>
            );
          if (block.type === "author")
            return (
              <p key={i} className="latex-author">
                {block.text}
              </p>
            );
          if (block.type === "date")
            return (
              <p key={i} className="latex-date">
                {block.text}
              </p>
            );
          if (block.type === "section")
            return (
              <h2 key={i} className="latex-section">
                {block.text}
              </h2>
            );
          if (block.type === "subsection")
            return (
              <h3 key={i} className="latex-subsection">
                {block.text}
              </h3>
            );
          if (block.type === "subsubsection")
            return (
              <h4 key={i} className="latex-subsubsection">
                {block.text}
              </h4>
            );
          if (block.type === "verbatim")
            return (
              <pre key={i} className="latex-verbatim">
                <code>{block.text}</code>
              </pre>
            );
          if (block.type === "math")
            return (
              <div key={i} className="latex-math-block">
                <code>{block.text}</code>
              </div>
            );
          if (block.type === "paragraph" && block.text.trim())
            return (
              <p key={i} className="latex-para">
                {renderInlineLatex(block.text)}
              </p>
            );
          return null;
        })}
      </div>
    </div>
  );
}

// ─── Parser ───────────────────────────────────────────────────────────────────

type Block = {
  type:
    | "title"
    | "author"
    | "date"
    | "section"
    | "subsection"
    | "subsubsection"
    | "paragraph"
    | "verbatim"
    | "math";
  text: string;
};

function parseLatex(src: string): Block[] {
  const blocks: Block[] = [];

  // Extract document body (between \begin{document} and \end{document})
  const bodyMatch = src.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  const body = bodyMatch ? bodyMatch[1] : src;

  // Extract preamble meta
  const title = src.match(/\\title\{([^}]+)\}/)?.[1];
  const author = src.match(/\\author\{([^}]*)\}/)?.[1];
  const dateRaw = src.match(/\\date\{([^}]*)\}/)?.[1];

  if (title) blocks.push({ type: "title", text: title.trim() });
  if (author) blocks.push({ type: "author", text: author.trim() });
  if (dateRaw && dateRaw !== "\\today")
    blocks.push({ type: "date", text: dateRaw.trim() });
  else if (dateRaw === "\\today")
    blocks.push({
      type: "date",
      text: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

  // Skip \maketitle
  const lines = body.split("\n");
  let current = "";
  let i = 0;

  function flush() {
    const t = current.trim();
    if (t && !t.startsWith("\\maketitle") && !t.startsWith("%")) {
      blocks.push({ type: "paragraph", text: t });
    }
    current = "";
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code / verbatim environment
    if (
      trimmed.startsWith("\\begin{lstlisting}") ||
      trimmed.startsWith("\\begin{verbatim}")
    ) {
      flush();
      const endToken = trimmed.includes("lstlisting")
        ? "\\end{lstlisting}"
        : "\\end{verbatim}";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].includes(endToken)) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "verbatim", text: codeLines.join("\n") });
      i++;
      continue;
    }

    // Math environment
    if (
      trimmed.startsWith("\\begin{equation}") ||
      trimmed.startsWith("\\begin{align}") ||
      trimmed.startsWith("\\[")
    ) {
      flush();
      const endToken = trimmed.includes("equation")
        ? "\\end{equation}"
        : trimmed.includes("align")
          ? "\\end{align}"
          : "\\]";
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].includes(endToken)) {
        mathLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "math", text: mathLines.join("\n") });
      i++;
      continue;
    }

    // Sections
    const secMatch =
      trimmed.match(/^\\subsubsection\{([^}]+)\}/) ??
      trimmed.match(/^\\subsection\{([^}]+)\}/) ??
      trimmed.match(/^\\section\{([^}]+)\}/);

    if (secMatch) {
      flush();
      const secType = trimmed.startsWith("\\subsubsection")
        ? "subsubsection"
        : trimmed.startsWith("\\subsection")
          ? "subsection"
          : "section";
      blocks.push({ type: secType, text: secMatch[1] });
      i++;
      continue;
    }

    // Ignore LaTeX commands / blank lines between paragraphs
    if (trimmed === "" && current.trim()) {
      flush();
      i++;
      continue;
    }
    if (
      !trimmed.startsWith("\\") ||
      trimmed.startsWith("\\textbf") ||
      trimmed.startsWith("\\textit") ||
      trimmed.startsWith("\\href")
    ) {
      current += (current ? " " : "") + trimmed;
    }
    i++;
  }
  flush();

  return blocks;
}

/** Render a small subset of inline LaTeX → React spans */
function renderInlineLatex(text: string): React.ReactNode {
  // Bold: \textbf{...}
  const parts = text.split(
    /\\textbf\{([^}]+)\}|\\textit\{([^}]+)\}|\\texttt\{([^}]+)\}/,
  );
  if (parts.length === 1) return text;

  const result: React.ReactNode[] = [];
  const rx = /\\textbf\{([^}]+)\}|\\textit\{([^}]+)\}|\\texttt\{([^}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    if (m[1]) result.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[2]) result.push(<em key={m.index}>{m[2]}</em>);
    else if (m[3]) result.push(<code key={m.index}>{m[3]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}

function TexIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
