# Bug-fix

*15-07-2026*

← [[Building digital garden/product-build-journal]]

## Summary

Fixed a regression where notes could not be scrolled with the mouse wheel. A duplicate `className` on the markdown editor wrapper dropped the height constraint that makes the editor pane scrollable. Same thread also shipped a light-mode editor surface color (`#F8FAFB`) via `--editor-bg` / `bg-editor-bg`.

## Problem

Users could not scroll long notes with the mouse wheel. Content grew past the pane; parents use `overflow-hidden`, so the overflow was clipped with no scroll container—wheel input did nothing.

Root cause: when the light-mode editor background was set to `#F8FAFB`, a duplicate `className` was left on the markdown editor wrapper in `frontend/components/markdown-editor.tsx`. In React, the second attribute overwrites the first, so `h-full` was lost and only `bg-editor-bg` remained.

## What changed

- Merged the duplicate attributes into a single className: `h-full bg-editor-bg` on the markdown editor wrapper.
- Light-mode editor surface color `#F8FAFB` via `--editor-bg` / `bg-editor-bg` on the editor pane, tab bar, backlinks, and markdown editor (same broader thread).

See also: [[Building digital garden/updates/User interface]] (wikilink dark mode + sidebar sort).

## Why this way

| Decision | Rationale |
|----------|-----------|
| One-line className merge | Restores height so the editor stays the scroll container; minimal, targeted fix |
| Keep `bg-editor-bg` | Preserves the new light-mode surface without reintroducing the bug |
| No layout rewrite | Parents already clip correctly once the child is height-constrained |

## What I learned

1. **Duplicate JSX attributes are silent**—React keeps the last one; height and scroll bugs can look like “mouse wheel broken” instead of “lost class.”
2. **Scroll needs a bounded box**—without `h-full` (or equivalent), overflow parents hide content rather than scroll it.
3. **Visual polish and layout classes travel together**—background-token changes are a common place for accidental attribute collisions.

## Test notes

Dogfooding checklist—verify in Digital Garden:

- [ ] Open a long note (content taller than the editor pane)
- [ ] Scroll with the mouse wheel inside the editor — content moves
- [ ] Confirm the light editor surface looks correct (`#F8FAFB` / soft cool gray)
- [ ] Toggle or check that editor, tab bar, and backlinks share the same surface feel
- [ ] Spot-check dark mode still looks fine (no regression from the className merge)
