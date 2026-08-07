# UI update 1.2

*31-07-2026*

← [[Building digital garden/product-build-journal]]

## Summary

This pass finishes the writing surface as one object: tabs and editor share a single rounded shell so the workspace keeps its corner radius when notes are open. It also gives the graph a clearer identity—deep purple notes by default, soft lavender on hover for both the node and its links—so the map feels like the same product as the chrome, not a separate diagram skin.

Builds on [[Building digital garden/updates/UI update 1.1]].

## Problem

Figma (workspace frame, node 20:2) put the tab strip *with* the writing surface—one bordered, 8px-radius container. In the app, tabs and card were composed so opening a note flattened the top corners and the radius disappeared. The workspace also still carried a drop shadow the design no longer wanted; hierarchy should come from the shell’s edge and placement, not a floating lift.

On the graph, default note purple and hover lavender disagreed with their edges: hover links stayed dark while nodes went light, so the “connected neighborhood” story broke on first hover. Stroke weight and light-mode opacity also needed rebalancing so thicker lines wouldn’t dominate the canvas.

## What changed

### Layout — tabs inside the writing shell

- Recreated the workspace from Figma: tab strip sits with the writing surface, not as a floating strip above it.
- Introduced **WorkspaceShell** — one outer 8px-radius bordered container wrapping **tabs + WorkspaceCard**, so corner radius survives when notes are open.
- Removed the workspace card drop shadow (by request)—the shell’s border and inset placement carry the focus.
- Tab bar restyled: warm active tab `#f5f2ee`, purple bottom accent `#6349be`, page-canvas feel for inactive tabs.
- Tabs live *inside* the shell so the silhouette stays continuous.

### Graph view palette

- Default note nodes: `#503D7D` → `oklch(0.412 0.105 295.1)`
- Default connectors/edges: same purple family (theme-tuned opacity)
- Hover node + hover-connected edges: `#EBCFFF` → `oklch(0.893 0.071 311.1)` — must match; hover links were wrong/dark before
- Thickened edge strokes (default ~2px, hover ~3px); softened light-mode edge opacity so thicker lines don’t dominate; dark mode edges a bit stronger for contrast

See also: [[Building digital garden/updates/User interface]], [[Building digital garden/updates/UI update 1.1]], [[Building digital garden/updates/Graph - wikilinks]].

## Why this way

| Decision | Rationale |
|----------|-----------|
| **One shell for tabs + card** | Hierarchy is one focus surface; split chrome breaks the radius and reads as two objects |
| **Radius must survive tab open** | Opening a note is the common path—if corners flatten then, the Figma story fails exactly when writers need calm |
| **No drop shadow on the card** | Elevation via border + inset is quieter; shadow competed with the warm page |
| **Warm active tab + purple accent** | Active page feels like paper on canvas; purple ties tabs to brand without loud fill |
| **Purple default / lavender hover on node *and* edges** | Graph identity is the linked neighborhood, not the node alone—hover must light the path too |
| **Thicker strokes, softer light opacity** | Weight for readability; opacity so light mode doesn’t turn into a purple scribble |

## What I learned

1. **Shell continuity is a feeling** — writers notice when the writing surface “breaks” at the top more than they notice token names.
2. **Radius is a contract with open state** — empty and populated layouts must share the same silhouette.
3. **Hover is a relationship, not a fill** — if node and edge disagree on hover, the graph lies about what’s connected.

## Test notes

Dogfooding checklist—verify in Digital Garden:

- [ ] Soft-refresh; open one or more notes—workspace keeps continuous 8px top corners (tabs + editor in one shell)
- [ ] No drop shadow on the workspace card; focus reads from border + inset on the warm page
- [ ] Active tab is warm `#f5f2ee` with purple bottom accent; inactive tabs feel like page canvas
- [ ] Open Graph view: default notes and edges read deep purple (`#503D7D` / family)
- [ ] Hover a note: node *and* its connected edges go soft lavender (`#EBCFFF`) together
- [ ] Edges feel thicker (~2px / ~3px hover) without dominating in light mode; dark mode edges remain readable
- [ ] Open this note via [[Building digital garden/updates/User interface]] and the hub; graph still connects them
