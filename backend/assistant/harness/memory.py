import json
from datetime import datetime, timezone
from pathlib import Path


def _garden_dir(vault_path: Path) -> Path:
    return vault_path / ".garden"


def _memory_file(vault_path: Path) -> Path:
    return _garden_dir(vault_path) / "memory.md"


def _sessions_dir(vault_path: Path) -> Path:
    return _garden_dir(vault_path) / "sessions"


# ── Cross-session memory ──────────────────────────────────────────────────────

def load_memory(vault_path: Path) -> str:
    """Read memory.md and return its contents, or empty string if it doesn't exist."""
    mem_file = _memory_file(vault_path)
    if not mem_file.exists():
        return ""
    return mem_file.read_text(encoding="utf-8")


def append_memory(vault_path: Path, entry: str) -> None:
    """Append a timestamped entry to memory.md."""
    mem_file = _memory_file(vault_path)
    mem_file.parent.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    block = f"\n- [{timestamp}] {entry.strip()}\n"

    with mem_file.open("a", encoding="utf-8") as f:
        if mem_file.stat().st_size == 0:
            f.write("# Claude Memory\n")
        f.write(block)


# ── Session history ───────────────────────────────────────────────────────────

def load_session(vault_path: Path, session_id: str) -> list[dict]:
    """Load message history for a session. Returns empty list if not found."""
    session_file = _sessions_dir(vault_path) / f"{session_id}.json"
    if not session_file.exists():
        return []
    try:
        return json.loads(session_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def save_session(vault_path: Path, session_id: str, messages: list[dict]) -> None:
    """Persist message history for a session."""
    sessions_dir = _sessions_dir(vault_path)
    sessions_dir.mkdir(parents=True, exist_ok=True)
    session_file = sessions_dir / f"{session_id}.json"
    session_file.write_text(json.dumps(messages, ensure_ascii=False, indent=2), encoding="utf-8")


def list_sessions(vault_path: Path) -> list[str]:
    """Return all session IDs (filenames without .json)."""
    sessions_dir = _sessions_dir(vault_path)
    if not sessions_dir.exists():
        return []
    return [f.stem for f in sorted(sessions_dir.glob("*.json"))]


def list_sessions_with_meta(vault_path: Path) -> list[dict]:
    """Return session IDs with preview text and updated timestamp."""
    sessions_dir = _sessions_dir(vault_path)
    if not sessions_dir.exists():
        return []

    results: list[dict] = []
    for session_file in sorted(sessions_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        session_id = session_file.stem
        preview = ""
        try:
            messages = json.loads(session_file.read_text(encoding="utf-8"))
            for msg in messages:
                if msg.get("role") == "user":
                    content = msg.get("content", "")
                    if isinstance(content, str) and content.strip():
                        preview = content.strip()[:80]
                        break
        except (json.JSONDecodeError, OSError):
            preview = ""

        mtime = datetime.fromtimestamp(session_file.stat().st_mtime, tz=timezone.utc)
        results.append({
            "id": session_id,
            "preview": preview,
            "updated_at": mtime.isoformat(),
        })
    return results


def delete_session(vault_path: Path, session_id: str) -> bool:
    """Delete a session file. Returns True if deleted, False if not found."""
    session_file = _sessions_dir(vault_path) / f"{session_id}.json"
    if session_file.exists():
        session_file.unlink()
        return True
    return False
