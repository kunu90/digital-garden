# UI update 1.1

*30-07-2026*

← [[Building digital garden/product-build-journal]]

## Summary

This pass closes the gap between Figma Desktop — 1 and the running app’s chrome. The layout now reads as one warm page canvas with a flat notes sidebar and a single elevated workspace card. The focus of 1.1 was a stubborn sidebar right-edge stroke that still treated navigation as a bordered panel—undermining the “sidebar on canvas / workspace as focus” hierarchy we designed.

## Problem

Figma called for continuity: sidebar and page share the same warm surface (`#fbfaf9`); only the workspace card lifts. In the app, a vertical rule still separated sidebar from body. That stroke made the sidebar feel like a competing card instead of quiet navigation on the canvas—so the eye split between two framed regions instead of resting on the writing surface.

The cause was a selector miss, not a design change: shadcn’s Sidebar paints `group-data-[side=left]:border-r` on the container itself, while our override targeted a child. Intent and pixels disagreed.

## What changed

### Layout (Figma Desktop — 1 alignment)

- **Global top bar** sits above the page body—brand (“Digital Garden” + sprout) and actions live in chrome, not in the sidebar.
- **Page body** is a row: notes sidebar + ChromeMain / WorkspaceCard.
- **Warm page canvas** `#fbfaf9`; sidebar sits flat and transparent on that surface (not its own card).
- **Workspace card** insets from page edges (Figma-style pl-8 / pr-12 / py-12 feel), 8px radius, soft shadow, default border—the primary elevated surface for editing.
- **Topbar** is transparent, no bottom stroke; brand + actions stay in global chrome.

### Sidebar stroke fix (1.1)

- **Intent:** no vertical stroke between sidebar and page/workspace—continuous with the warm canvas.
- **Fix:** correct selector to `.dg-chrome-sidebar[data-slot="sidebar-container"]` with border none; matching Tailwind `group-data-[side=left]:border-r-0`.
- **Kept on purpose:** filter input border, tree nest guide lines, footer “Collapse sidebar” divider—content affordances, not a sidebar outline.

### Surfaces (carry-forward)

Outlines and surfaces still follow Pajamas border/surface roles where applied; tree selection uses the warm beige selected state from Figma.

See also: [[Building digital garden/updates/User interface]], [[Building digital garden/updates/UI update]].

## Why this way

| Decision | Rationale |
|----------|-----------|
| **Flat sidebar / elevated workspace** | Navigation should recede; the writing surface should be the only “object” on the page |
| **No sidebar outline** | A vertical rule recreates a second card and flattens visual hierarchy |
| **Brand in topbar** | Product identity belongs to chrome, not the notes tree—sidebar stays about files |
| **Keep internal chrome** | Filter, nest guides, and collapse divider help wayfinding; they are not a panel frame |
| **Fix the selector, don’t redesign** | Figma was already right; the app needed to match the container that owns the border |

## What I learned

1. **Hierarchy is felt as outlines** — one wrong border turns “nav on canvas” into “two competing panels.”
2. **Overrides must hit the painted node** — component libraries put borders on containers; child selectors silently fail.
3. **Internal lines ≠ frame** — content affordances can stay crisp while the panel silhouette dissolves into the page.

## Test notes

Dogfooding checklist—verify in Digital Garden:

- [ ] Soft-refresh; page canvas reads warm `#fbfaf9` behind sidebar and body
- [ ] Sidebar has **no** right-edge vertical stroke against the workspace
- [ ] Workspace card is inset, rounded (~8px), softly elevated; feels like the primary surface
- [ ] Topbar is transparent with no bottom hairline; brand + sprout sit in the global bar (not sidebar)
- [ ] Filter input still has its own border; nest guide lines and “Collapse sidebar” divider still appear
- [ ] Tree selection uses warm beige selected state
- [ ] Open this note via [[Building digital garden/updates/User interface]] and the hub; graph still connects them
