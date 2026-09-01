# Atlas design tokens (vendored)

Lean integration of [Atlas](https://github.com/kunu90/atlas) for Digital Garden.

We copy **tokens, shadcn/Base UI primitives, and Material Symbols** — not the Atlas catalog app (`/foundations`, `/preview`, kit shell).

| File | Source |
|------|--------|
| Tokens in `app/globals.css` | Atlas `app/globals.css` (`@theme`, `:root`, `.dark`) |
| `layout.css` | Local page composition restyled to Atlas radii/borders |
| `components.css` | Chat/agent/diff/wikilink/media bridges to Atlas semantic tokens |

- **Pinned commit:** `945072e` (`kunu90/atlas` `main`)
- **Dark mode:** `.dark` class via `next-themes`
- **Default theme:** light
- **Primitives:** `frontend/components/ui/*` from Atlas (`base-nova`, `@base-ui/react`)
- **Icons:** `frontend/components/icon.tsx` (Material Symbols)
