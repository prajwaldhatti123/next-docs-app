"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Folder,
  FolderOpen,
  Plus,
  FilePlus2,
  FolderPlus,
  Trash2,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import type { SidebarItem } from "@/lib/docs/sidebar";
import { useCsrf } from "@/components/providers/CsrfProvider";
import { refreshDocs } from "@/app/actions/docs";
import CreateModal, { CreateModalMode } from "@/components/docs/CreateModal";

interface SidebarProps {
  items: SidebarItem[];
  stream: string;
  canWrite?: boolean;
  currentStream?: string;
}

export default function Sidebar({
  items,
  stream,
  canWrite,
  currentStream,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { csrfToken, ready } = useCsrf();

  const [modalMode, setModalMode] = useState<CreateModalMode | null>(null);
  const [modalParentSlug, setModalParentSlug] = useState<string | null>(null);

  const openCreateModal = (
    mode: CreateModalMode,
    parentSlug: string | null = null,
  ) => {
    setModalParentSlug(parentSlug);
    setModalMode(mode);
  };

  const closeCreateModal = () => {
    setModalMode(null);
    setModalParentSlug(null);
  };

  return (
    <aside className="docs-sidebar-wrap" aria-label="Documentation navigation">
      <div className="sidebar-inner">
        {canWrite && ready && (
          <div className="sidebar-write-actions">
            <button
              className="sidebar-action-btn"
              onClick={() => openCreateModal("doc")}
              title="Create new page in root"
            >
              <FilePlus2 size={15} /> New Page
            </button>
            <button
              className="sidebar-action-btn"
              onClick={() => openCreateModal("folder")}
              title="Create new folder in root"
            >
              <FolderPlus size={15} /> New Folder
            </button>
          </div>
        )}

        <ul className="sidebar-nav" role="list">
          <SidebarItems
            items={items}
            pathname={pathname}
            canWrite={canWrite}
            currentStream={currentStream}
            csrfToken={csrfToken}
            onRefresh={async () => {
              await refreshDocs();
              router.refresh();
            }}
            onAddInside={(parent, t) => openCreateModal(t, parent)}
          />
        </ul>
      </div>

      {/* Creation Modal */}
      {modalMode && (
        <CreateModal
          mode={modalMode}
          stream={currentStream || stream.toLowerCase()}
          parentSlug={modalParentSlug}
          csrfToken={csrfToken}
          onClose={closeCreateModal}
          onCreated={() => closeCreateModal()}
        />
      )}
    </aside>
  );
}

// ─── SidebarItems / SidebarNode ───────────────────────────────────────────────

interface ItemsProps {
  items: SidebarItem[];
  pathname: string;
  canWrite?: boolean;
  currentStream?: string;
  csrfToken: string;
  onRefresh: () => void | Promise<void>;
  onAddInside: (parentSlug: string, type: CreateModalMode) => void;
}

function SidebarItems(props: ItemsProps) {
  return (
    <>
      {props.items.map((item) => (
        <SidebarNode key={item.slug} item={item} {...props} />
      ))}
    </>
  );
}

const FORMAT_DOT: Record<string, string> = {
  mdx: "#4f8ef7",
  html: "#e34c26",
  tex: "#1a7b4b",
};

function SidebarNode({
  item,
  pathname,
  canWrite,
  currentStream,
  csrfToken,
  onRefresh,
  onAddInside,
}: ItemsProps & { item: SidebarItem }) {
  const router = useRouter();
  const href = `/docs/${item.slug}`;
  const containsActive = pathname.startsWith(href + "/") || pathname === href;
  const [open, setOpen] = useState(containsActive);

  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  const isActive = pathname === href;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const type = item.isFolder ? "folder" : "doc";
    const label = item.isFolder ? "folder and ALL its contents" : "page";
    if (
      !window.confirm(`Delete ${label} "${item.title}"? This cannot be undone.`)
    )
      return;

    const slugParts = item.slug.split("/").slice(1);
    const res = await fetch("/api/docs/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({
        type,
        stream: currentStream,
        slugPath: slugParts,
        format: item.format,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Delete failed");
      return;
    }

    await onRefresh();
    if (pathname.startsWith(href)) router.push(`/docs/${currentStream}`);
  }

  if (!item.isFolder) {
    const dotColor = item.format ? FORMAT_DOT[item.format] : undefined;
    return (
      <li className="sidebar-item sidebar-item-row">
        <Link
          href={href}
          className={`sidebar-link${isActive ? " active" : ""}`}
          title={item.description}
        >
          <FileText size={14} className="sidebar-item-icon" />
          <span className="sidebar-item-title">{item.title}</span>
          {item.format && (
            <span
              className="sidebar-format-tag"
              style={
                {
                  "--fmt-color": FORMAT_DOT[item.format],
                } as React.CSSProperties
              }
            >
              {item.format === "mdx"
                ? "MD"
                : item.format === "html"
                  ? "HTML"
                  : "TEX"}
            </span>
          )}
        </Link>
        {canWrite && (
          <button
            className="sidebar-delete-btn"
            onClick={handleDelete}
            title={`Delete "${item.title}"`}
            aria-label="Delete"
          >
            <Trash2 size={14} />
          </button>
        )}
      </li>
    );
  }

  return (
    <li className="sidebar-item">
      <div className="sidebar-folder-row">
        <button
          className="sidebar-folder-btn"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <span className="sidebar-folder-icon">
            {open ? <FolderOpen size={15} /> : <Folder size={15} />}
          </span>
          {item.title}
          <ChevronRight
            size={14}
            className={`sidebar-folder-chevron${open ? " open" : ""}`}
          />
        </button>
        {canWrite && (
          <div className="sidebar-node-actions">
            <button
              className="sidebar-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAddInside(item.slug, "doc");
              }}
              title={`New Page in ${item.title}`}
            >
              <Plus size={14} />
              <span className="sr-only">New Page</span>
            </button>
            <button
              className="sidebar-delete-btn"
              onClick={handleDelete}
              title={`Delete folder "${item.title}"`}
              aria-label="Delete folder"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {open && item.children && (
        <ul className="sidebar-children sidebar-nav" role="list">
          <SidebarItems
            items={item.children}
            pathname={pathname}
            canWrite={canWrite}
            currentStream={currentStream}
            csrfToken={csrfToken}
            onRefresh={onRefresh}
            onAddInside={onAddInside}
          />
        </ul>
      )}
    </li>
  );
}
