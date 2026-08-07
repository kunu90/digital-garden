export type NoteTreeNode = {
  type: "file" | "folder";
  name: string;
  path: string;
  /** Unix timestamp for sidebar ordering (oldest first). */
  sort_at?: number;
  children?: NoteTreeNode[];
};

export type NoteContent = {
  path: string;
  content: string;
};

export type VaultSettings = {
  name: string;
  ignored_folders: string[];
  model_override: string | null;
};

export type GraphNode = {
  id: string;
  label: string;
  path: string | null;
  exists: boolean;
};

export type GraphEdge = {
  source: string;
  target: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
