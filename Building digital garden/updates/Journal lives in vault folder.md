# Journal lives in vault folder

*08-07-2026*

← [[Building digital garden/product-build-journal]] · See also: [[Building digital garden/updates/Today's restructure]]

## Summary

Moved the entire build journal into a vault folder named **Building digital garden** so it shows up in the app sidebar and graph as real notes—not repo-only files at the project root.

## Problem

The journal lived at `product-build-journal.md` and `journal/updates/` in the codebase root. That made version control easy but didn’t dogfood the product: the notes weren’t in the active vault (`~/test`), so wikilinks and graph didn’t reflect how a user actually organizes work.

## What changed

- New folder: `Building digital garden/` with hub + `updates/` subfolder
- Migrated all existing update nodes and refreshed wikilink paths
- Copied journal into active vault at `~/test/Building digital garden/`
- Updated **build-chronicler** paths and rules
- Removed old `journal/` tree and root `product-build-journal.md`

## Why this way

| Decision | Rationale |
|----------|-----------|
| Folder name matches intent | “Building digital garden” reads as a project area in the vault tree |
| Keep hub + updates split | Same graph model as before—stable core node, dated satellites |
| Sync to vault | Journal is a testing ground; it must be visible in the app without manual symlink steps |

## What I learned

1. **Location is UX** — If notes aren’t in the vault, the graph/backlink features feel broken even when code is fine.  
2. **Path-stable wikilinks** — Full vault-relative paths (`Building digital garden/updates/...`) survive folder moves better than implicit stems.

## Test notes

- [ ] Open vault `~/test` → sidebar shows **Building digital garden** folder  
- [ ] Open `product-build-journal` → wikilinks resolve to update nodes  
- [ ] Graph shows edges between hub and updates  
- [ ] Backlinks on an update node point back to hub  
