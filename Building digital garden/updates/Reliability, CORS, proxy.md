# Reliability, CORS, proxy

*07-07-2026*

← [[Building digital garden/product-build-journal]]

## Summary

Fixed **false “backend down”** errors and made recovery paths explicit when the app looks running but vault/graph/chat fail.

## Problem

Users saw “Backend not running on port 8000” when the API was up—CORS, stale processes, and split ports (3000 vs 3002 vs 3003) eroded trust.

## What shipped

- Clearer onboarding error when backend is actually unreachable
- Backend CORS broadened for local dev ports
- Next.js **API proxy** (`/backend-api` → port 8000)
- `restart-digital-garden.sh`; launcher detects broken graph and restarts
- Graph API fix: `name_lookup` in `get_graph()` (links no longer 500 the graph)

## Why this way

| Decision | Intention |
|----------|-----------|
| Same-origin proxy | Browser security shouldn’t feel like “app broken” |
| Separate messages for config vs infra | User knows whether to restart or edit `.env` |
| Health + graph check on launch | Stale backend code shouldn’t silently poison UX |

## What I learned

Design the **recovery path** as carefully as the happy path. Personal software that only works from the “right” terminal isn’t personal.

## Test notes

- [ ] Open Vault with only frontend running → helpful error
- [ ] Add `[[link]]` → Graph tab shows edge after save
- [ ] `bash scripts/restart-digital-garden.sh` recovers from stuck state
