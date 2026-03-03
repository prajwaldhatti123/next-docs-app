"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCsrf } from "@/components/providers/CsrfProvider";
import { refreshDocs } from "@/app/actions/docs";
import type { DocFormat } from "@/lib/docs/write";

interface DocEditorProps {
  stream: string;
  slug: string[];
  initialContent: string;
  title: string;
  format: DocFormat;
}

// ─── Per-format metadata ──────────────────────────────────────────────────────

const FORMAT_LABEL: Record<DocFormat, string> = {
  mdx: "MDX",
  html: "HTML",
  tex: "LaTeX",
};

const FORMAT_COLOR: Record<DocFormat, string> = {
  mdx: "var(--c-tech, #4f8ef7)",
  html: "#e34c26",
  tex: "#1a7b4b",
};

const FORMAT_HINT: Record<DocFormat, string> = {
  mdx: "⌘S to save  ·  Frontmatter + Markdown + JSX",
  html: "⌘S to save  ·  Full HTML — use tags like <h2>, <p>, <code>",
  tex: "⌘S to save  ·  LaTeX — \\section{}, \\textbf{}, \\begin{lstlisting}",
};

const FORMAT_PLACEHOLDER: Record<DocFormat, string> = {
  mdx: `---\ntitle: "My Page"\ndescription: ""\norder: 1\n---\n\n# My Page\n\nWrite MDX here…`,
  html: `<!DOCTYPE html>\n<html lang="en">\n<head><title>My Page</title></head>\n<body>\n\n<h1>My Page</h1>\n<p>Write HTML here…</p>\n\n</body>\n</html>`,
  tex: `\\documentclass{article}\n\\title{My Page}\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\nWrite LaTeX here…\n\n\\end{document}`,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocEditor({
  stream,
  slug,
  initialContent,
  title,
  format,
}: DocEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { csrfToken, ready } = useCsrf();
  const router = useRouter();

  const handleSave = useCallback(async () => {
    if (!csrfToken || saving) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/docs/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ stream, slug, content, format }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await refreshDocs();
      router.refresh();
    } catch {
      setError("Network error — save failed.");
    } finally {
      setSaving(false);
    }
  }, [csrfToken, saving, stream, slug, content, format, router]);

  // ⌘S / Ctrl+S
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing, handleSave]);

  // Load fresh source on edit open
  async function enterEdit() {
    try {
      const res = await fetch(
        `/api/docs/raw?stream=${encodeURIComponent(stream)}&slug=${encodeURIComponent(slug.join("/"))}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const d = await res.json();
        setContent(d.content);
      }
    } catch {
      /* fall back to initialContent */
    }
    setIsEditing(true);
  }

  // ─── Collapsed (just the "Edit" button) ──────────────────────────────────
  if (!isEditing) {
    return (
      <button className="btn-edit" onClick={enterEdit} title="Edit this page">
        <EditIcon />
        Edit
      </button>
    );
  }

  // ─── Full-screen editor overlay ───────────────────────────────────────────
  return (
    <div className="doc-editor-overlay">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <EditIcon />
          <span>
            Editing: <strong>{title}</strong>
          </span>
          <span
            className="format-badge"
            style={
              { "--fmt-color": FORMAT_COLOR[format] } as React.CSSProperties
            }
          >
            {FORMAT_LABEL[format]}
          </span>
          <span className="editor-hint">{FORMAT_HINT[format]}</span>
        </div>
        <div className="editor-toolbar-right">
          {error && <span className="editor-error">{error}</span>}
          {saved && <span className="editor-saved">✓ Saved</span>}
          <button
            className="btn-editor-cancel"
            onClick={() => setIsEditing(false)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn-editor-save"
            onClick={handleSave}
            disabled={saving || !ready}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="editor-body">
        <div className="editor-meta">
          <div className="editor-file-path">
            {stream}/{slug.join("/")}.
            {format === "mdx" ? "mdx" : format === "html" ? "html" : "tex"}
          </div>
          <div className="editor-format-info">
            {format === "mdx" && "Edit frontmatter (---) and MDX body below."}
            {format === "html" &&
              "Full HTML document. Modify the <body> content or structure."}
            {format === "tex" &&
              "LaTeX source. Use \\section{}, \\textbf{}, \\begin{lstlisting} etc."}
          </div>
        </div>
        <textarea
          className={`editor-textarea editor-textarea--${format}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          autoFocus
          placeholder={FORMAT_PLACEHOLDER[format]}
        />
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
