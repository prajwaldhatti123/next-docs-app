"use client";

import { useState } from "react";
import { Download, FileText, FileCode, FileType } from "lucide-react";

interface ExportButtonProps {
  stream: string;
  slug: string[];
}

type Format = "html" | "pdf" | "latex";

const FORMAT_OPTIONS: {
  value: Format;
  label: string;
  icon: React.ReactNode;
  ext: string;
}[] = [
  { value: "html", label: "HTML", icon: <FileCode size={14} />, ext: "html" },
  { value: "pdf", label: "PDF", icon: <FileText size={14} />, ext: "pdf" },
  { value: "latex", label: "LaTeX", icon: <FileType size={14} />, ext: "tex" },
];

export default function ExportButton({ stream, slug }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Format | null>(null);

  async function handleExport(format: Format) {
    if (loading) return;
    setLoading(format);
    setOpen(false);

    try {
      const url = `/api/docs/export?stream=${encodeURIComponent(stream)}&slug=${encodeURIComponent(slug.join("/"))}&format=${format}`;
      const res = await fetch(url);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Export failed");
        return;
      }

      // Trigger a browser download
      const blob = await res.blob();
      const ext = FORMAT_OPTIONS.find((f) => f.value === format)?.ext ?? format;
      const filename = `${slug.at(-1) ?? "doc"}.${ext}`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      alert("Network error — export failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="export-btn-wrap" style={{ position: "relative" }}>
      <button
        className="btn-export"
        onClick={() => setOpen((o) => !o)}
        disabled={loading !== null}
        title="Export document"
        aria-haspopup="listbox"
        aria-expanded={open}
        id="export-btn"
      >
        <Download size={14} />
        {loading ? `Exporting ${loading.toUpperCase()}…` : "Export"}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          {/* Overlay to close dropdown on outside click */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
            }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <ul
            className="export-dropdown"
            role="listbox"
            aria-label="Export format"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 50,
              listStyle: "none",
              margin: 0,
              padding: "4px",
              background: "var(--surface-2, #1e1e3a)",
              border: "1px solid var(--border, rgba(255,255,255,0.08))",
              borderRadius: "10px",
              minWidth: "140px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.36)",
              backdropFilter: "blur(10px)",
            }}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <li key={opt.value}>
                <button
                  onClick={() => handleExport(opt.value)}
                  disabled={loading !== null}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                    padding: "8px 12px",
                    background: "none",
                    border: "none",
                    borderRadius: "7px",
                    cursor: "pointer",
                    color: "var(--text-1, #e2e8f0)",
                    fontSize: "0.82rem",
                    fontFamily: "inherit",
                    fontWeight: 500,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--surface-3, rgba(255,255,255,0.07))";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "none";
                  }}
                  role="option"
                  aria-label={`Export as ${opt.label}`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.7rem",
                      color: "var(--text-3, #64748b)",
                    }}
                  >
                    .{opt.ext}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
