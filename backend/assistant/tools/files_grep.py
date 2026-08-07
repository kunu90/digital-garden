import json
import re
from pathlib import Path

from pydantic import BaseModel

TOOL_SPEC = {
    "name": "files_grep",
    "description": (
        "Search for a string or regex pattern across all markdown files in the vault. "
        "Also matches against file names. Returns matching files, line numbers, and snippets with surrounding context lines."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "The search string or regex pattern.",
            },
            "case_sensitive": {
                "type": "boolean",
                "description": "Whether the search is case-sensitive. Defaults to false.",
            },
            "max_results": {
                "type": "integer",
                "description": "Maximum number of results to return. Defaults to 50.",
            },
            "context_lines": {
                "type": "integer",
                "description": "Number of surrounding lines to include with each match. Defaults to 2.",
            },
        },
        "required": ["pattern"],
    },
}


class FilesGrepInput(BaseModel):
    pattern: str
    case_sensitive: bool = False
    max_results: int = 50
    context_lines: int = 2


async def run(input: FilesGrepInput, vault_path: Path) -> str:
    flags = 0 if input.case_sensitive else re.IGNORECASE
    try:
        regex = re.compile(input.pattern, flags)
    except re.error as e:
        return f"Error: invalid pattern — {e}"

    results: list[dict] = []
    vault_root = vault_path.resolve()

    for md_file in sorted(vault_root.rglob("*.md")):
        if ".garden" in md_file.parts:
            continue

        rel_path = str(md_file.relative_to(vault_root))

        # Match against relative path (includes folder) and filename
        if regex.search(rel_path):
            results.append({"file": rel_path, "line": 0, "snippet": f"(filename match) {rel_path}"})

        # Match against content
        try:
            lines = md_file.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue

        for lineno, line in enumerate(lines, start=1):
            if regex.search(line):
                ctx_start = max(0, lineno - 1 - input.context_lines)
                ctx_end = min(len(lines), lineno + input.context_lines)
                ctx_snippet = lines[ctx_start:ctx_end]
                ctx_snippet[lineno - 1 - ctx_start] = ">>> " + ctx_snippet[lineno - 1 - ctx_start]
                snippet = "\n".join(l.strip() for l in ctx_snippet)
                results.append({"file": rel_path, "line": lineno, "snippet": snippet})
            if len(results) >= input.max_results:
                return json.dumps(results)

    return json.dumps(results) if results else "No matches found."
