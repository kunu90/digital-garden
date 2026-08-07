import type { NoteTreeNode } from "@/types/notes";

const HUB_STEM = "product-build-journal";
const DATE_LINE_RE = /^\*(?:(\d{4}-\d{2}-\d{2})|(\d{2}-\d{2}-\d{4}))\*\s*$/m;

/** Journal update order when API omits sort_at (legacy backend). */
const JOURNAL_UPDATE_ORDER: Record<string, number> = {
  "Foundation - MVP vision.md": 1,
  "macOS launcher.md": 2,
  "Reliability, CORS, proxy.md": 3,
  "Graph - wikilinks.md": 4,
  "Tree sidebar.md": 5,
  "MVP closeout.md": 6,
  "build-chronicler born.md": 7,
  "Today's restructure.md": 8,
  "Journal lives in vault folder.md": 9,
  "Interaction design.md": 10,
};

function fallbackSortAt(node: NoteTreeNode): number {
  if (node.type === "file" && node.name.replace(/\.md$/i, "") === HUB_STEM) {
    return Number.NEGATIVE_INFINITY;
  }
  const journalRank = JOURNAL_UPDATE_ORDER[node.name];
  if (journalRank !== undefined) {
    return journalRank;
  }
  if (node.type === "folder" && node.name === "updates") {
    return 1;
  }
  return Number.MAX_SAFE_INTEGER;
}

function nodeSortAt(node: NoteTreeNode): number {
  if (typeof node.sort_at === "number") return node.sort_at;
  return fallbackSortAt(node);
}

export function sortNoteTree(nodes: NoteTreeNode[]): NoteTreeNode[] {
  return [...nodes]
    .sort((a, b) => {
      const diff = nodeSortAt(a) - nodeSortAt(b);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    })
    .map((node) =>
      node.children
        ? { ...node, children: sortNoteTree(node.children) }
        : node,
    );
}

/** Parse *dd-mm-yyyy* (or legacy *YYYY-MM-DD*) from note content. */
export function parseJournalDate(content: string): number | null {
  const match = DATE_LINE_RE.exec(content.slice(0, 600));
  if (!match) return null;
  if (match[1]) return Date.parse(`${match[1]}T12:00:00`);
  const [dd, mm, yyyy] = match[2].split("-");
  return Date.parse(`${yyyy}-${mm}-${dd}T12:00:00`);
}
