import re
from pathlib import Path

from fastapi import APIRouter, HTTPException

from vault_config import get_vault_path

router = APIRouter(prefix="/graph", tags=["graph"])

# Matches [[Note Name]], [[Note Name|Alias]], [[Note Name#heading]]
WIKILINK_RE = re.compile(r"\[\[([^\[\]|#\n]+?)(?:[|#][^\]]+)?\]\]")


def _vault() -> Path:
    path = get_vault_path()
    if path is None:
        raise HTTPException(status_code=400, detail="Vault not configured.")
    return path


def _build_name_lookup(all_notes: dict[str, Path]) -> dict[str, str]:
    """Map lowercase name variants → rel_path for link resolution."""
    lookup: dict[str, str] = {}
    for rel in all_notes:
        p = Path(rel)
        stem_lower = p.stem.lower()
        rel_lower = rel.lower()
        no_ext_lower = str(p.with_suffix("")).lower()
        for key in (stem_lower, rel_lower, no_ext_lower):
            if key not in lookup:
                lookup[key] = rel
    return lookup


def _collect_notes(vault: Path) -> dict[str, Path]:
    root = vault.resolve()
    all_notes: dict[str, Path] = {}
    for md_file in sorted(root.rglob("*.md")):
        if ".garden" in md_file.parts:
            continue
        rel = str(md_file.relative_to(root))
        all_notes[rel] = md_file
    return all_notes


def _resolve_target_keys(target_path: str) -> set[str]:
    """Return lowercase name variants that resolve to target_path."""
    p = Path(target_path)
    keys = {
        target_path.lower(),
        p.stem.lower(),
        str(p.with_suffix("")).lower(),
    }
    return keys


def _excerpt_around_link(content: str, link_match: re.Match[str], radius: int = 60) -> str:
    start = max(0, link_match.start() - radius)
    end = min(len(content), link_match.end() + radius)
    snippet = content[start:end].replace("\n", " ").strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(content):
        snippet = snippet + "…"
    return snippet


@router.get("/backlinks/{note_path:path}")
def get_backlinks(note_path: str):
    vault = _vault()
    all_notes = _collect_notes(vault)
    name_lookup = _build_name_lookup(all_notes)

    target_keys = _resolve_target_keys(note_path)
    # Also accept stem-only references
    target_stem = Path(note_path).stem.lower()

    backlinks: list[dict] = []
    seen: set[str] = set()

    for rel, md_file in all_notes.items():
        if rel == note_path:
            continue
        try:
            content = md_file.read_text(encoding="utf-8")
        except OSError:
            continue

        for m in WIKILINK_RE.finditer(content):
            link_text = m.group(1).strip()
            resolved = (
                name_lookup.get(link_text.lower())
                or name_lookup.get((link_text + ".md").lower())
            )
            matches = (
                resolved == note_path
                or link_text.lower() in target_keys
                or link_text.lower() == target_stem
            )
            if matches and rel not in seen:
                seen.add(rel)
                backlinks.append({
                    "path": rel,
                    "excerpt": _excerpt_around_link(content, m),
                })
                break

    return {"backlinks": backlinks}


@router.get("")
def get_graph():
    vault = _vault()
    all_notes = _collect_notes(vault)
    name_lookup = _build_name_lookup(all_notes)

    nodes: list[dict] = []
    edges: list[dict] = []

    for rel, md_file in all_notes.items():
        nodes.append({"id": rel, "label": Path(rel).stem, "path": rel, "exists": True})

        try:
            content = md_file.read_text(encoding="utf-8")
        except OSError:
            continue

        seen_targets: set[str] = set()
        for m in WIKILINK_RE.finditer(content):
            link_text = m.group(1).strip()
            target = (
                name_lookup.get(link_text.lower())
                or name_lookup.get((link_text + ".md").lower())
            )
            if target and target != rel and target not in seen_targets:
                edges.append({"source": rel, "target": target})
                seen_targets.add(target)

    return {"nodes": nodes, "edges": edges}
