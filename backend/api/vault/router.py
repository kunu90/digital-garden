import json
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.vault.schemas import FolderCreate, FolderRename, VaultSettings
from vault_config import get_vault_path, join_vault_path, set_vault_path

router = APIRouter(prefix="/vault", tags=["vault"])


def _vault() -> Path:
    path = get_vault_path()
    if path is None:
        raise HTTPException(
            status_code=400,
            detail="Vault path not configured. Set it via PUT /vault/path.",
        )
    return path


def _garden_dir() -> Path:
    return _vault() / ".garden"


def _settings_file() -> Path:
    return _garden_dir() / "settings.json"


def _safe_path(rel: str) -> Path:
    try:
        return join_vault_path(_vault(), rel)
    except ValueError:
        raise HTTPException(status_code=403, detail="Path is outside the vault.")


# ── Vault path configuration ──────────────────────────────────────────────────

class VaultPathBody(BaseModel):
    path: str


@router.get("/path")
def get_path():
    """Return the currently configured vault path, or null if not set."""
    path = get_vault_path()
    return {"path": str(path) if path else None}


@router.put("/path")
def set_path(body: VaultPathBody):
    """Set the vault path and initialize it."""
    target = Path(body.path).expanduser().resolve()
    if not target.exists():
        target.mkdir(parents=True, exist_ok=True)
    set_vault_path(target)
    # Auto-init the vault structure
    garden = target / ".garden"
    (garden / "sessions").mkdir(parents=True, exist_ok=True)
    settings_file = garden / "settings.json"
    if not settings_file.exists():
        settings_file.write_text(
            json.dumps(VaultSettings().model_dump(), indent=2), encoding="utf-8"
        )
    memory_file = garden / "memory.md"
    if not memory_file.exists():
        memory_file.write_text("# Claude Memory\n", encoding="utf-8")
    return {"path": str(target)}


# ── Vault init ────────────────────────────────────────────────────────────────

@router.post("/init")
def init_vault():
    garden = _garden_dir()
    (garden / "sessions").mkdir(parents=True, exist_ok=True)

    settings_file = _settings_file()
    if not settings_file.exists():
        settings_file.write_text(
            json.dumps(VaultSettings().model_dump(), indent=2), encoding="utf-8"
        )

    memory_file = garden / "memory.md"
    if not memory_file.exists():
        memory_file.write_text("# Claude Memory\n", encoding="utf-8")

    return {"status": "ok", "garden_path": str(garden)}


# ── Vault settings ────────────────────────────────────────────────────────────

@router.get("/settings", response_model=VaultSettings)
def get_vault_settings():
    sf = _settings_file()
    if not sf.exists():
        return VaultSettings()
    return VaultSettings(**json.loads(sf.read_text(encoding="utf-8")))


@router.put("/settings", response_model=VaultSettings)
def update_vault_settings(body: VaultSettings):
    sf = _settings_file()
    sf.parent.mkdir(parents=True, exist_ok=True)
    sf.write_text(json.dumps(body.model_dump(), indent=2), encoding="utf-8")
    return body


# ── File watcher (SSE) ────────────────────────────────────────────────────────

@router.get("/watch")
async def watch_vault():
    """SSE stream of external file changes in the vault."""
    import asyncio
    import json as _json

    from watchfiles import awatch

    async def event_generator():
        yield "data: {\"type\": \"connected\"}\n\n"
        try:
            async for changes in awatch(str(_vault())):
                for change_type, path in changes:
                    rel = Path(path).relative_to(_vault().resolve())
                    if ".garden" in rel.parts:
                        continue
                    event = _json.dumps({
                        "type": "file_changed",
                        "path": str(rel),
                        "event": change_type.name.lower(),
                    })
                    yield f"data: {event}\n\n"
                    await asyncio.sleep(0)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Folder CRUD ───────────────────────────────────────────────────────────────

@router.post("/folders")
def create_folder(body: FolderCreate):
    target = _safe_path(body.path)
    target.mkdir(parents=True, exist_ok=True)
    return {"path": body.path}


@router.put("/folders/{folder_path:path}")
def rename_folder(folder_path: str, body: FolderRename):
    src = _safe_path(folder_path)
    dst = _safe_path(body.new_path)
    if not src.exists():
        raise HTTPException(status_code=404, detail="Folder not found.")
    if dst.exists():
        raise HTTPException(status_code=409, detail="Destination already exists.")
    src.rename(dst)
    return {"old_path": folder_path, "new_path": body.new_path}


@router.delete("/folders/{folder_path:path}")
def delete_folder(folder_path: str):
    target = _safe_path(folder_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Folder not found.")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a folder.")
    shutil.rmtree(target)
    return {"deleted": folder_path}
