"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { getMediaType, ALL_MEDIA_EXTS, getExt } from "@/lib/media-utils";
import { uploadFile } from "@/lib/api";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/context/workspace-context";
import { InlineInput } from "@/components/inline-input";
import type { NoteTreeNode } from "@/types/notes";

export type TreeActions = {
  createNote: (path: string) => Promise<void>;
  deleteNote: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;
  renameFolder: (path: string, newPath: string) => Promise<void>;
  renameNote: (path: string, newPath: string) => Promise<void>;
};

type Props = {
  node: NoteTreeNode;
  actions: TreeActions;
  expandedPaths: Set<string>;
  onToggleExpanded: (path: string) => void;
  onExpandPath: (path: string) => void;
  onMove: (sourcePath: string, sourceType: "file" | "folder", targetFolderPath: string) => Promise<void>;
  depth?: number;
  isLast?: boolean;
};

const INDENT = 16;
const ROW_HEIGHT = 32;

function displayName(node: NoteTreeNode) {
  if (node.type === "file" && node.name.endsWith(".md")) {
    return node.name.slice(0, -3);
  }
  return node.name;
}

export function FileTreeNode({
  node,
  actions,
  expandedPaths,
  onToggleExpanded,
  onExpandPath,
  onMove,
  depth = 0,
  isLast = false,
}: Props) {
  const { openFilePath, setOpenFilePath } = useWorkspace();
  const isOpen = expandedPaths.has(node.path);
  const [isRenaming, setIsRenaming] = useState(false);
  const [pendingNew, setPendingNew] = useState<"file" | "folder" | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const autoExpandRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFile = node.type === "file";
  const isActive = isFile && openFilePath === node.path;
  const isEmpty = !isFile && (!node.children || node.children.length === 0);
  const showChildren = isOpen || pendingNew !== null;
  const paddingLeft = 10 + depth * INDENT;

  useEffect(() => {
    return () => {
      if (autoExpandRef.current) clearTimeout(autoExpandRef.current);
    };
  }, []);

  async function handleRename(newName: string) {
    if (!newName || newName === node.name) {
      setIsRenaming(false);
      return;
    }
    const parts = node.path.split("/");
    parts[parts.length - 1] = isFile && !newName.endsWith(".md") ? `${newName}.md` : newName;
    const newPath = parts.join("/");
    if (isFile) {
      await actions.renameNote(node.path, newPath);
    } else {
      await actions.renameFolder(node.path, newPath);
    }
    setIsRenaming(false);
  }

  async function handleCreate(name: string) {
    const fullPath = `${node.path}/${name}`;
    const finalPath =
      pendingNew === "file" && !fullPath.endsWith(".md") ? `${fullPath}.md` : fullPath;
    if (pendingNew === "file") {
      await actions.createNote(finalPath);
      onExpandPath(node.path);
      setOpenFilePath(finalPath);
    } else {
      await actions.createFolder(finalPath);
      onExpandPath(node.path);
    }
    setPendingNew(null);
  }

  async function handleDelete() {
    if (isFile) {
      setOpenFilePath(null);
      await actions.deleteNote(node.path);
    } else {
      await actions.deleteFolder(node.path);
    }
    setShowDelete(false);
  }

  function openNewItem(type: "file" | "folder") {
    onExpandPath(node.path);
    setPendingNew(type);
  }

  function handleDragStart(e: React.DragEvent) {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/x-dg-node",
      JSON.stringify({ path: node.path, type: node.type })
    );
    requestAnimationFrame(() => setIsDragging(true));
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    if (isFile) return;
    const hasExternalFiles = e.dataTransfer.types.includes("Files");
    const raw = e.dataTransfer.getData("application/x-dg-node");
    if (!hasExternalFiles && raw) {
      try {
        const { path: srcPath } = JSON.parse(raw) as { path: string; type: string };
        if (srcPath === node.path || node.path.startsWith(srcPath + "/")) return;
      } catch {
        /* ignore */
      }
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);

    if (!autoExpandRef.current) {
      autoExpandRef.current = setTimeout(() => {
        onExpandPath(node.path);
        autoExpandRef.current = null;
      }, 600);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      if (autoExpandRef.current) {
        clearTimeout(autoExpandRef.current);
        autoExpandRef.current = null;
      }
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (autoExpandRef.current) {
      clearTimeout(autoExpandRef.current);
      autoExpandRef.current = null;
    }

    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ALL_MEDIA_EXTS.has(getExt(f.name))
      );
      for (const f of files) {
        try {
          await uploadFile(f, node.path);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    const raw = e.dataTransfer.getData("application/x-dg-node");
    if (!raw) return;
    try {
      const { path: srcPath, type: srcType } = JSON.parse(raw) as {
        path: string;
        type: "file" | "folder";
      };
      if (srcPath === node.path || node.path.startsWith(srcPath + "/")) return;
      const srcParent = srcPath.split("/").slice(0, -1).join("/");
      if (srcParent === node.path) return;
      await onMove(srcPath, srcType, node.path);
    } catch {
      /* ignore */
    }
  }

  const itemClass = "gap-1.5 py-1";
  const uploadInputRef = useRef<HTMLInputElement>(null);

  async function handleUploadToFolder(files: FileList | null) {
    if (!files) return;
    const folder = isFile ? node.path.split("/").slice(0, -1).join("/") : node.path;
    const valid = Array.from(files).filter((f) => ALL_MEDIA_EXTS.has(getExt(f.name)));
    for (const f of valid) {
      try {
        await uploadFile(f, folder);
      } catch {
        /* ignore */
      }
    }
  }

  const menuItems = (variant: "context" | "dropdown") => {
    const Item = variant === "context" ? ContextMenuItem : DropdownMenuItem;
    const Sep = variant === "context" ? ContextMenuSeparator : DropdownMenuSeparator;
    return (
      <>
        {!isFile && (
          <>
            <Item className={itemClass} onSelect={() => openNewItem("file")}>
              <Icon name="note_add" size={16} /> New Note Here
            </Item>
            <Item className={itemClass} onSelect={() => openNewItem("folder")}>
              <Icon name="create_new_folder" size={16} /> New Folder Here
            </Item>
            <Item
              className={itemClass}
              onSelect={() => setTimeout(() => uploadInputRef.current?.click(), 0)}
            >
              <Icon name="upload" size={16} /> Upload Files Here
            </Item>
            <Sep />
          </>
        )}
        <Item className={itemClass} onSelect={() => setIsRenaming(true)}>
          <Icon name="edit" size={16} /> Rename
        </Item>
        <Sep />
        <Item className={itemClass} variant="destructive" onSelect={() => setShowDelete(true)}>
          <Icon name="delete" size={16} /> Delete
        </Item>
      </>
    );
  };

  const children = node.children ?? [];

  return (
    <div
      className="relative"
      onDragOver={!isFile ? handleDragOver : undefined}
      onDragLeave={!isFile ? handleDragLeave : undefined}
      onDrop={!isFile ? handleDrop : undefined}
    >
      {/* Ancestor guide lines */}
      {depth > 0 && (
        <div className="pointer-events-none absolute inset-y-0 left-0" aria-hidden>
          {Array.from({ length: depth }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 bottom-0 w-px bg-sidebar-border/70"
              style={{ left: 10 + i * INDENT + INDENT / 2 }}
            />
          ))}
        </div>
      )}

      {isRenaming ? (
        <div
          className="flex items-center rounded-sm bg-sidebar-accent/50 pr-2"
          style={{ height: ROW_HEIGHT, paddingLeft }}
        >
          <InlineInput
            defaultValue={displayName(node)}
            selectEnd={isFile ? displayName(node).length : undefined}
            onConfirm={handleRename}
            onCancel={() => setIsRenaming(false)}
          />
        </div>
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              draggable
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              className={cn(
                "group relative flex cursor-pointer items-center rounded-sm pr-2 text-sm leading-none transition-colors",
                isActive
                  ? "bg-[var(--dg-tree-selected-bg)] font-medium text-[var(--dg-tree-selected-fg)]"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                isEmpty && "opacity-60",
                isDragging && "opacity-40",
                isDragOver && "bg-sidebar-accent ring-1 ring-inset ring-[var(--primary)]/50"
              )}
              style={{ height: ROW_HEIGHT, paddingLeft }}
              onClick={() => {
                if (isFile) setOpenFilePath(node.path);
                else onToggleExpanded(node.path);
              }}
            >
              <span className={cn("min-w-0 flex-1 truncate", isActive && "font-medium")}>
                {displayName(node)}
              </span>

              {!isFile && (
                <Icon
                  name="expand_more"
                  className={cn(
                    "ml-2 shrink-0 text-muted-foreground/45 transition-transform duration-150",
                    !isOpen && "-rotate-90"
                  )}
                  size={16}
                />
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-opacity hover:bg-sidebar-accent-foreground/10",
                      isActive ? "opacity-50 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Icon name="more_horiz" size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  className="min-w-[148px]"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {menuItems("dropdown")}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
            {menuItems("context")}
          </ContextMenuContent>
        </ContextMenu>
      )}

      {!isFile && (
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.mp3,.wav,.ogg,.m4a,.aac,.flac,.mp4,.webm,.mov"
          className="hidden"
          onChange={(e) => handleUploadToFolder(e.target.files)}
        />
      )}

      {showDelete && (
        <div
          className="my-0.5 mr-1 rounded-sm border border-destructive/20 bg-destructive/5 p-2 dark:bg-destructive/10"
          style={{ marginLeft: paddingLeft }}
        >
          <p className="mb-2 truncate text-xs text-muted-foreground">
            Delete <span className="font-medium text-foreground">&ldquo;{displayName(node)}&rdquo;</span>?
          </p>
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-sm border border-destructive/30 bg-destructive/10 py-0.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              onMouseDown={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Delete
            </button>
            <button
              className="flex-1 rounded-sm border border-border py-0.5 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowDelete(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!isFile && (
        <div
          style={{
            display: "grid",
            gridTemplateRows: showChildren ? "1fr" : "0fr",
            transition: "grid-template-rows 150ms ease",
          }}
        >
          <div style={{ overflow: "hidden", minHeight: 0 }}>
            <div className="relative">
              {showChildren && depth >= 0 && (
                <span
                  className="pointer-events-none absolute top-0 w-px bg-sidebar-border/70"
                  style={{
                    left: 10 + depth * INDENT + INDENT / 2,
                    bottom: isLast ? ROW_HEIGHT / 2 : 0,
                  }}
                  aria-hidden
                />
              )}

              {pendingNew && (
                <div
                  className="flex items-center pr-2"
                  style={{ height: ROW_HEIGHT, paddingLeft: paddingLeft + INDENT }}
                >
                  <InlineInput
                    placeholder={pendingNew === "file" ? "note-name" : "folder-name"}
                    onConfirm={handleCreate}
                    onCancel={() => setPendingNew(null)}
                  />
                </div>
              )}

              {children.map((child, index) => (
                <FileTreeNode
                  key={child.path}
                  node={child}
                  actions={actions}
                  expandedPaths={expandedPaths}
                  onToggleExpanded={onToggleExpanded}
                  onExpandPath={onExpandPath}
                  onMove={onMove}
                  depth={depth + 1}
                  isLast={index === children.length - 1 && !pendingNew}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
