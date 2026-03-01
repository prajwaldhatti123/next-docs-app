"use client";

import { useState } from "react";
import type { StreamMeta } from "@/lib/docs/streams";
import Link from "next/link";
import StreamManageModal, { StreamIconMap } from "./StreamManageModal";
import { FileText } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  blue: "var(--c-tech)",
  purple: "var(--c-marketing)",
  green: "var(--c-sales)",
  orange: "var(--c-hr)",
  gray: "#6B7280",
};

interface StreamCardProps {
  stream: StreamMeta;
  index: number;
  isAdmin?: boolean;
}

export default function StreamCard({
  stream,
  index,
  isAdmin,
}: StreamCardProps) {
  const [showEdit, setShowEdit] = useState(false);
  const color = COLOR_MAP[stream.color] ?? COLOR_MAP.gray;
  const IconComponent = StreamIconMap[stream.icon] || FileText;

  return (
    <>
      <div
        className="stream-card"
        style={{
          ["--card-color" as string]: color,
          animationDelay: `${index * 60}ms`,
        }}
      >
        <Link href={`/docs/${stream.slug}`} className="stream-card-content">
          <div className="stream-card-icon">
            <IconComponent size={20} />
          </div>
          <div className="stream-card-name">{stream.label}</div>
          <div className="stream-card-desc">{stream.description}</div>
          <div className="stream-card-open">
            Open docs <span aria-hidden="true">→</span>
          </div>
        </Link>

        {isAdmin && (
          <button
            className="stream-card-edit-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowEdit(true);
            }}
            title="Edit Stream Settings"
          >
            ⚙️ Edit
          </button>
        )}
      </div>

      {showEdit && (
        <StreamManageModal
          mode="edit"
          stream={stream}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
