# Tree sidebar

*07-07-2026*

← [[Building digital garden/product-build-journal]] · See also: [[Building digital garden/updates/Graph - wikilinks]]

## Summary

Redesigned the **left sidebar** into a docs-style tree: Folder → Note 1 → Note 2.

## Problem

The file list didn’t function as spatial navigation—a vault needs scannable hierarchy, not a flat inventory.

## What changed

- Vertical indent guides per depth
- Chevron on the **right** for folders
- Note labels without `.md` suffix
- Auto-expand folders on load (shallow depth)

## Why this way

**Intention:** Sidebar = map of where ideas live.  
**Why:** Docs-site patterns (guides, config trees) are already learned UI; less icon noise, faster scan.

## What I learned

Reuse navigation patterns users already know instead of inventing a new file-manager dialect.

## Test notes

- [ ] Create folder → nested notes → tree reflects depth
- [ ] Expand/collapse persists within session
- [ ] Drag note into folder still works
