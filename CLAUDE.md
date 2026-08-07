# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Digital Garden is an AI-powered note-taking application ("Cursor for Writing") with Obsidian-style wikilinks, a Claude-backed chat interface, and agentic file operations. It consists of a FastAPI backend and a Next.js frontend.

## Repository Layout

```
digital-garden/
├── CLAUDE.md
├── note-taker.md       # MVP feature blueprint
├── backend/
└── frontend/
```

## Development Commands

### Backend (Python/FastAPI)

```bash
cd digital-garden/backend
uv run uvicorn main:app --reload       # Start dev server (port 8000)
uv add <package>                        # Add a dependency
uv run python -m pytest                 # Run tests (if/when added)
```

Required environment variables (`.env` in `backend/`):
- `ANTHROPIC_API_KEY`
- `TAVILY_API_KEY`
- `VAULT_PATH` (defaults to `~/vault`)

See [`backend/API_KEYS.md`](backend/API_KEYS.md) for setup. **Never paste API keys in chat** — add them only to `backend/.env` on your machine.

### API Keys & Secrets Workflow

| Key | Required for | Paste location |
|-----|--------------|----------------|
| `ANTHROPIC_API_KEY` | Chat, inline AI, tab completion, agentic search | `backend/.env` |
| `TAVILY_API_KEY` | Web search tool | `backend/.env` (optional until testing web search) |

**Agent checkpoint rules:**
1. After setup, ask the user to add `ANTHROPIC_API_KEY` to `backend/.env` and confirm when done — do not ask for the key value in chat
2. Before testing web search, ask for `TAVILY_API_KEY` the same way
3. Never hardcode keys in source files
4. Verify via `GET /health` → `ai.anthropic_configured` / `ai.tavily_configured`

