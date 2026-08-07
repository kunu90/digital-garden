from collections.abc import AsyncGenerator
from typing import Any

import anthropic

from config import get_settings


class ClaudeClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.model
        self._max_tokens = settings.max_tokens
        self._thinking_budget = settings.thinking_budget

    async def stream_with_collect(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        system: str = "",
        thinking_enabled: bool = True,
    ) -> AsyncGenerator[dict, None]:
        """
        Streams the Claude response in real time, yielding:
          - {"type": "thinking_start"}
          - {"type": "thinking_delta", "delta": str}
          - {"type": "thinking_end", "text": str}
          - {"type": "text", "delta": str}
          - as the LAST event: {"type": "_message", "stop_reason": str, "content": list[dict]}

        The "_message" event carries the fully-assembled content blocks that
        must be appended to the conversation history.
        """
        kwargs: dict[str, Any] = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "messages": messages,
        }
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools

        use_thinking = thinking_enabled and self._thinking_budget > 0
        if use_thinking:
            # temperature must be 1, max_tokens must exceed budget
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": self._thinking_budget}
            kwargs["temperature"] = 1
            # Ensure max_tokens exceeds the thinking budget
            if kwargs["max_tokens"] <= self._thinking_budget:
                kwargs["max_tokens"] = self._thinking_budget + 4000

        current_block_type: str | None = None
        current_thinking = ""

        async with self._client.messages.stream(**kwargs) as stream:
            async for event in stream:
                etype = getattr(event, "type", None)

                if etype == "content_block_start":
                    block = event.content_block
                    current_block_type = block.type
                    if block.type == "thinking":
                        current_thinking = ""
                        yield {"type": "thinking_start"}

                elif etype == "content_block_delta":
                    delta = event.delta
                    dtype = getattr(delta, "type", None)
                    if dtype == "text_delta":
                        yield {"type": "text", "delta": delta.text}
                    elif dtype == "thinking_delta":
                        current_thinking += delta.thinking
                        yield {"type": "thinking_delta", "delta": delta.thinking}

                elif etype == "content_block_stop":
                    if current_block_type == "thinking":
                        yield {"type": "thinking_end", "text": current_thinking}
                    current_block_type = None

            # Use get_final_message() to obtain fully-assembled content blocks.
            # Critically, thinking blocks include their `signature` field here,
            # which is required when passing them back in subsequent API calls.
            final = await stream.get_final_message()

        content_blocks = [block.model_dump(exclude_none=True) for block in final.content]
        yield {"type": "_message", "stop_reason": final.stop_reason, "content": content_blocks, "input_tokens": final.usage.input_tokens}
