from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from vault_config import get_vault_path, join_vault_path

router = APIRouter(prefix="/vault", tags=["vault"])

ALLOWED_EXTENSIONS = {
    # Images
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp",
    # PDF
    ".pdf",
    # Audio
    ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac",
    # Video
    ".mp4", ".webm", ".mov",
}


def _vault() -> Path:
    path = get_vault_path()
    if path is None:
        raise HTTPException(400, "Vault path not configured.")
    return path


def _safe_path(rel: str) -> Path:
    try:
        return join_vault_path(_vault(), rel)
    except ValueError:
        raise HTTPException(403, "Path is outside the vault.")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form(default=""),
):
    """Upload a binary asset (image, PDF, audio, video) to the vault."""
    filename = file.filename or "upload"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type {ext!r} is not supported.")

    vault = _vault().resolve()
    target_dir = _safe_path(folder) if folder else vault
    target_dir.mkdir(parents=True, exist_ok=True)

    # Resolve name conflicts
    stem = Path(filename).stem
    target = target_dir / filename
    counter = 1
    while target.exists():
        target = target_dir / f"{stem}_{counter}{ext}"
        counter += 1

    content = await file.read()
    target.write_bytes(content)

    rel_path = str(target.relative_to(vault))
    return {"path": rel_path, "name": target.name}


@router.get("/assets/{file_path:path}")
def serve_asset(file_path: str):
    """Serve a raw vault asset (image, PDF, audio, video)."""
    path = _safe_path(file_path)
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "Asset not found.")
    return FileResponse(path)
