# Today's restructure

*08-07-2026*

← [[Building digital garden/product-build-journal]] · See also: [[Building digital garden/updates/build-chronicler born]]

## Summary

Restructured the build journal into a **hub + connected update nodes**—using Digital Garden itself as the testing ground for linked knowledge.

## Problem

One long journal file doesn’t scale; each build/design/test session deserves its own node linked back to the product story.

## What changed

- **`Building digital garden/product-build-journal.md`** — core hub only (what / plan / why / learning / graph index)
- **`Building digital garden/updates/*.md`** — one file per change session
- **build-chronicler** skill updated to enforce hub + update workflow, PM format, and test notes section

## Why this way

| Decision | Intention |
|----------|-----------|
| Hub vs updates split | Core story stable; deltas append without noise |
| Wikilink graph `[[Building digital garden/updates/...]]` | Dogfood linking—the journal *is* a mini vault |
| **Test notes** on every update | Build journal doubles as QA log while designing |
| PM sections on each node | Every change answers problem → intent → outcome |

## What I learned

The product metaphor (garden, nodes, links) should apply to **how we document the product**, not only how users take notes.

## Test notes

- [ ] Open `product-build-journal` in vault (or project) → follow wikilink to an update node
- [ ] Graph shows hub connected to update notes (when journal lives in active vault)
- [ ] Ask build-chronicler to log a small change → new human-titled update node appears
