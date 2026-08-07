# Pajamas design tokens (vendored)

Lean integration of [GitLab Pajamas](https://design.gitlab.com/) for Digital Garden.
We vendor **CSS design tokens only** — no Vue `@gitlab/ui` components.

| File | Source |
|------|--------|
| `tokens.css` | `@gitlab/ui` → `src/tokens/build/css/tokens.css` |
| `tokens.dark.css` | same, dark mode overrides |
| `layout.css` | Local — [Pajamas page composition](https://design.gitlab.com/product-foundations/layout) |
| `components.css` | Local — chat/agent, command center, inline AI, media chrome bridges to `--gl-*` |

- **Pinned version:** `@gitlab/ui@135.1.0`
- **Vendored:** 2026-07-29
- **Dark mode:** `tokens.dark.css` selectors were rewritten from `:root.gl-dark` → `.dark` so they work with `next-themes` (`attribute="class"`).
- **Layout:** `layout.css` defines application chrome + panel regions (static / dynamic / AI) and content-container tones. React wrappers live in `components/layout/page-composition.tsx`.
- **Components:** `components.css` maps app semantic vars (`--chat-*`, `--diff-*`, `--wikilink-*`, etc.) to Pajamas feedback/status/surface/border roles so dark mode follows `--gl-*` without duplicate oklch palettes.

## Refresh tokens

From the repo root:

```bash
bash scripts/update-pajamas-tokens.sh [version]
# default version: 135.1.0
```

That script packs `@gitlab/ui`, copies the two CSS files here, and re-applies the `.dark` selector patch. It does **not** add `@gitlab/ui` to `package.json`.

## Usage

Imported from `app/globals.css`. App semantic tokens (`--background`, `--sidebar`, etc.) are bridged to `--gl-*` variables in that file. Prefer `--gl-*` (or bridged `--chat-*` / shadcn aliases) over hard-coded colors.
