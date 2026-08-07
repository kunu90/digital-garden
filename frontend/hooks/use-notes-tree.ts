"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  getNotesTree,
  renameFolder,
  renameNote,
  API_BASE,
} from "@/lib/api";
import type { NoteTreeNode } from "@/types/notes";
import { sortNoteTree } from "@/lib/sort-tree";

export function useNotesTree() {
  const [tree, setTree] = useState<NoteTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getNotesTree()
      .then((res) => {
        setTree(sortNoteTree(res.tree));
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to vault file-change events to auto-refresh the tree
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/vault/watch`);
    let debounce: ReturnType<typeof setTimeout>;
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as { type: string };
        if (msg.type === "file_changed") {
          clearTimeout(debounce);
          debounce = setTimeout(refresh, 300);
        }
      } catch { /* ignore */ }
    };
    return () => { clearTimeout(debounce); es.close(); };
  }, [refresh]);

  const handleCreateNote = useCallback(
    async (path: string) => {
      await createNote(path);
      refresh();
    },
    [refresh]
  );

  const handleDeleteNote = useCallback(
    async (path: string) => {
      await deleteNote(path);
      refresh();
    },
    [refresh]
  );

  const handleCreateFolder = useCallback(
    async (path: string) => {
      await createFolder(path);
      refresh();
    },
    [refresh]
  );

  const handleDeleteFolder = useCallback(
    async (path: string) => {
      await deleteFolder(path);
      refresh();
    },
    [refresh]
  );

  const handleRenameFolder = useCallback(
    async (path: string, newPath: string) => {
      await renameFolder(path, newPath);
      refresh();
    },
    [refresh]
  );

  const handleRenameNote = useCallback(
    async (path: string, newPath: string) => {
      await renameNote(path, newPath);
      refresh();
    },
    [refresh]
  );

  return {
    tree,
    loading,
    error,
    refresh,
    createNote: handleCreateNote,
    deleteNote: handleDeleteNote,
    createFolder: handleCreateFolder,
    deleteFolder: handleDeleteFolder,
    renameFolder: handleRenameFolder,
    renameNote: handleRenameNote,
  };
}
