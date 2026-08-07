from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

from assistant.tools import edit_file, fetch_url, files_grep, read_file, web_search, write_memory

# Each entry: tool_spec, async run function
_TOOLS: list[tuple[dict, Callable[..., Coroutine[Any, Any, str]]]] = [
    (read_file.TOOL_SPEC, read_file.run),
    (edit_file.TOOL_SPEC, edit_file.run),
    (files_grep.TOOL_SPEC, files_grep.run),
    (fetch_url.TOOL_SPEC, fetch_url.run),
    (web_search.TOOL_SPEC, web_search.run),
    (write_memory.TOOL_SPEC, write_memory.run),
]

# Tools that require user permission before running
PERMISSION_REQUIRED: set[str] = {"edit_file", "web_search", "write_memory"}

# Tool specs list passed directly to the Anthropic API
ALL_TOOL_SPECS: list[dict] = [spec for spec, _ in _TOOLS]


class ToolRegistry:
    def __init__(self) -> None:
        self._registry: dict[str, tuple[dict, Callable[..., Coroutine[Any, Any, str]]]] = {
            spec["name"]: (spec, fn) for spec, fn in _TOOLS
        }

    def get_specs(self, names: list[str] | None = None) -> list[dict]:
        """Return tool specs, optionally filtered to a subset by name."""
        if names is None:
            return [spec for spec, _ in self._registry.values()]
        return [self._registry[n][0] for n in names if n in self._registry]

    async def dispatch(self, tool_name: str, tool_input: dict, vault_path: Path) -> str:
        """Execute a tool by name and return its string result."""
        if tool_name not in self._registry:
            return f"Error: unknown tool '{tool_name}'."
        _, fn = self._registry[tool_name]

        # Dynamically build input model from the tool's module
        import importlib
        mod = importlib.import_module(f"assistant.tools.{tool_name}")
        input_cls = next(
            v for k, v in vars(mod).items()
            if k.endswith("Input") and isinstance(v, type)
        )
        parsed_input = input_cls(**tool_input)
        return await fn(parsed_input, vault_path)

    def needs_permission(self, tool_name: str) -> bool:
        return tool_name in PERMISSION_REQUIRED
