from pydantic import BaseModel


class DiffRequest(BaseModel):
    old_content: str
    new_content: str
    file_path: str = "file"


class DiffLine(BaseModel):
    type: str  # "add" | "remove" | "context"
    content: str
    old_lineno: int | None = None
    new_lineno: int | None = None


class DiffHunk(BaseModel):
    old_start: int
    new_start: int
    lines: list[DiffLine]


class DiffResponse(BaseModel):
    file_path: str
    hunks: list[DiffHunk]
    has_changes: bool
