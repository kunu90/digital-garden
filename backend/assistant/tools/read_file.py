from pathlib import Path

from pydantic import BaseModel

from vault_config import join_vault_path

TOOL_SPEC = {
    "name": "read_file",
    "description": (
        "Read a markdown file from the vault. By default reads the full file. "
        "Optionally specify start_line/end_line (1-indexed, inclusive) to read a range. "
        "Output always includes line numbers. "
        "Use files_grep first to locate relevant line ranges, then read only what you need. "
        "For files under ~200 lines, a full read is usually faster than grep + range read."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative path to the file within the vault (e.g. 'notes/ideas.md').",
            },
            "start_line": {
                "type": "integer",
                "description": "First line to read, 1-indexed inclusive. Omit for full file.",
            },
            "end_line": {
                "type": "integer",
                "description": "Last line to read, 1-indexed inclusive. Omit for full file.",
            },
        },
        "required": ["path"],
    },
}


class ReadFileInput(BaseModel):
    path: str
    start_line: int | None = None
    end_line: int | None = None


async def run(input: ReadFileInput, vault_path: Path) -> str:
    try:
        target = join_vault_path(vault_path, input.path)
    except ValueError:
        return f"Error: path '{input.path}' is outside the vault."
    if not target.exists():
        return f"Error: file '{input.path}' does not exist."

    lines = target.read_text(encoding="utf-8").splitlines()
    total = len(lines)
    width = len(str(total))

    if input.start_line is not None or input.end_line is not None:
        start = max(1, input.start_line or 1)
        end = min(total, input.end_line or total)
        selected = lines[start - 1 : end]
        header = f"[Lines {start}–{end} of {total} total]\n"
        body = "\n".join(f"{i:{width}} | {line}" for i, line in enumerate(selected, start=start))
        return header + body

    return "\n".join(f"{i:{width}} | {line}" for i, line in enumerate(lines, start=1))
