# User interface

*31-07-2026*

← [[Building digital garden/product-build-journal]] · See also: [[Building digital garden/updates/UI update 1.2]], [[Building digital garden/updates/UI update 1.1]], [[Building digital garden/updates/UI update]], [[Building digital garden/updates/Interaction design]], [[Building digital garden/updates/Tree sidebar]]

## Summary

Digital Garden’s UI direction is **Pajamas-adjacent without Vue**: vendored GitLab design tokens, a semantic CSS bridge, and restyled React/shadcn surfaces—plus a chrome layout that matches Figma. The product frame should feel like a warm page with quiet navigation and one continuous writing shell (tabs + editor). Session detail for tokens lives in [[Building digital garden/updates/UI update]]; sidebar hierarchy in [[Building digital garden/updates/UI update 1.1]]; shell continuity and graph identity in [[Building digital garden/updates/UI update 1.2]].

## Craft & feel (latest)

The shell is no longer “sidebar card + editor card.” It is **one canvas, one focus**—and the writing surface itself is one silhouette:

- **Warm page** (`#fbfaf9`) runs under the notes sidebar and the body. The sidebar sits flat—transparent on that surface—so it reads as navigation, not a second framed object.
- **WorkspaceShell** wraps **tabs + WorkspaceCard** in one 8px-radius bordered container. Opening a note no longer flattens the top corners; the radius is a contract with the open state. Drop shadow removed—focus comes from border and inset, not float.
- **Tabs** live inside that shell: warm active page (`#f5f2ee`), purple bottom accent (`#6349be`), inactive tabs on the page-canvas feel.
- **Global top bar** owns brand and actions above the body; the sidebar no longer carries the product name. Chrome stays light (transparent bar, no bottom stroke).
- **No sidebar outline.** [[Building digital garden/updates/UI update 1.1]] removed the vertical stroke so nav doesn’t compete with writing. Internal chrome stays: filter border, nest guides, collapse divider.
- **Graph identity:** default notes and edges deep purple (`#503D7D`); hover lights the node *and* its links soft lavender (`#EBCFFF`)—the neighborhood, not just the fill. Thicker strokes with softer light-mode opacity so weight doesn’t shout.

Opening the app should feel calm: page first, continuous write shell second, tree as a quiet rail—graph purple that matches the product, not a foreign diagram.

## Product direction

| Choice | Intent |
|--------|--------|
| **Approach A** | Tokens + restyle existing React/shadcn — **no** `@gitlab/ui` / Vue runtime |
| **Vendored tokens** | `frontend/styles/pajamas/` (`tokens.css`, `tokens.dark.css`) pinned from `@gitlab/ui@135.1.0`; refresh script, not a live dependency |
| **Semantic bridge** | `components.css` maps chat/agent/diff/wikilink, inline AI, Cmd+K, and media helpers to `--gl-*`; dark inherits from `tokens.dark.css` |
| **Shell first, then surfaces** | Topbar / sidebar / tree / tabs, then dialogs, menus, chat banner, media toolbars, graph themes |
| **Flat sidebar / elevated workspace** | Navigation recedes on the warm canvas; the writing shell is the sole focus object (→ [[Building digital garden/updates/UI update 1.1]], [[Building digital garden/updates/UI update 1.2]]) |
| **Tabs inside the shell** | One radius, one silhouette—open notes must not break the Figma frame |

## What’s in place

### Layout chrome (1.2)

- WorkspaceShell: tabs + WorkspaceCard in one 8px-radius bordered container; radius survives open notes
- Workspace drop shadow removed; tab bar warm active + purple accent inside the shell
- Graph: purple default nodes/edges; lavender hover on node *and* connected edges; thicker strokes with tuned opacity

### Layout chrome (1.1)

- Global topbar above body; brand + sprout in chrome
- Page body: flat sidebar + workspace inset on warm canvas
- Sidebar right-edge stroke removed (correct container selector); internal affordances kept

### Design system

- App globals import Pajamas tokens + `components.css`; large duplicate oklch chat palettes removed
- shadcn primitives (button, dialog/alert/sheet, dropdown/context menu, tooltip, input, toggle) use overlap/control/feedback tokens
- Chat API-key banner → warning feedback; file-tree search mark → status-warning
- Media: `.dg-media-toolbar` / `.dg-media-stage`; audio accent `--gl-color-blue-500`
- Graph DARK/LIGHT themes remapped to Pajamas-equivalent oklch hues
- CodeMirror structure/highlight themes migrating to `--gl-*` (**syntax theme partially migrated**)

### Earlier editor & tree polish

- Wikilink colors via CSS variables + `.dark` (readable contrast in the editor)
- `Building digital garden/updates/` chronological `sort_at` ordering; hub pinned first

### Explicitly not claimed

- No Vue component library in the app
- Custom-agent / slash-command UI not part of the Pajamas pass

## Why this way

Writers judge the product by **where the eye rests**. A bordered sidebar and a bordered workspace read as peers; a flat rail and one continuous shell read as “I’m here to write.” Importing a second UI runtime would fight our React stack; vendored tokens + a bridge give Pajamas coherence without GitLab’s Vue components. Layout hierarchy and token density stay complementary: tokens set language; composition sets focus. Graph color is identity—hover must agree on node and edge.

Motion, Cmd+K drop, and graph physics remain specified in `motion-physics` / [[Building digital garden/updates/Interaction design]]—visual tokens and interaction physics stay separate concerns.

## What I learned

1. **Tokens travel; runtimes don’t have to** — Pajamas density ships without Vue.
2. **One bridge beats many palettes** — retiring oklch chat duplicates made light/dark feel like one system.
3. **Theme decorations in CSS** — Wikilinks and CM chrome stay readable when they share the same variable surface as the shell.
4. **Outlines decide hierarchy** — removing one wrong sidebar stroke closed more of the Figma gap than another token pass would have.
5. **Open-state silhouette** — tabs inside the shell keep radius honest when notes are open ([[Building digital garden/updates/UI update 1.2]]).

## Test notes

Quick smoke (full checklists in [[Building digital garden/updates/UI update 1.2]], [[Building digital garden/updates/UI update 1.1]], and [[Building digital garden/updates/UI update]]):

- [ ] Soft-refresh; warm canvas, flat sidebar (no right stroke), continuous workspace shell (tabs + editor, radius intact when notes open)
- [ ] No workspace drop shadow; active tab warm with purple accent
- [ ] Graph: purple default; hover node *and* edges lavender together
- [ ] Topbar transparent; brand in global chrome; filter / nest guides / collapse divider still present
- [ ] Shell + dialogs/menus share Pajamas density and `--gl-*` borders/surfaces
- [ ] Toggle light ↔ dark; chat banner, Cmd+K, media toolbars, and graph stay coherent
- [ ] Dark-mode `[[wikilinks]]` remain readable; journal `updates/` still chronological with hub pinned
- [ ] Confirm frontend has no `@gitlab/ui` / Vue dependency
