# Graph / wikilinks

*07-07-2026*

← [[Building digital garden/product-build-journal]] · See also: [[Building digital garden/updates/Reliability, CORS, proxy]]

## Summary

Clarified **how notes connect on the graph** and fixed backend so links render after save.

## Problem

I tried to drag between graph nodes to connect notes—nothing happened. The graph felt broken even when the product was working as designed.

## What changed

- Documented wikilink authoring: `[[Other Note]]` in markdown (not canvas drag)
- Autocomplete on `[[`
- Backlinks panel shows reverse links
- Fixed graph 500 when wikilinks present (`name_lookup` bug)

## Why this way

**Intention:** Graph = mirror of written relationships, not a diagram editor.  
**Why:** Obsidian-trained users already link in prose; drag-to-connect would duplicate authoring and hide the mental model.

## What I learned

Separate **visualisation** from **authoring**. Teach one gesture; the graph rewards it.

## Test notes

- [ ] Two notes + one `[[wikilink]]` → one edge, correct direction
- [ ] Unresolved wikilink → no ghost node on graph (only real notes appear)
