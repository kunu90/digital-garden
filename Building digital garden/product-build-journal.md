# Product Build Journal

**Digital Garden** — local-first, AI-assisted writing on a linked-notes vault (“Cursor for Writing”).

This file is the **core node**. Every build, design, or test session becomes a **connected update** in `Building digital garden/updates/`. Together they form a graph you can navigate in the app (when this folder is in your vault) or in the repo.

---

## What this is

| | |
|---|---|
| **Purpose** | Living product record—not a changelog, not a README |
| **Audience** | Future me, collaborators, and **build-chronicler** (Cursor subagent) |
| **Format** | Product management: problem → intent → decision → outcome → learning |
| **Testing ground** | Dogfood Digital Garden: each update links here; use **Test notes** in updates while you build and verify |

**Hub (this file):** stable story—vision, plan, principles, status.  
**Updates (`Building digital garden/updates/`):** one note per change session, titled by what happened (not by date).

---

## What I planned to do

Full spec: [[note-taker]].

### MVP bets

1. **Vault** — point at a folder; `.md` notes; auto-save  
2. **Linked thinking** — `[[wikilinks]]`, backlinks, graph  
3. **AI writing** — chat with context, tool use, approve/deny diffs  
4. **Trust** — session persistence, edit undo, BYOK API keys  
5. **Discovery** — keyword search + agentic “ask the vault”  
6. **Launch** — double-click macOS app, no terminal required  

### Non-goals (MVP)

- Cloud sync, auth, multi-vault  
- Graph as diagram editor (links live in markdown)  
- Managed API keys (user brings Anthropic + optional Tavily)

---

## Why I’m building it this way

### Product thesis

Writers already think in **notes** and **links**. Developers already trust **AI beside the file**. Digital Garden merges those loops instead of forcing a chatbot or a passive notebook.

### Principles

| Principle | Why |
|-----------|-----|
| **Local-first** | Files are yours; `.garden/` holds metadata beside notes |
| **Author, not audience** | AI proposes; human approves before vault writes |
| **Links in prose** | Graph visualises relationships already written |
| **Errors that teach** | Distinguish setup (keys, vault) from infra (ports, restart) |
| **Learn in public (to yourself)** | This journal graph documents intent, not just diffs |

### Stack (and why)

- **FastAPI** — async, SSE for chat stream, simple file APIs  
- **Next.js** — editor UI, command palette, graph canvas  
- **Claude (BYOK)** — single model family for MVP; keys stay in `backend/.env`  

See [[backend/API_KEYS]] for key setup (never paste keys in chat).

---

## What I’m learning

*Themes that recur as a product designer becoming a product builder.*

1. **Loops beat features** — MVP is “write → link → see → ask AI → approve → undo,” not a feature grid.  
2. **Launcher = product** — If double-click fails, the backend doesn’t matter.  
3. **Browser trust ≠ server health** — CORS/proxy issues look like “app broken” to users.  
4. **Dogfood the metaphor** — This journal as a wikilink graph tests the same UX we ship.  
5. **AI builds; you judge feel** — Agents wire code fast; you own copy, errors, discoverability.  
6. **Document while messy** — Update nodes capture why workarounds exist before you forget.  
7. **Motion is product language** — Springs, drops, and graph physics need a shared spec (`motion-physics.md`), not one-off CSS.  
8. **Lean design-system adoption** — Vendored tokens + a semantic CSS bridge beat importing another UI runtime; shell first, then map chat/overlays/media/graph to `--gl-*` without Vue.  
9. **Hierarchy is outlines** — Flat sidebar on a warm canvas + one elevated workspace card beats two bordered panels; one wrong stroke can undo the Figma story.  
10. **Open-state silhouette** — Tabs must live inside the writing shell so corner radius survives when notes open; graph hover identity is node *and* its links.

---

## Connected updates (newest first)

```text
product-build-journal  (you are here)
        │
        ├── [[Building digital garden/updates/UI update 1.2]]
        ├── [[Building digital garden/updates/UI update 1.1]]
        ├── [[Building digital garden/updates/UI update]]
        ├── [[Building digital garden/updates/Bug-fix]]
        ├── [[Building digital garden/updates/User interface]]
        ├── [[Building digital garden/updates/Interaction design]]
        ├── [[Building digital garden/updates/Journal lives in vault folder]]
        ├── [[Building digital garden/updates/Today's restructure]]
        ├── [[Building digital garden/updates/build-chronicler born]]
        ├── [[Building digital garden/updates/MVP closeout]]
        ├── [[Building digital garden/updates/Tree sidebar]]
        ├── [[Building digital garden/updates/Graph - wikilinks]]
        ├── [[Building digital garden/updates/Reliability, CORS, proxy]]
        ├── [[Building digital garden/updates/macOS launcher]]
        └── [[Building digital garden/updates/Foundation - MVP vision]]
```

---

## Current status

| Area | State |
|------|--------|
| MVP core loops | Shipped |
| macOS launcher | Shipped (dev-mode; production build path open) |
| API keys UX | Shipped (`/health` flags + chat banner) |
| Web search | Needs `TAVILY_API_KEY` to verify |
| Build journal | In vault folder `Building digital garden/` (hub + update nodes) |
| Motion & accessibility | Shipped (`motion-physics` rule: chat push, Cmd+K drop, graph physics, reduced-motion/transparency) |
| Editor & sidebar polish | Shipped (wikilink dark-mode CSS variables; journal folder chronological sort + hub pin; light editor surface; mouse-wheel scroll restored) |
| UI update (Pajamas) | Approach A shipped: vendored tokens + `components.css` bridge; shell, shadcn primitives, chat banner, Cmd+K/inline AI, media, graph themes on `--gl-*`. CodeMirror syntax partially migrated; no Vue/`@gitlab/ui` runtime |
| Layout chrome (Figma Desktop — 1) | Shipped: warm page canvas, brand in global topbar, flat sidebar; 1.1 removed sidebar right-edge stroke; **1.2** WorkspaceShell (tabs + card, radius survives open notes, no drop shadow) + graph purple/lavender identity |

---

## MVP verification

Use when testing after changes (check off in update **Test notes** or here):

- [ ] Vault: create, rename, delete, auto-save  
- [ ] Wikilinks: `[[`, autocomplete, graph edge, backlinks  
- [ ] Chat: multi-turn, approve edit, session survives reload  
- [ ] Search: Cmd+K + `?` agentic ask  
- [ ] Undo last AI edit  
- [ ] Double-click **Digital Garden.app**  
- [ ] Web search + insert into note (with Tavily key)  

---

## Open bets

| Bet | Direction |
|-----|-----------|
| Graph linking discoverability | First-run hint on empty graph |
| Launcher reliability | `npm run build && start` in `.app` |
| Multi-vault | Workspaces (post-MVP) |

---

## For agents

**build-chronicler** maintains this system. Rules:

1. **Do not** append long narratives to this hub—add an **update node** and link it below.  
2. **Do** refresh *Current status* / *What I’m learning* here when the product story shifts.  
3. See `.cursor/agents/build-chronicler.md` for filename rules and PM template.

---

*Hub last updated: 31-07-2026*
