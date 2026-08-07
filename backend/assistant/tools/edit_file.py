import difflib
from pathlib import Path

from assistant.harness.edit_history import log_edit
from pydantic import BaseModel

TOOL_SPEC = {
    "name": "edit_file",
    "description": (
        "Edit a file in the vault. Two modes:\n"
        "- Full rewrite: provide `content` with the complete new file text. "
        "Use for small files (<150 lines), multiple scattered changes, or structural rewrites.\n"
        "- Targeted replace: provide `old_string` + `new_string`. "
        "old_string must match exactly once in the file (include 2–5 lines of surrounding context "
        "to ensure uniqueness). Use for a single localized change in a large file.\n"
        "Returns a unified diff of all changes."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Relative path to the file within the vault.",
            },
            "content": {
                "type": "string",
                "description": "Full new file content (full rewrite mode). Mutually exclusive with old_string/new_string.",
            },
            "old_string": {
                "type": "string",
                "description": "Exact text to find and replace (targeted mode). Must match exactly once. Include surrounding context lines to ensure uniqueness.",
            },
            "new_string": {
                "type": "string",
                "description": "Replacement text for old_string (targeted mode).",
            },
        },
        "required": ["path"],
    },
}


class EditFileInput(BaseModel):
    path: str
    content: str | None = None
    old_string: str | None = None
    new_string: str | None = None


async def run(input: EditFileInput, vault_path: Path) -> str:
    target = (vault_path / input.path).resolve()
    if not target.is_relative_to(vault_path.resolve()):
        return f"Error: path '{input.path}' is outside the vault."

    if input.content is not None and input.old_string is not None:
        return "Error: provide either 'content' (full rewrite) or 'old_string'+'new_string' (targeted), not both."
    if input.content is None and input.old_string is None:
        return "Error: provide either 'content' (full rewrite) or 'old_string'+'new_string' (targeted)."
    if input.old_string is not None and input.new_string is None:
        return "Error: 'new_string' is required when using targeted replace mode."

    old_content = target.read_text(encoding="utf-8") if target.exists() else ""

    if input.old_string is not None:
        count = old_content.count(input.old_string)
        if count == 0:
            return "Error: old_string not found in file."
        if count > 1:
            return f"Error: old_string matches {count} locations — add more surrounding context to make it unique."
        new_content = old_content.replace(input.old_string, input.new_string, 1)
    else:
        new_content = input.content

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(new_content, encoding="utf-8")

    if old_content != new_content:
        log_edit(vault_path, input.path, old_content, new_content)

    diff = difflib.unified_diff(
        old_content.splitlines(keepends=True),
        new_content.splitlines(keepends=True),
        fromfile=f"a/{input.path}",
        tofile=f"b/{input.path}",
    )
    diff_text = "".join(diff)
    return diff_text if diff_text else "No changes."
