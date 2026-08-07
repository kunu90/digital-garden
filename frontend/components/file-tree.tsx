"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { FilePlus2, Folder, FolderPlus, Plus, Search, Upload, X, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotesTree } from "@/hooks/use-notes-tree";
import { FileTreeNode } from "@/components/file-tree-node";
import { InlineInput } from "@/components/inline-input";
import { useWorkspace } from "@/context/workspace-context";
import { uploadFile } from "@/lib/api";
import { ALL_MEDIA_EXTS, getExt } from "@/lib/media-utils";
import { cn } from "@/lib/utils";
import type { NoteTreeNode } from "@/types/notes";

function flattenTree(nodes: NoteTreeNode[]): NoteTreeNode[] {
  const result: NoteTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...flattenTree(node.children));
  }
  return result;
}

function highlightMatch(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <>
      <span>{text.slice(0, idx)}</span>
      <mark className="rounded-[2px] bg-[var(--gl-status-warning-background-color)] px-0 text-[var(--gl-status-warning-text-color)]">
        {text.slice(idx, idx + query.length)}
      </mark>
      <span>{text.slice(idx + query.length)}</span>
    </>
  );
}

function SearchResult({
  node,
  query,
  onSelect,
}: {
  node: NoteTreeNode;
  query: string;
  onSelect: () => void;
}) {
  const { openFilePath } = useWorkspace();
  const isActive = node.type === "file" && openFilePath === node.path;
  const parts = node.path.split("/");
  const parentPath = parts.slice(0, -1).join("/");

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full cursor-pointer rounded-sm px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        isActive && "bg-[var(--dg-tree-selected-bg)] font-medium text-[var(--dg-tree-selected-fg)]"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate">{highlightMatch(node.type === "file" && node.name.endsWith(".md") ? node.name.slice(0, -3) : node.name, query)}</span>
      </div>
      {parentPath && (
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/45">{parentPath}</span>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8">
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <Folder size={16} />
      </div>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        No notes yet.{" "}
        <span className="inline-flex items-center gap-0.5">
          Click <kbd className="rounded-sm border border-border bg-muted px-1 py-0.5 text-[10px]">+</kbd> to create one.
        </span>
      </p>
    </div>
  );
}

export function FileTree() {
  const { tree, loading, createNote, deleteNote, createFolder, deleteFolder, renameFolder, renameNote } =
    useNotesTree();
  const [pendingNew, setPendingNew] = useState<"file" | "folder" | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isRootDragOver, setIsRootDragOver] = useState(false);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [isExternalDragging, setIsExternalDragging] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const didAutoExpand = useRef(false);
  const { setOpenFilePath } = useWorkspace();

  useEffect(() => {
    if (didAutoExpand.current || tree.length === 0) return;
    didAutoExpand.current = true;
    const paths = new Set<string>();
    const walk = (nodes: NoteTreeNode[], depth: number) => {
      for (const n of nodes) {
        if (n.type === "folder") {
          if (depth < 2) paths.add(n.path);
          if (n.children) walk(n.children, depth + 1);
        }
      }
    };
    walk(tree, 0);
    setExpandedPaths(paths);
  }, [tree]);

  useEffect(() => {
    const onStart = () => setIsDraggingAny(true);
    const onEnd = () => { setIsDraggingAny(false); setIsRootDragOver(false); };
    document.addEventListener("dragstart", onStart);
    document.addEventListener("dragend", onEnd);
    return () => {
      document.removeEventListener("dragstart", onStart);
      document.removeEventListener("dragend", onEnd);
    };
  }, []);

  // Detect external file drags from desktop
  useEffect(() => {
    let counter = 0;
    const onEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) { counter++; setIsExternalDragging(true); }
    };
    const onLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) {
        counter = Math.max(0, counter - 1);
        if (counter === 0) setIsExternalDragging(false);
      }
    };
    const onDrop = () => { counter = 0; setIsExternalDragging(false); setIsRootDragOver(false); };
    document.addEventListener("dragenter", onEnter);
    document.addEventListener("dragleave", onLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onEnter);
      document.removeEventListener("dragleave", onLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  async function handleUploadFiles(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter((f) => ALL_MEDIA_EXTS.has(getExt(f.name)));
    for (const f of valid) {
      try { await uploadFile(f, ""); } catch { /* ignore */ }
    }
  }

  function toggleExpanded(path: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function expandPath(path: string) {
    setExpandedPaths((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }

  const actions = { createNote, deleteNote, createFolder, deleteFolder, renameFolder, renameNote };

  async function handleMove(sourcePath: string, sourceType: "file" | "folder", targetFolderPath: string) {
    const name = sourcePath.split("/").pop()!;
    const newPath = targetFolderPath ? `${targetFolderPath}/${name}` : name;
    if (sourceType === "file") {
      await actions.renameNote(sourcePath, newPath);
    } else {
      await actions.renameFolder(sourcePath, newPath);
    }
  }

  // Root drop zone: move item to vault root OR upload external files
  function handleRootDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files") ? "copy" : "move";
    setIsRootDragOver(true);
  }

  function handleRootDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsRootDragOver(false);
    }
  }

  async function handleRootDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsRootDragOver(false);
    setIsExternalDragging(false);

    // External file drop → upload to vault root
    if (e.dataTransfer.files.length > 0) {
      await handleUploadFiles(e.dataTransfer.files);
      return;
    }

    const raw = e.dataTransfer.getData("application/x-dg-node");
    if (!raw) return;
    try {
      const { path: srcPath, type: srcType } = JSON.parse(raw) as {
        path: string;
        type: "file" | "folder";
      };
      if (!srcPath.includes("/")) return;
      await handleMove(srcPath, srcType, "");
    } catch { /* ignore */ }
  }

  async function handleRootCreate(name: string) {
    const finalPath = pendingNew === "file" && !name.endsWith(".md") ? `${name}.md` : name;
    if (pendingNew === "file") {
      await createNote(finalPath);
      setOpenFilePath(finalPath);
    } else {
      await createFolder(finalPath);
    }
    setPendingNew(null);
  }

  const allNodes = useMemo(() => flattenTree(tree), [tree]);
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allNodes.filter((n) => n.name.toLowerCase().includes(q));
  }, [allNodes, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div
      className={cn(
        "flex flex-col transition-colors",
        isRootDragOver && "ring-1 ring-inset ring-sidebar-primary/40 rounded-[4px] bg-sidebar-primary/5"
      )}
      onDragOver={!isSearching ? handleRootDragOver : undefined}
      onDragLeave={!isSearching ? handleRootDragLeave : undefined}
      onDrop={!isSearching ? handleRootDrop : undefined}
    >
      {/* Header */}
      <div className="mb-1 flex items-center justify-between px-3 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.025em] text-muted-foreground">
          Notes
        </span>
        <div className="flex items-center gap-0.5">
          {expandedPaths.size > 0 && !isSearching && (
            <button
              onClick={() => setExpandedPaths(new Set())}
              title="Collapse all"
              className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <ChevronsUpDown size={12} />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Plus size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="min-w-[140px]" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuItem className="gap-1.5 py-1 text-[11px] [&_svg:not([class*='size-'])]:size-3" onSelect={() => setPendingNew("file")}>
                <FilePlus2 /> New Note
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-1.5 py-1 text-[11px] [&_svg:not([class*='size-'])]:size-3" onSelect={() => setPendingNew("folder")}>
                <FolderPlus /> New Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-1.5 py-1 text-[11px] [&_svg:not([class*='size-'])]:size-3" onSelect={() => setTimeout(() => uploadInputRef.current?.click(), 0)}>
                <Upload /> Upload Files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.mp3,.wav,.ogg,.m4a,.aac,.flac,.mp4,.webm,.mov"
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative mx-2 mb-2">
        <Search
          size={12}
          className={cn(
            "absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors",
            isSearchFocused || searchQuery ? "text-muted-foreground" : "text-muted-foreground/50"
          )}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          placeholder="Filter notes…"
          className="h-7 w-full rounded-sm border border-border bg-background pl-7 pr-7 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--gl-control-border-color-focus)] focus:ring-1 focus:ring-[var(--gl-focus-ring-outer-color)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/40 hover:text-muted-foreground"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Tree content */}
      <div className="flex flex-col px-1 pb-2">
        {loading && tree.length === 0 ? (
          <div className="flex flex-col gap-2 px-2 py-1">
            <Skeleton className="h-3.5" style={{ width: "65%" }} />
            <Skeleton className="h-3.5" style={{ width: "80%" }} />
            <Skeleton className="ml-4 h-3.5" style={{ width: "55%" }} />
            <Skeleton className="ml-4 h-3.5" style={{ width: "70%" }} />
            <Skeleton className="h-3.5" style={{ width: "45%" }} />
          </div>
        ) : isSearching ? (
          searchResults.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground/40">
              No results for &ldquo;{searchQuery}&rdquo;
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {searchResults.map((node) => (
                <SearchResult
                  key={node.path}
                  node={node}
                  query={searchQuery}
                  onSelect={() => {
                    if (node.type === "file") setOpenFilePath(node.path);
                  }}
                />
              ))}
            </div>
          )
        ) : (
          <>
            {pendingNew && (
              <div className="flex h-7 items-center rounded-sm px-2.5">
                <InlineInput
                  placeholder={pendingNew === "file" ? "note-name" : "folder-name"}
                  onConfirm={handleRootCreate}
                  onCancel={() => setPendingNew(null)}
                />
              </div>
            )}
            {tree.length === 0 && !pendingNew ? (
              <EmptyState />
            ) : (
              tree.map((node, index) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  actions={actions}
                  expandedPaths={expandedPaths}
                  onToggleExpanded={toggleExpanded}
                  onExpandPath={expandPath}
                  onMove={handleMove}
                  isLast={index === tree.length - 1 && !pendingNew}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Drop hint — shown when dragging into the panel */}
      {(isDraggingAny || isExternalDragging) && !isSearching && isRootDragOver && (
        <div className="pointer-events-none mx-1.5 mt-1 flex h-6 items-center justify-center gap-1.5 rounded-[3px] border border-dashed border-sidebar-primary/50 bg-sidebar-primary/8 text-[10px] text-sidebar-primary">
          {isExternalDragging && !isDraggingAny ? (
            <><Upload size={10} /> Drop to upload to root</>
          ) : (
            <><Folder size={10} /> Move to root</>
          )}
        </div>
      )}
    </div>
  );
}
