from pathlib import Path

from fastapi import APIRouter, Query

from assistant.tools.files_grep import FilesGrepInput
from assistant.tools.files_grep import run as grep_run
from fastapi import HTTPException
from vault_config import get_vault_path

router = APIRouter(prefix="/notes", tags=["notes"])


def _vault() -> Path:
    path = get_vault_path()
    if path is None:
        raise HTTPException(
            status_code=400,
            detail="Vault path not configured. Set it via PUT /vault/path.",
        )
    return path


@router.get("/search")
async def search_notes(
    q: str = Query(..., description="Search query (string or regex)"),
    case_sensitive: bool = Query(False),
    max_results: int = Query(50),
):
    """
    Keyword search across note content and file names.
    Agentic search happens through POST /chat — ask Claude directly.
    """
    result = await grep_run(
        FilesGrepInput(pattern=q, case_sensitive=case_sensitive, max_results=max_results),
        _vault(),
    )
    import json
    try:
        matches = json.loads(result)
    except (json.JSONDecodeError, ValueError):
        matches = []
    return {"query": q, "results": matches}
