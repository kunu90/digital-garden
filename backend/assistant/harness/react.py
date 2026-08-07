from collections.abc import AsyncGenerator
from pathlib import Path

from assistant.harness.context import (
    _MAX_STEPS,
    _compact_to_summary,
    _compact_working_messages,
    _summarize_history,
)
from assistant.harness.permissions import PermissionGate
from assistant.harness.tool_calling import ToolRegistry
from assistant.models.anthropic import ClaudeClient
from config import get_settings


class ReActLoop:
    """
    Agentic loop using real-time streaming for every Claude turn:
      1. Stream Claude response — forward text/thinking deltas immediately
      2. On end_turn: yield done
      3. On tool_use: gate → dispatch → append results → compact → repeat
    """

    def __init__(
        self,
        client: ClaudeClient,
        registry: ToolRegistry,
        gate: PermissionGate,
        vault_path: Path,
        thinking_enabled: bool = True,
    ) -> None:
        self._client = client
        self._registry = registry
        self._gate = gate
        self._vault_path = vault_path
        self._thinking_enabled = thinking_enabled

    async def run(
        self,
        messages: list[dict],
        system: str,
        tool_names: list[str] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """Run the ReAct loop. Yields SSE event dicts in real time."""
        tools = self._registry.get_specs(tool_names)
        working_messages = list(messages)
        steps = 0

        while steps < _MAX_STEPS:
            steps += 1
            assistant_content: list[dict] = []
            stop_reason: str | None = None

            input_tokens = 0
            async for event in self._client.stream_with_collect(
                messages=working_messages,
                tools=tools,
                system=system,
                thinking_enabled=self._thinking_enabled,
            ):
                if event["type"] == "_message":
                    stop_reason = event["stop_reason"]
                    assistant_content = event["content"]
                    input_tokens = event.get("input_tokens", 0)
                else:
                    yield event

            working_messages.append({"role": "assistant", "content": assistant_content})

            settings = get_settings()
            threshold = int(settings.context_window * settings.compaction_threshold)
            if input_tokens >= threshold:
                summary = await _summarize_history(self._client, working_messages, system)
                if summary:
                    working_messages = _compact_to_summary(working_messages, summary)
                    messages[:] = working_messages  # propagate to orchestrator's list for save_session
                    yield {"type": "text", "delta": "\n\n[Context compacted — continuing...]\n\n"}
                else:
                    working_messages = _compact_working_messages(working_messages)

            if stop_reason == "end_turn":
                messages[:] = working_messages
                yield {"type": "done"}
                return

            if stop_reason == "tool_use":
                tool_results = []

                for block in assistant_content:
                    if block["type"] != "tool_use":
                        continue

                    tool_name = block["name"]
                    tool_input = block["input"]

                    yield {"type": "tool_call", "name": tool_name, "input": tool_input, "tool_use_id": block["id"]}

                    approved = True
                    request_id = None
                    if self._registry.needs_permission(tool_name):
                        async for event in self._gate.request(tool_name, tool_input):
                            if event["type"] == "permission_request":
                                request_id = event["request_id"]
                            yield event

                        approved = self._gate.is_approved(request_id) if request_id else False

                    if not approved:
                        yield {"type": "tool_denied", "request_id": request_id, "tool": tool_name}
                        result_content = "The user denied this tool call. Do not retry it."
                    else:
                        try:
                            result_content = await self._registry.dispatch(
                                tool_name, tool_input, self._vault_path
                            )
                            yield {"type": "tool_result", "name": tool_name, "content": result_content}
                        except Exception as e:
                            result_content = f"Tool error: {e}"
                            yield {"type": "tool_result", "name": tool_name, "content": result_content, "is_error": True}

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": result_content,
                    })

                working_messages.append({"role": "user", "content": tool_results})
                working_messages = _compact_working_messages(working_messages)
                messages[:] = working_messages
                continue

            messages[:] = working_messages
            yield {"type": "done"}
            return

        messages[:] = working_messages
        yield {"type": "text", "delta": "\n\n[Reached maximum steps — stopping.]"}
        yield {"type": "done"}
