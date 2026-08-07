"use client";

import { useEffect, useState } from "react";
import { getNotesTree } from "@/lib/api";
import type { NoteTreeNode } from "@/types/notes";

function flattenTree(nodes: NoteTreeNode[]): string[] {
  const result: string[] = [];
  for (const n of nodes) {
    if (n.type === "file") result.push(n.path);
    if (n.children) result.push(...flattenTree(n.children));
  }
  return result;
}

export function useNotesList() {
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    getNotesTree()
      .then((res) => setNotes(flattenTree(res.tree)))
      .catch(() => {});
  }, []);

  return notes;
}
