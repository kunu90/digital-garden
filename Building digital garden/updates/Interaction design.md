# Interaction design

*10-07-2026*

← [[Building digital garden/product-build-journal]] · See also: [[Building digital garden/updates/Journal lives in vault folder]], [[Building digital garden/updates/Graph - wikilinks]]

## Summary

We codified a motion and physics language for Digital Garden in a Cursor user rule (`motion-physics.md`) and implemented it across the AI chat sidebar, command palette, and graph canvas—plus OS-level accessibility guardrails for reduced motion and reduced transparency. Earlier the same day we also cleaned up ghost graph nodes and finished moving the build journal into the vault folder structure.

## Problem

The product needed intentional, consistent motion language (push, drop, graph physics)—not ad-hoc CSS animations scattered across components. At the same time, motion that ignores system accessibility settings (Reduce Motion, Reduce Transparency) fails basic OS compliance and can make the app unusable for some users.

## What changed

### Motion-physics rule implementation

**Component 1 — AI Chat Sidebar Push**
- Installed `framer-motion`
- Chat toggle pushes editor canvas via `<LayoutGroup>` + layout springs
- Spring profile: `{ type: "spring", bounce: 0, duration: 0.4 }`
- Files: `frontend/app/page.tsx`, `frontend/lib/motion.ts`, `frontend/hooks/use-layout-transition.ts`, `frontend/components/motion-provider.tsx`

**Component 2 — Global Command Palette (Cmd+K)**
- Drops from y: -100px above viewport center; symmetric exit on same trajectory
- Snappy spring: `{ type: "spring", bounce: 0.12, duration: 0.25 }`
- No scale animation
- Files: `frontend/components/command-center.tsx`, `frontend/hooks/use-command-palette-transition.ts`

**Component 3 — Note Graph Canvas Nodes**
- OKLCH color interpolation on hover/select (0.35s), no radius/scale changes on activation
- Removed glow shadows that implied size change
- Grab-offset drag (node doesn't jump to cursor center)
- Throw momentum on release + pan momentum with exponential decay
- Double-click toggles pin (no auto-pin on drop)
- Files: `frontend/lib/oklch.ts`, `frontend/components/graph-view.tsx`

**Accessibility guardrails (section 2 of motion-physics)**
- `MotionProvider` + `useMotionAccessibility()` — tracks `prefers-reduced-motion` and `prefers-reduced-transparency`
- Reduced motion: eliminate x/y/scale/layout springs → opacity cross-fade `0.2s ease-out` only
- Chat: no width push when reduced motion; opacity fade only
- Command palette: no vertical drop when reduced motion
- Graph: instant colors, no throw/pan momentum when reduced motion
- Reduced transparency: CSS `@media (prefers-reduced-transparency: reduce)` — `backdrop-filter: none`, solid `var(--background)` / `var(--popover)` on cmd overlay, panels, `.a11y-glass` surfaces
- Files: `frontend/app/globals.css`, graph/media viewer `a11y-glass` classes

### Earlier same day

- Graph: removed unresolved ghost nodes (backend + frontend sanitize)
- Build journal moved to `Building digital garden/` vault folder; human-readable update filenames
- `product-build-journal.md` moved to folder root above `updates/`

## Why this way

| Decision | Rationale |
|----------|-----------|
| Cursor rule as source of truth | Motion specs live beside the code workflow; agents and humans share one contract |
| Critically damped springs for layout | Push feels structural, not bouncy—editor and chat share space, not perform a transition |
| OKLCH for graph colors | Perceptually uniform interpolation; hover/select reads as state, not size |
| Grab-offset + throw momentum | Graph feels like a physical surface without nodes snapping to cursor center |
| No scale on command palette | Drop-from-above is enough; scale would fight the “utility overlay” mental model |
| `prefers-reduced-motion` as first-class | Respect OS setting; cross-fade preserves affordance without vestibular risk |
| Solid surfaces when transparency reduced | Blur/glass is decorative; content legibility wins under Reduce Transparency |

## What I learned

1. **Motion is a product language** — Push, drop, and throw aren't polish; they communicate hierarchy (sidebar vs overlay vs canvas).  
2. **Accessibility isn't a separate pass** — Baking `MotionProvider` and media-query fallbacks in with the first implementation avoids retrofitting every animation later.  
3. **Graph feel ≠ graph features** — Removing ghost nodes and tuning drag physics changed perceived quality as much as new linking features.

## Test notes

- [ ] Toggle AI chat — editor pushes smoothly (full motion); with Reduce Motion ON — opacity fade only, no push
- [ ] Cmd+K — palette drops from above; with Reduce Motion — cross-fade only
- [ ] Graph — hover color shifts without size change; drag with grab offset; throw on release
- [ ] Reduce Transparency ON — command overlay and graph controls are solid, no blur
- [ ] Sync journal note visible in vault sidebar under Building digital garden/updates/
