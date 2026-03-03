"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import { FilePlus2, FolderPlus, X, Loader2 } from "lucide-react";
import type { DocFormat } from "@/lib/docs/write";
import { refreshDocs } from "@/app/actions/docs";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateModalMode = "doc" | "folder";

interface CreateModalProps {
  mode: CreateModalMode;
  stream: string;
  /** Slug of the folder to create inside, e.g. "tech/setup". Null = root. */
  parentSlug: string | null;
  csrfToken: string;
  onClose: () => void;
  onCreated: (slug?: string) => void;
}

// ─── Format options ───────────────────────────────────────────────────────────

const FORMAT_OPTIONS: {
  value: DocFormat;
  label: string;
  ext: string;
  icon: string;
  color: string;
  description: string;
}[] = [
  {
    value: "mdx",
    label: "Markdown",
    ext: ".mdx",
    icon: "MD",
    color: "#4f8ef7",
    description: "MDX — Markdown + React components",
  },
  {
    value: "html",
    label: "HTML",
    ext: ".html",
    icon: "HTML",
    color: "#e34c26",
    description: "Full HTML document",
  },
  {
    value: "tex",
    label: "LaTeX",
    ext: ".tex",
    icon: "TeX",
    color: "#1a9e5d",
    description: "LaTeX — scientific / academic writing",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateModal({
  mode,
  stream,
  parentSlug,
  csrfToken,
  onClose,
  onCreated,
}: CreateModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<DocFormat>("mdx");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Lock body scroll and focus input on mount
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(t);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed || creating) return;
    setError("");
    setCreating(true);

    try {
      const safeName = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/, "");

      // parentSlug is like "tech/setup" — strip the stream prefix to get path segments
      const parentSegments = parentSlug ? parentSlug.split("/").slice(1) : [];
      const slugPath = [...parentSegments, safeName];

      const res = await fetch("/api/docs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          type: mode,
          stream,
          slugPath,
          title: trimmed,
          ...(mode === "doc" ? { format } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Create failed");
        return;
      }

      await refreshDocs();
      onCreated(data.slug);

      startTransition(() => {
        router.refresh();
        if (mode === "doc" && data.slug) {
          router.push(`/docs/${stream}/${data.slug}`);
        }
      });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setCreating(false);
    }
  }

  // ─── Derived UI ─────────────────────────────────────────────────────────────

  const parentName = parentSlug?.split("/").pop();
  const isDoc = mode === "doc";
  const activeFormat = FORMAT_OPTIONS.find((f) => f.value === format)!;

  return (
    <>
      {/* Backdrop */}
      <div
        className="create-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="create-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-modal-title"
      >
        {/* Header */}
        <div className="create-modal-header">
          <div className="create-modal-title-row">
            <span className="create-modal-icon">
              {isDoc ? <FilePlus2 size={18} /> : <FolderPlus size={18} />}
            </span>
            <h2 id="create-modal-title">{isDoc ? "New Page" : "New Folder"}</h2>
            {parentName && (
              <span className="create-modal-parent-tag">
                inside <strong>{parentName}</strong>
              </span>
            )}
          </div>
          <button
            className="create-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="create-modal-body">
          {/* Format picker — only for docs */}
          {isDoc && (
            <div className="create-modal-field">
              <label className="create-modal-label">Document Type</label>
              <div className="create-format-grid">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`create-format-card${format === opt.value ? " active" : ""}`}
                    style={{ "--fmt-color": opt.color } as React.CSSProperties}
                    onClick={() => setFormat(opt.value)}
                  >
                    <span className="create-format-card-badge">{opt.icon}</span>
                    <span className="create-format-card-label">
                      {opt.label}
                    </span>
                    <span className="create-format-card-ext">{opt.ext}</span>
                  </button>
                ))}
              </div>
              {/* Active format description */}
              <p className="create-format-desc">{activeFormat.description}</p>
            </div>
          )}

          {/* Title / Name input */}
          <div className="create-modal-field">
            <label className="create-modal-label" htmlFor="create-modal-input">
              {isDoc ? "Page Title" : "Folder Name"}
            </label>
            <input
              id="create-modal-input"
              ref={inputRef}
              type="text"
              className="create-modal-input"
              placeholder={
                isDoc ? "e.g. Getting Started" : "e.g. API Reference"
              }
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              autoComplete="off"
            />
            {/* Slug preview */}
            {title.trim() && (
              <p className="create-modal-slug-preview">
                <span>Saves as: </span>
                <code>
                  {stream}/
                  {parentSlug
                    ? parentSlug.split("/").slice(1).join("/") + "/"
                    : ""}
                  {title
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/, "")}
                  {isDoc
                    ? format === "mdx"
                      ? ".mdx"
                      : format === "html"
                        ? ".html"
                        : ".tex"
                    : "/"}
                </code>
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="create-modal-error" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="create-modal-footer">
          <button
            className="create-modal-btn-cancel"
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button
            className="create-modal-btn-create"
            onClick={handleCreate}
            disabled={!title.trim() || creating}
            style={
              {
                "--fmt-color": isDoc ? activeFormat.color : "#a855f7",
              } as React.CSSProperties
            }
          >
            {creating ? (
              <>
                <Loader2 size={14} className="spin-icon" />
                Creating…
              </>
            ) : (
              <>
                {isDoc ? <FilePlus2 size={14} /> : <FolderPlus size={14} />}
                {isDoc ? "Create Page" : "Create Folder"}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
