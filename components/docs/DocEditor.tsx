"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCsrf } from "@/components/providers/CsrfProvider";
import { refreshDocs } from "@/app/actions/docs";

interface DocEditorProps {
  stream: string;
  slug: string[];
  initialContent: string;
  title: string;
}

export default function DocEditor({
  stream,
  slug,
  initialContent,
  title,
}: DocEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const { csrfToken, ready } = useCsrf(); // ← shared token, no independent fetch
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
        body: JSON.stringify({ stream, slug, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Let the server action handle cache purges fully
      await refreshDocs();
      router.refresh();
    } catch {
      setError("Network error — save failed.");
    } finally {
      setSaving(false);
    }
  }, [csrfToken, saving, stream, slug, content, router]);

  // Cmd+S / Ctrl+S shortcut
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

  // Load fresh raw MDX when entering edit mode
  async function enterEdit() {
    try {
      const res = await fetch(
        `/api/docs/raw?stream=${encodeURIComponent(stream)}&slug=${encodeURIComponent(slug.join("/"))}`,
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

  if (!isEditing) {
    return (
      <button className="btn-edit" onClick={enterEdit} title="Edit this page">
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
        Edit
      </button>
    );
  }

  return (
    <div className="doc-editor-overlay">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
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
          <span>
            Editing: <strong>{title}</strong>
          </span>
          <span className="editor-hint">⌘S to save</span>
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
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--text-3)",
              marginBottom: "0.25rem",
              fontFamily: "var(--ff-mono)",
            }}
          >
            {stream}/{slug.join("/")}.mdx
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
            Edit frontmatter (---) and MDX body below.
          </div>
        </div>
        <textarea
          className="editor-textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          autoFocus
          placeholder={
            '---\ntitle: "Your Title"\ndescription: ""\norder: 1\n---\n\n# Your heading\n\nWrite MDX here…'
          }
        />
      </div>
    </div>
  );
}