Get keys: [Anthropic Console](https://console.anthropic.com) · [Tavily](https://tavily.com)

### Frontend (Next.js)

```bash
cd digital-garden/frontend
npm run dev       # Start dev server (port 3000)
npm run build     # Production build
npm run lint      # Run ESLint
```

## Architecture

### Backend (`backend/`)

```
api/          - FastAPI routers (chat, notes, vault, diff)
assistant/
  harness/    - ReActLoop, ToolRegistry, PermissionGate, orchestrator
  models/     - ClaudeClient (async Anthropic SDK wrapper)
  tools/      - Tool implementations (read_file, edit_file, files_grep, web_search, write_memory)
  memory/     - Session history + cross-session memory
vault/        - Local filesystem markdown storage (.garden/ for metadata)
config.py     - Pydantic Settings (env vars)
main.py       - App entrypoint
```

**Key flow:** `POST /chat` → `Orchestrator` → `ReActLoop` (agentic reasoning) → `ClaudeClient` (Anthropic SDK) → tool calls → `PermissionGate` (user approval for sensitive ops) → SSE stream back to client.

**Tools requiring user approval:** `edit_file`, `web_search`, `write_memory`. Use `POST /chat/approve` or `/chat/deny` to resolve pending gates.

**Streaming:** All Claude responses stream via Server-Sent Events (SSE). File vault changes also stream via `GET /vault/watch`.

**Vault metadata:** Stored in `<VAULT_PATH>/.garden/` — includes `settings.json`, `memory.md` (cross-session AI memory), and per-session chat history JSON files.

### Frontend (`frontend/`)

```
app/           - Next.js App Router (layout.tsx, page.tsx, globals.css)
components/    - UI components (shadcn/ui based)
lib/           - Utilities (cn() for Tailwind class merging)
```

Uses **React Server Components** (RSC enabled in `components.json`). UI built with **shadcn/ui** (Radix UI primitives + Tailwind CSS v4). Add new shadcn components via `npx shadcn add <component>`.

### AI Orchestration

The `ReActLoop` implements a reasoning loop with tool calling against Claude (model configured via `MODEL` env var, default `claude-sonnet-4-6`). The `ToolRegistry` manages tool specs and dispatch. Permission-gated tools block the loop and emit a `tool_approval_required` SSE event, then resume once the frontend responds.

## Chat / Agent Panel

The agent panel is toggled via the ✨ (Sparkles) button in the topbar. It opens a 360px right panel.

### Frontend chat components (`frontend/components/chat/`)
- `chat-panel.tsx` — main container with header, message list, input
- `chat-message.tsx` — renders user bubbles + assistant blocks (markdown via react-markdown)
- `thinking-block.tsx` — collapsible extended thinking display
- `tool-call-block.tsx` — tool call cards with status icons + diff preview
- `diff-preview.tsx` — fetches current file + calls `/diff` to show changes before approval

### Frontend chat hook (`frontend/hooks/use-chat.ts`)
Manages message state, SSE streaming (`streamChat`), approval flow, and `onFileEdit` callback.

### SSE event types (backend → frontend)
| Event | Description |
|-------|-------------|
| `text` | Token delta from Claude |
| `thinking_start/delta/end` | Extended thinking (claude-3-7-sonnet+) |
| `tool_call` | Agent invoking a tool |
| `permission_request` | Gate awaiting approval |
| `tool_result` | Tool finished |
| `tool_denied` | User denied the action |
| `done` | Stream complete |

### Approval flow
1. Agent calls `edit_file`/`web_search`/`write_memory`
2. Backend emits `permission_request` SSE, suspends on `asyncio.Event`
3. Frontend shows diff preview (for `edit_file`) + Approve/Deny buttons
4. User clicks → `POST /chat/approve` or `/chat/deny` → backend resumes

### File tree auto-refresh
`use-notes-tree.ts` subscribes to `GET /vault/watch` SSE; on `file_changed` it debounce-refreshes the tree.

### Auto-open on file edit
`ChatPanel` accepts `onFileEdit?: (path: string) => void` — called when `edit_file` completes; wired to `openFile` in `WorkspaceLayout`.

## To-do
1. ~~pdf reader, image reader, audio reader, video reader.~~ ✓ (image/pdf/audio/video viewers as tabs; inline embed widgets in editor)
2. ~~markdown format support for pdf, image, audio, video embed.~~ ✓ (CodeMirror extension: `![[file.ext]]` and `![alt](path)` render inline)
3. ~~upload to vault and storing things not markdown there.~~ ✓ (drag-drop to sidebar/folders, Upload Files in + menu and folder context menu)
---
4. tools for agent to read and understand pdf, image, audio, video.
5. integrating this with web search, reading pdfs and papers, etc. 
---
6. ~~command center - for now just file search and navigation~~ ✓ (Cmd+K palette, fuzzy search, match highlight, keyboard nav)
---
7. ~~keyboard shortcuts tab on top bar. opens a popover with all keyboard shortcuts.~~ ✓ (Keyboard icon button in topbar, Radix Popover, grouped by Navigation/Editor/Interface)
---
8. ~~selecting text and getting ai to modify based on a prompt. cursor style.~~ ✓ (inline AI toolbar on selection, POST /notes/transform, Haiku-backed)
9. ~~tab completion for writing feature. cursor style.~~ ✓ (POST /notes/complete, Haiku-backed)
---
10. multiple chat windows that persist across sessions and site reloads. unless user closes them. 
---
11. model based context, max tokens, thinking budget etc. starting with anthropic. 
---
12. web research agent. explore vault agent. writing with citations and wikilinks agent. 
---
13. enhanced graph view. moving nodes, their sizing, placement, text labels readability, pan, zoom, search and filtering. 
---
14. users can build custom agents that do research, write some way, etc. and they can install slash comands. they can control that through agent chat. or our orchestrator can control spawning and controlling these agents. user can specify prompt, tool use permissions, etc.
--- 
15. user auth and cloud storage and db integration. migration from local files to cloud. setup vault. multi vault setup. download vault from cloud. delete vault, etc. 
---
16. persisting pdf annotations and highlights with pdfjs or something. 
---
17. comprehensive settings panel to toggle different features on and off, etc. like agentic search, tool use, tab completion, inline ai editing, etc. change keybindings, etc. BYOK for llm providers and models. start only with anthropic. 
---
18. how to rearchitect this as a local first app with local files and cloud sync. is setting it up as a web app the right approach? or should we go with a desktop app? how should we package it to also make it self hosted? 
---
19. multiple vaults setup and navigation between them. like workspaces. 