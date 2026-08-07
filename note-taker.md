# Digital Garden - Cursor for Writing

- only integrate claude
- obsidian like vault with linked notes
- cursor like chat interface with edits, diff viewer, ai edit management, etc.
- fastapi for backend. react, nextjs for frontend.
- agentic file search
- web search tools

---

## MVP Plan

### 1. Vault & Note Management

| Subfeature | Description |
|---|---|
| Local vault directory | Point app to a folder; all `.md` files are treated as notes |
| Note CRUD | Create, rename, delete, and save notes |
| File tree sidebar | Hierarchical view of all notes/folders |
| Markdown rendering | Live preview of rendered markdown |
| Auto-save | Debounced save on keystroke |

---

### 2. Linked Notes (Obsidian-style)

| Subfeature | Description |
|---|---|
| `[[wikilink]]` support | Parse and render internal links between notes |
| Backlinks panel | Show all notes that link to the current note |
| Link autocomplete | Suggest note names while typing `[[` |
| Broken link detection | Highlight links pointing to non-existent notes |

---

### 3. Chat Interface (Cursor-style)

| Subfeature | Description |
|---|---|
| Floating chat panel | Side panel with conversation history |
| Context-aware prompts | Active note content sent as context |
| Multi-turn conversation | Full thread history per chat session |
| Inline apply button | Apply Claude's response directly into note |
| Chat history persistence | Save/load past sessions |

---

### 4. AI Edit Management

| Subfeature | Description |
|---|---|
| Diff viewer | Side-by-side or inline diff of AI suggested changes |
| Accept / Reject edits | Per-block accept/reject controls |
| Accept all / Reject all | Bulk action buttons |
| Edit history log | Timeline of all AI edits per note |
| Undo AI edit | Revert to pre-edit version |

---

### 5. Agentic File Search

| Subfeature | Description |
|---|---|
| Semantic search across vault | Claude reads and reasons across notes to find relevant content |
| Keyword full-text search | Fast grep-style search across all `.md` files |
| Search results panel | Ranked list with note excerpts |
| Ask about your vault | "Which notes mention X?" answered by Claude with citations |
| Cross-note context injection | Automatically pull relevant notes into Claude's context |

---

### 6. Web Search Tool (Claude tool use)

| Subfeature | Description |
|---|---|
| Web search tool for Claude | Claude can call a search API (e.g. Brave, Tavily) during chat |
| Search result display | Show sources used in chat response |
| Insert web content into note | Save fetched content / summaries directly into a note |
| Grounded responses | Responses cite URLs when web search was used |

---

### 7. Backend (FastAPI)

| Subfeature | Description |
|---|---|
| `/chat` endpoint | Streams Claude responses with tool use support |
| `/notes` CRUD endpoints | Read/write notes from vault directory |
| `/search` endpoint | Full-text + agentic search handler |
| `/diff` endpoint | Generate and return diffs for AI edits |
| File watcher | Detect external changes to vault files and sync |

---

### 8. Frontend (Next.js + React)

| Subfeature | Description |
|---|---|
| Editor (CodeMirror or Monaco) | Markdown editor with syntax highlighting |
| Split view (edit + preview) | Toggle between raw/rendered markdown |
| Chat panel | Right-side drawer with message thread |
| Diff viewer component | Highlight added/removed lines with accept/reject |
| Command palette | `Cmd+K` quick open for notes and actions |

---

### Tech Stack Summary

| Layer | Choice |
|---|---|
| Backend | FastAPI + Python |
| Frontend | Next.js + React + Tailwind |
| AI | Claude (claude-sonnet-4-6) via Anthropic SDK |
| Web search | Tavily or Brave Search API |
| Editor | CodeMirror 6 or Monaco |
| Storage | Local filesystem (no DB for MVP) |
