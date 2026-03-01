"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition } from "react";
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

  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [newParentSlug, setNewParentSlug] = useState<string | null>(null);

  async function handleCreate(type: "doc" | "folder") {
    if (!newTitle.trim() || creating || !csrfToken) return;
    setCreating(true);
    try {
      const safeName = newTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-");
      const basePath = newParentSlug ? newParentSlug.split("/").slice(1) : [];
      const safePath = [...basePath, safeName];

      const res = await fetch("/api/docs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({
          type,
          stream: currentStream,
          slugPath: safePath,
          title: newTitle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Create failed");
        return;
      }
      setNewTitle("");
      setShowNewDoc(false);
      setShowNewFolder(false);
      setNewParentSlug(null);

      await refreshDocs();

      startTransition(() => {
        router.refresh();
        if (type === "doc" && data.slug) {
          router.push(`/docs/${currentStream}/${data.slug}`);
        }
      });
    } catch {
      alert("Network error.");
    } finally {
      setCreating(false);
    }
  }

  const parentName = newParentSlug?.split("/").pop() || "";

  return (
    <aside className="docs-sidebar-wrap" aria-label="Documentation navigation">
      <div className="sidebar-inner">
        <div className="sidebar-stream-header">
          <BookOpen size={18} className="sidebar-stream-icon" />
          {stream.toUpperCase()}
        </div>

        {canWrite && ready && (
          <div className="sidebar-write-actions">
            <button
              className="sidebar-action-btn"
              onClick={() => {
                setShowNewDoc(true);
                setShowNewFolder(false);
                setNewTitle("");
                setNewParentSlug(null);
              }}
            >
              <FilePlus2 size={15} /> New Page
            </button>
            <button
              className="sidebar-action-btn"
              onClick={() => {
                setShowNewFolder(true);
                setShowNewDoc(false);
                setNewTitle("");
                setNewParentSlug(null);
              }}
            >
              <FolderPlus size={15} /> New Folder
            </button>
          </div>
        )}

        {(showNewDoc || showNewFolder) && (
          <div className="sidebar-new-form">
            <input
              autoFocus
              type="text"
              placeholder={
                showNewDoc
                  ? parentName
                    ? `Page in ${parentName}…`
                    : "Page title…"
                  : parentName
                    ? `Folder in ${parentName}…`
                    : "Folder name…"
              }
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  handleCreate(showNewDoc ? "doc" : "folder");
                if (e.key === "Escape") {
                  setShowNewDoc(false);
                  setShowNewFolder(false);
                  setNewTitle("");
                  setNewParentSlug(null);
                }
              }}
            />
            <div className="sidebar-new-form-btns">
              <button
                onClick={() => handleCreate(showNewDoc ? "doc" : "folder")}
                disabled={creating || !newTitle.trim()}
              >
                {creating ? "…" : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowNewDoc(false);
                  setShowNewFolder(false);
                  setNewTitle("");
                  setNewParentSlug(null);
                }}
                title="Cancel"
                className="sidebar-cancel-btn"
              >
                ✕
              </button>
            </div>
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
            onAddInside={(parent, t) => {
              setNewParentSlug(parent);
              if (t === "doc") {
                setShowNewDoc(true);
                setShowNewFolder(false);
              } else {
                setShowNewFolder(true);
                setShowNewDoc(false);
              }
              setNewTitle("");
              // Scroll to top so the input is visible
              document
                .querySelector(".docs-sidebar-wrap")
                ?.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </ul>
      </div>
    </aside>
  );
}

interface ItemsProps {
  items: SidebarItem[];
  pathname: string;
  canWrite?: boolean;
  currentStream?: string;
  csrfToken: string;
  onRefresh: () => void | Promise<void>;
  onAddInside: (parentSlug: string, type: "doc" | "folder") => void;
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

  // A folder is "naturally open" if the current page lives inside it
  const containsActive = pathname.startsWith(href + "/") || pathname === href;

  // Folders: closed by default, auto-open if containsActive
  const [open, setOpen] = useState(containsActive);

  // Re-open automatically when navigating into this folder
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

    // Derive slugPath from item.slug: strip the stream prefix
    const slugParts = item.slug.split("/").slice(1); // remove stream prefix

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
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Delete failed");
      return;
    }

    await onRefresh();
    // If we were viewing the deleted page, go to stream root
    if (pathname.startsWith(href)) router.push(`/docs/${currentStream}`);
  }

  if (!item.isFolder) {
    return (
      <li className="sidebar-item sidebar-item-row">
        <Link
          href={href}
          className={`sidebar-link${isActive ? " active" : ""}`}
          title={item.description}
        >
          <FileText size={14} className="sidebar-item-icon" />
          {item.title}
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
