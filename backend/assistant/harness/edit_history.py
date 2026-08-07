import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _edits_dir(vault_path: Path) -> Path:
    return vault_path / ".garden" / "edits"


def _note_key(note_path: str) -> str:
    return hashlib.sha256(note_path.encode()).hexdigest()[:16]


def _log_file(vault_path: Path, note_path: str) -> Path:
    return _edits_dir(vault_path) / f"{_note_key(note_path)}.jsonl"


def log_edit(
    vault_path: Path,
    note_path: str,
    old_content: str,
    new_content: str,
    session_id: str | None = None,
) -> str:
    """Append an edit record. Returns edit_id."""
    edits_dir = _edits_dir(vault_path)
    edits_dir.mkdir(parents=True, exist_ok=True)

    edit_id = str(uuid.uuid4())
    record = {
        "id": edit_id,
        "note_path": note_path,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "old_content": old_content,
        "new_content": new_content,
        "session_id": session_id,
    }
    log_file = _log_file(vault_path, note_path)
    with log_file.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    return edit_id


def list_edits(vault_path: Path, note_path: str) -> list[dict]:
    log_file = _log_file(vault_path, note_path)
    if not log_file.exists():
        return []
    edits: list[dict] = []
    for line in log_file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            edits.append({
                "id": entry["id"],
                "timestamp": entry["timestamp"],
                "note_path": entry["note_path"],
                "session_id": entry.get("session_id"),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return edits


def get_edit(vault_path: Path, note_path: str, edit_id: str) -> dict | None:
    log_file = _log_file(vault_path, note_path)
    if not log_file.exists():
        return None
    for line in log_file.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
            if entry.get("id") == edit_id:
                return entry
        except json.JSONDecodeError:
            continue
    return None


def revert_edit(vault_path: Path, note_path: str, edit_id: str) -> str:
    """Restore note to pre-edit content. Returns restored content."""
    entry = get_edit(vault_path, note_path, edit_id)
    if entry is None:
        raise FileNotFoundError(f"Edit {edit_id} not found")

    target = (vault_path / note_path).resolve()
    if not target.is_relative_to(vault_path.resolve()):
        raise ValueError("Path is outside the vault.")

    old_content = entry["old_content"]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(old_content, encoding="utf-8")
    return old_content
