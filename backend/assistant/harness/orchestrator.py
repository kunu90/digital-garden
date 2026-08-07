from collections.abc import AsyncGenerator
from pathlib import Path

from assistant.harness.context import _trim_history
from assistant.harness.memory import load_session, save_session
from assistant.harness.permissions import PermissionGate
from assistant.harness.prompt import build_system_prompt
from assistant.harness.react import ReActLoop
from assistant.harness.tool_calling import ToolRegistry
from assistant.models.anthropic import ClaudeClient
from config import get_settings


class Orchestrator:
    def __init__(self) -> None:
        self._client = ClaudeClient()
        self._registry = ToolRegistry()
        # One PermissionGate per orchestrator instance (shared across sessions)
        self._gate = PermissionGate()

    @property
    def gate(self) -> PermissionGate:
        return self._gate

    async def run_chat(
        self,
        session_id: str,
        user_message: str,
        vault_path: Path,
        active_note_path: str | None = None,
    ) -> AsyncGenerator[dict, None]:
        settings = get_settings()

        messages = load_session(vault_path, session_id)
        messages = _trim_history(messages, settings.max_history_tokens)

        messages.append({"role": "user", "content": user_message})

        system = build_system_prompt(vault_path, active_note_path)
        loop = ReActLoop(
            client=self._client,
            registry=self._registry,
            gate=self._gate,
            vault_path=vault_path,
            thinking_enabled=settings.thinking_budget > 0,
        )

        async def _stream() -> AsyncGenerator[dict, None]:
            try:
                async for event in loop.run(messages=messages, system=system):
                    yield event
            except Exception as e:
                yield {"type": "text", "delta": f"\n\n[Error: {e}]"}
                yield {"type": "done"}
                return

            save_session(vault_path, session_id, messages)

        return _stream()
