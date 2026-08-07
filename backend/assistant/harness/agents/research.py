from collections.abc import AsyncGenerator
from pathlib import Path

from assistant.harness.permissions import PermissionGate
from assistant.harness.react import ReActLoop
from assistant.harness.tool_calling import ToolRegistry
from assistant.models.anthropic import ClaudeClient


_SYSTEM = (
    "You are a research agent with access to a personal note vault. "
    "Given a query, search the vault thoroughly using files_grep and read_file. "
    "Return a concise answer with direct citations (file paths and relevant quotes). "
    "Do not use web_search or edit_file."
)

# Read-only tools only — no permission gate needed for these
_TOOL_NAMES = ["read_file", "files_grep"]


class ResearchAgent:
    """
    Focused agent for vault-wide semantic search.
    Uses only read_file + files_grep — no permission gating required.
    Called internally by the orchestrator or directly from the search endpoint.
    """

    def __init__(self) -> None:
        self._client = ClaudeClient()
        self._registry = ToolRegistry()
        # No-op gate — read-only tools don't need user approval
        self._gate = PermissionGate()

    async def search(
        self, query: str, vault_path: Path
    ) -> AsyncGenerator[dict, None]:
        messages = [{"role": "user", "content": query}]
        loop = ReActLoop(
            client=self._client,
            registry=self._registry,
            gate=self._gate,
            vault_path=vault_path,
        )
        return loop.run(messages=messages, system=_SYSTEM, tool_names=_TOOL_NAMES)
