from pathlib import Path

from pydantic import BaseModel


class VaultSettings(BaseModel):
    name: str = "My Garden"
    ignored_folders: list[str] = []
    model_override: str | None = None


class FolderCreate(BaseModel):
    path: str  # relative path within vault


class FolderRename(BaseModel):
    new_path: str  # new relative path within vault
