"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCsrf } from "@/components/providers/CsrfProvider";
import type { StreamMeta } from "@/lib/docs/streams";
import {
  FileText,
  Laptop,
  BarChart2,
  Rocket,
  Wrench,
  Palette,
  TrendingUp,
  Building2,
  Edit3,
  Lock,
  Globe,
  Zap,
  Trash2,
  Plus,
} from "lucide-react";

type Mode = "create" | "edit";

interface StreamManageModalProps {
  mode: Mode;
  stream?: StreamMeta; // for edit mode
  onClose: () => void;
}

const ICONS = [
  "📄",
  "💻",
  "📊",
  "🚀",
  "🔧",
  "🎨",
  "📈",
  "🏢",
  "📝",
  "🔒",
  "🌐",
  "⚡",
];

export const StreamIconMap: Record<
  string,
  React.ComponentType<{ size?: number }>
> = {
  "📄": FileText,
  "💻": Laptop,
  "📊": BarChart2,
  "🚀": Rocket,
  "🔧": Wrench,
  "🎨": Palette,
  "📈": TrendingUp,
  "🏢": Building2,
  "📝": Edit3,
  "🔒": Lock,
  "🌐": Globe,
  "⚡": Zap,
};

const COLORS = ["blue", "purple", "green", "orange", "gray"] as const;

export default function StreamManageModal({
  mode,
  stream,
  onClose,
}: StreamManageModalProps) {
  const router = useRouter();
  const { csrfToken } = useCsrf();

  const [label, setLabel] = useState(stream?.label ?? "");
  const [description, setDescription] = useState(stream?.description ?? "");
  const [icon, setIcon] = useState(stream?.icon ?? "📄");
  const [color, setColor] = useState<string>(stream?.color ?? "blue");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csrfToken || loading) return;
    setLoading(true);
    setError("");

    try {
      if (mode === "create") {
        const res = await fetch("/api/docs/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            type: "stream",
            title: label,
            meta: { description, icon, color },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Create failed");
          return;
        }
      } else {
        const res = await fetch("/api/docs/update-stream", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          body: JSON.stringify({
            stream: stream!.slug,
            label,
            description,
            icon,
            color,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Update failed");
          return;
        }
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!csrfToken) return;
    if (
      !window.confirm(
        `Delete the entire "${stream?.label}" stream and ALL its content? This CANNOT be undone.`,
      )
    )
      return;
    setLoading(true);
    try {
      const res = await fetch("/api/docs/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ type: "stream", stream: stream!.slug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        setLoading(false);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-card">
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {mode === "create" ? (
            <>
              <Plus size={20} /> New Stream
            </>
          ) : (
            `Edit: ${stream?.label}`
          )}
        </h2>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label>Display Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Engineering"
              required
              maxLength={100}
            />
          </div>

          <div className="modal-field">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of this stream"
              maxLength={200}
            />
          </div>

          <div className="modal-field">
            <label>Icon</label>
            <div className="icon-picker">
              {ICONS.map((i) => {
                const IconComponent = StreamIconMap[i] || FileText;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`icon-option${icon === i ? " selected" : ""}`}
                    onClick={() => setIcon(i)}
                  >
                    <IconComponent size={20} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="modal-field">
            <label>Color</label>
            <div className="color-picker">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch color-swatch-${c}${color === c ? " selected" : ""}`}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div className="modal-btns">
            {mode === "edit" && (
              <button
                type="button"
                onClick={handleDelete}
                className="btn-delete-stream"
                disabled={loading}
                style={{
                  marginRight: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Trash2 size={16} /> Delete Stream
              </button>
            )}
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !label.trim()}
            >
              {loading
                ? "Saving…"
                : mode === "create"
                  ? "Create"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
