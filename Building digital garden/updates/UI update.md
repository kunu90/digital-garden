# UI update

*29-07-2026*

← [[Building digital garden/product-build-journal]]

## Summary

As UX designer I directed a lean migration of Digital Garden’s UI toward GitLab’s Pajamas design system—tokens and visual language only, no Vue component runtime. Pass one restyled shell chrome (topbar, sidebar, file tree, tabs, empty pane, Button). Pass two finished the semantic bridge and brought chat, overlays, media, graph themes, and shadcn primitives onto `--gl-*` surfaces so the whole product frame reads as one system.

## Problem

The product’s chrome still read as generic shadcn defaults: softer radii, noisier borders, accents that didn’t belong to a coherent system. Adopting `@gitlab/ui` wholesale would drag Vue and a heavy component library into a React app—frontend bloat for a look we only needed as tokens and density. After the shell felt right, inner surfaces (chat banners, dialogs, Cmd+K, media toolbars, graph canvas) still carried leftover oklch palettes and Tailwind amber/warning one-offs that broke the Pajamas story in dark and light.

## What changed

### Pass 1 — shell / layout

1. **Vendored Pajamas tokens** from `@gitlab/ui@135.1.0` into `frontend/styles/pajamas/` (`tokens.css`, `tokens.dark.css`)—not a production dependency. Dark selectors patched for `next-themes` `.dark`. Refresh via `scripts/update-pajamas-tokens.sh`; README records version and date.
2. **Layout composition** via `layout.css`; workspace card, top bar, panels, tab bar on `--gl-*` surfaces/borders.
3. **Shell restyle** for Pajamas density (tighter radii ~4px, quieter borders, GitLab blue accents): topbar, sidebar (GitLab-style collapse), file tree, tab bar, empty editor pane; editor background on `--gl-background-color-default`.
4. **Button** aligned to Pajamas confirm / outline / ghost / danger / link (~32px default height).

### Pass 2 — rest of Pajamas elements (this session)

1. **`frontend/styles/pajamas/components.css` (new)** — semantic bridge for chat/agent/diff/wikilink tokens to `--gl-*`; inline AI chrome; command center overlay/panel; media toolbar/stage helpers. Dark inherits from `tokens.dark.css` (no duplicate oklch palettes).
2. **`frontend/app/globals.css`** — removed large light/dark oklch chat palettes; imports `components.css`; inline AI / Cmd+K / diff-line / table / cm-rendered-table restyled to Pajamas borders, surfaces, and feedback colors.
3. **shadcn/ui primitives** on Pajamas tokens:
   - `button.tsx` — confirm/outline/danger hover from button tokens
   - `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx` — overlay + overlap surface + strong border
   - `dropdown-menu.tsx`, `context-menu.tsx` — overlap + strong border; danger = feedback-danger
   - `tooltip.tsx` — `feedback-strong-*`
   - `input.tsx` — control border/bg/focus/placeholder; denser height
   - `toggle.tsx` — strong bg when pressed; control outline variant
4. **Chat** — API-key banner uses warning feedback tokens (not amber Tailwind).
5. **File tree** — search highlight mark → status-warning tokens.
6. **Media viewers** — image/pdf toolbars → `.dg-media-toolbar`; image/video stages → `.dg-media-stage`; audio accent → `--gl-color-blue-500`.
7. **Graph** — DARK/LIGHT themes remapped to oklch equivalents of Pajamas neutrals/blues/status hues (canvas animation still needs oklch).
8. **CodeMirror** — structure + highlight themes migrating to `--gl-text-*` / `--gl-color-*`; **editor syntax theme partially migrated** if highlight coverage is still incomplete.
9. **README** — `frontend/styles/pajamas/README.md` documents `components.css` as the app semantic bridge.

### Explicit non-goals (this pass)

- No Vue / `@gitlab/ui` runtime installed
- Full custom-agent / slash-command UI not in scope

See also: [[Building digital garden/updates/User interface]], [[Building digital garden/updates/Interaction design]].

## Why this way

| Decision | Rationale |
|----------|-----------|
| **Approach A** — tokens + restyle existing React/shadcn | Keeps the stack we own; no Vue, no `@gitlab/ui` runtime |
| **Vendor tokens, don’t depend** | Pin a known good snapshot; refresh script when we choose to upgrade |
| **Shell chrome first, then semantic bridge** | Frame proves density; `components.css` then retires duplicate palettes without rewriting every component |
| **Map shadcn primitives to `--gl-*`** | One overlay/surface/border language across dialogs, menus, tooltips, inputs |
| **Graph keeps oklch in JS** | Canvas theme API needs concrete colors; map to Pajamas hues, don’t invent a second palette |
| **Defer custom-agent UI** | Design-system pass ≠ feature surface; don’t claim slash commands shipped |

## What I learned

1. **Design systems travel as tokens first** — you can adopt Pajamas density and color without importing the component library.
2. **Chrome before canvas, bridge before one-offs** — shell proved the approach; a single `components.css` bridge killed the leftover chat/oklch drift.
3. **Semantic bridges beat find-replace** — mapping app CSS variables to `--gl-*` lets one theme change ripple without hunting every component.
4. **Feedback tokens replace Tailwind amber** — banners and search marks stay coherent in dark mode when they use status/feedback tokens, not ad-hoc utility colors.

## Test notes

Dogfooding checklist—verify in Digital Garden:

### Shell (pass 1)

- [ ] Soft-refresh the app; topbar, sidebar, and tab bar show tighter (~4px) radii and quieter borders
- [ ] Primary / accent actions use GitLab blue
- [ ] File tree selection and hover match the new density; sidebar collapse feels GitLab-style
- [ ] Empty editor pane matches the restyled shell
- [ ] Buttons: confirm, outline, ghost, danger, link; default height ~32px
- [ ] Toggle light ↔ dark; shell tokens stay coherent under `.dark`

### Surfaces & primitives (pass 2)

- [ ] Chat API-key banner uses warning feedback (not amber Tailwind); readable in light and dark
- [ ] Open a dialog / sheet / alert — overlay + overlap surface + strong border match menus
- [ ] Dropdown and context menus use overlap surface; destructive items use feedback-danger
- [ ] Tooltip uses strong feedback styling
- [ ] Inputs look denser; focus ring uses control tokens
- [ ] Toggle pressed state uses strong background
- [ ] Cmd+K overlay/panel and inline AI chrome match Pajamas surfaces/borders
- [ ] Diff preview / diff lines use feedback/surface tokens from the bridge
- [ ] File-tree search highlight uses status-warning tokens
- [ ] Image/PDF toolbars and image/video stages use media helpers; audio accent is blue-500
- [ ] Graph light and dark themes read as Pajamas neutrals/blues/status hues
- [ ] Editor syntax highlighting: spot-check headings/code; note any remaining non-`--gl-*` colors (partial migration OK)
- [ ] Confirm no Vue / `@gitlab/ui` package in the frontend dependency tree
- [ ] Open journal hub + this update via wikilinks; graph still connects them
