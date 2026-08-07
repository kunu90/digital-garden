from datetime import datetime
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from assistant.harness.edit_history import list_edits, revert_edit
from vault_config import get_vault_path

router = APIRouter(prefix="/notes", tags=["notes"])

HUB_STEM = "product-build-journal"
_DATE_LINE_RE = re.compile(
    r"^\*(?:(\d{4}-\d{2}-\d{2})|(\d{2}-\d{2}-\d{4}))\*\s*$",
    re.MULTILINE,
)


def _created_at(path: Path) -> float:
    try:
        st = path.stat()
        return float(getattr(st, "st_birthtime", st.st_ctime))
    except OSError:
        return 0.0


def _journal_date_timestamp(path: Path) -> float | None:
    """Parse optional *dd-mm-yyyy* (or legacy *YYYY-MM-DD*) near top of journal notes."""
    if not path.is_file() or path.suffix.lower() != ".md":
        return None
    try:
        head = path.read_text(encoding="utf-8")[:600]
    except OSError:
        return None
    match = _DATE_LINE_RE.search(head)
    if not match:
        return None
    try:
        if match.group(1):
            return datetime.strptime(match.group(1), "%Y-%m-%d").timestamp()
        return datetime.strptime(match.group(2), "%d-%m-%Y").timestamp()
    except ValueError:
        return None


def _tree_sort_key(path: Path) -> tuple[float, float, str]:
    """Oldest first; hub note pinned to top of its folder."""
    if path.stem == HUB_STEM and path.suffix.lower() == ".md":
        return (float("-inf"), float("-inf"), path.name.lower())

    journal_ts = _journal_date_timestamp(path)
    created = _created_at(path)
    primary = journal_ts if journal_ts is not None else created
    return (primary, created, path.name.lower())


def _sorted_children(directory: Path) -> list[Path]:
    return sorted(
        [c for c in directory.iterdir() if not c.name.startswith(".")],
        key=_tree_sort_key,
    )


def _vault() -> Path:
    path = get_vault_path()
    if path is None:
        raise HTTPException(
            status_code=400,
            detail="Vault path not configured. Set it via PUT /vault/path.",
        )
    return path


def _safe_path(rel: str) -> Path:
    target = (_vault() / rel).resolve()
    if not target.is_relative_to(_vault().resolve()):
        raise HTTPException(status_code=403, detail="Path is outside the vault.")
    return target


def _build_tree(vault_path: Path) -> list[dict]:
    """Recursively build a file tree of all .md files and folders."""
    root = vault_path.resolve()

    def _node(p: Path) -> dict | None:
        rel = str(p.relative_to(root))
        sort_at = _tree_sort_key(p)[0]
        if p.is_dir():
            children = [
                n
                for c in _sorted_children(p)
                if (n := _node(c)) is not None
            ]
            if not children:
                return None
            return {
                "type": "folder",
                "name": p.name,
                "path": rel,
                "sort_at": sort_at,
                "children": children,
            }
        if p.suffix.lower() != ".md":
            return None
        return {"type": "file", "name": p.name, "path": rel, "sort_at": sort_at}

    return [n for c in _sorted_children(root) if (n := _node(c)) is not None]


class NoteBody(BaseModel):
    content: str


class RenameBody(BaseModel):
    new_path: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def list_notes():
    """Return the vault file tree."""
    return {"tree": _build_tree(_vault())}


@router.get("/{note_path:path}/edit-history")
def get_edit_history(note_path: str):
    _safe_path(note_path)  # validate path
    return {"edits": list_edits(_vault(), note_path)}


@router.post("/{note_path:path}/revert/{edit_id}")
def revert_note_edit(note_path: str, edit_id: str):
    _safe_path(note_path)
    try:
        content = revert_edit(_vault(), note_path, edit_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Edit not found.")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"path": note_path, "content": content, "reverted_edit_id": edit_id}


@router.get("/{note_path:path}")
def get_note(note_path: str):
    target = _safe_path(note_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Note not found.")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is a directory.")
    return {"path": note_path, "content": target.read_text(encoding="utf-8")}


@router.post("/{note_path:path}", status_code=201)
def create_note(note_path: str, body: NoteBody):
    target = _safe_path(note_path)
    if target.exists():
        raise HTTPException(status_code=409, detail="Note already exists.")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content, encoding="utf-8")
    return {"path": note_path}


@router.put("/{note_path:path}")
def update_note(note_path: str, body: NoteBody):
    target = _safe_path(note_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content, encoding="utf-8")
    return {"path": note_path}


@router.patch("/{note_path:path}")
def rename_note(note_path: str, body: RenameBody):
    src = _safe_path(note_path)
    dst = _safe_path(body.new_path)
    if not src.exists():
        raise HTTPException(status_code=404, detail="Note not found.")
    if dst.exists():
        raise HTTPException(status_code=409, detail="Destination already exists.")
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    return {"path": body.new_path}


@router.delete("/{note_path:path}")
def delete_note(note_path: str):
    target = _safe_path(note_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Note not found.")
    target.unlink()
    return {"deleted": note_path}
