# Foundation / MVP vision

*05-07-2026*

← [[Building digital garden/product-build-journal]]

## Summary

Established the product foundation: **Digital Garden** as “Cursor for Writing” on a local Obsidian-like vault.

## Problem

Note tools split two jobs—linked thinking (Obsidian) and AI-assisted editing (Cursor). I wanted one owned surface where files stay on disk and AI helps without taking over.

## What shipped

- Product blueprint in `note-taker.md`
- Core MVP scope: vault, wikilinks, chat with tools, diff/approve, graph, backlinks, agentic search, web search (BYOK)
- Stack decision: FastAPI + Next.js + Claude

## Why this way

| Decision | Intention |
|----------|-----------|
| Local `.md` vault | User owns data; no account for MVP |
| Wikilinks not graph drawing | Links are authored in prose; graph reflects writing |
| Approve-before-write | Human remains author; AI is collaborator |
| `.garden/` metadata | Sessions and edit history beside notes, not in cloud |

## What I learned

Start with one loop—**open → write → link → ask AI → apply**—before adding surfaces. The blueprint is the product contract.

## Test notes

_Use this section when dogfooding: what you tried in the app, what felt right/wrong._

- [ ] Onboarding → first note → first wikilink → graph shows edge
