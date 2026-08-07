import type { NoteTreeNode, NoteContent, VaultSettings, GraphData } from "@/types/notes";

export const API_BASE =
  typeof window !== "undefined"
    ? "/backend-api"
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000");

const BASE = API_BASE;

export type HealthStatus = {
  status: string;
  ai: {
    anthropic_configured: boolean;
    tavily_configured: boolean;
  };
};

export const getHealth = () => request<HealthStatus>("/health");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(error), { status: res.status });
  }
  return res.json() as Promise<T>;
}

// Vault
export const getVaultPath = () =>
  request<{ path: string | null }>("/vault/path");

export const setVaultPath = (path: string) =>
  request<{ path: string }>("/vault/path", {
    method: "PUT",
    body: JSON.stringify({ path }),
  });

export const getVaultSettings = () =>
  request<VaultSettings>("/vault/settings");

export const initVault = () =>
  request<{ status: string }>("/vault/init", { method: "POST" });

// Graph
export const getGraph = () => request<GraphData>("/graph");

/** Drop unresolved wikilink targets — graph shows only real vault notes. */
export function sanitizeGraphData(data: GraphData): GraphData {
  const nodes = data.nodes.filter((n) => n.exists && n.path);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = data.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );
  return { nodes, edges };
}

export type Backlink = { path: string; excerpt: string };

export const getBacklinks = (path: string) =>
  request<{ backlinks: Backlink[] }>(`/graph/backlinks/${encodePath(path)}`);

// Notes tree
export const getNotesTree = () =>
  request<{ tree: NoteTreeNode[] }>("/notes");

// Note content
export const getNote = (path: string) =>
  request<NoteContent>(`/notes/${encodePath(path)}`);

export const createNote = (path: string) =>
  request<{ path: string }>(`/notes/${encodePath(path)}`, {
    method: "POST",
    body: JSON.stringify({ content: "" }),
  });

export const saveNote = (path: string, content: string) =>
  request<{ path: string }>(`/notes/${encodePath(path)}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });

export const renameNote = (path: string, newPath: string) =>
  request<{ path: string }>(`/notes/${encodePath(path)}`, {
    method: "PATCH",
    body: JSON.stringify({ new_path: newPath }),
  });

export const deleteNote = (path: string) =>
  request<{ deleted: string }>(`/notes/${encodePath(path)}`, {
    method: "DELETE",
  });

// Edit history
export type EditRecord = {
  id: string;
  timestamp: string;
  note_path: string;
  session_id?: string;
};

export const getEditHistory = (path: string) =>
  request<{ edits: EditRecord[] }>(`/notes/${encodePath(path)}/edit-history`);

export const revertEdit = (path: string, editId: string) =>
  request<{ path: string; content: string; reverted_edit_id: string }>(
    `/notes/${encodePath(path)}/revert/${encodeURIComponent(editId)}`,
    { method: "POST" }
  );

// Folders
export const createFolder = (path: string) =>
  request<{ path: string }>("/vault/folders", {
    method: "POST",
    body: JSON.stringify({ path }),
  });

export const deleteFolder = (path: string) =>
  request<{ deleted: string }>(`/vault/folders/${encodePath(path)}`, {
    method: "DELETE",
  });

export const renameFolder = (path: string, newPath: string) =>
  request<{ old_path: string; new_path: string }>(
    `/vault/folders/${encodePath(path)}`,
    { method: "PUT", body: JSON.stringify({ new_path: newPath }) }
  );

// Asset upload
export const uploadFile = async (file: File, folder = ""): Promise<{ path: string; name: string }> => {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  const res = await fetch(`${BASE}/vault/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw Object.assign(new Error(err), { status: res.status });
  }
  return res.json();
};

// Transform (inline AI editing)
export const transformText = (text: string, prompt: string) =>
  request<{ result: string }>("/notes/transform", {
    method: "POST",
    body: JSON.stringify({ text, prompt }),
  });

// Search
export type SearchMatch = {
  file: string;
  line: number;
  snippet: string;
};

export const searchNotes = (q: string, maxResults = 30) =>
  request<{ query: string; results: SearchMatch[] }>(
    `/notes/search?q=${encodeURIComponent(q)}&max_results=${maxResults}&case_sensitive=false`
  );

// Agentic search
export async function* streamAgenticSearch(query: string, signal?: AbortSignal): AsyncGenerator<ChatSSEEvent> {
  const res = await fetch(`${BASE}/search/agentic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }

  yield* parseSSEStream(res);
}

// Diff
export const getDiff = (old_content: string, new_content: string, file_path: string) =>
  request<{ file_path: string; hunks: DiffHunk[]; has_changes: boolean }>("/diff", {
    method: "POST",
    body: JSON.stringify({ old_content, new_content, file_path }),
  });

// Chat
export const BASE_URL = BASE;

export type ChatRequest = {
  session_id: string;
  message: string;
  active_note_path?: string;
};

export type SessionMeta = {
  id: string;
  preview: string;
  updated_at: string;
};

export type SessionMessage = {
  role: "user" | "assistant";
  text: string;
};

async function* parseSSEStream(res: Response): AsyncGenerator<ChatSSEEvent> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6)) as ChatSSEEvent;
        } catch {
          // skip malformed
        }
      }
    }
  }
}

export async function* streamChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatSSEEvent> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }

  yield* parseSSEStream(res);
}

export const approveToolCall = (request_id: string) =>
  request<{ status: string }>("/chat/approve", {
    method: "POST",
    body: JSON.stringify({ request_id }),
  });

export const denyToolCall = (request_id: string) =>
  request<{ status: string }>("/chat/deny", {
    method: "POST",
    body: JSON.stringify({ request_id }),
  });

export const listSessions = () =>
  request<{ sessions: SessionMeta[] }>("/chat/sessions");

export const loadSession = (sessionId: string) =>
  request<{ session_id: string; messages: SessionMessage[] }>(`/chat/sessions/${encodeURIComponent(sessionId)}`);

export type DiffLine = {
  type: "context" | "add" | "remove";
  content: string;
  old_lineno?: number;
  new_lineno?: number;
};

export type DiffHunk = {
  old_start: number;
  new_start: number;
  lines: DiffLine[];
};

export type ChatSSEEvent =
  | { type: "text"; delta: string }
  | { type: "thinking_start" }
  | { type: "thinking_delta"; delta: string }
  | { type: "thinking_end"; text: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown>; tool_use_id: string }
  | { type: "tool_result"; name: string; content: string }
  | { type: "permission_request"; request_id: string; tool: string; input: Record<string, unknown> }
  | { type: "tool_denied"; request_id: string; tool: string }
  | { type: "done" };

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}
