from pathlib import Path

from assistant.models.anthropic import ClaudeClient
from config import get_settings

_MAX_STEPS = 20
_RECENT_TOOL_TURNS = 4

_TOOL_COMPRESS_TARGET: dict[str, int] = {
    "files_grep": 400,
    "read_file": 2000,
    "web_search": 800,
    "fetch_url": 600,
    "edit_file": 400,
    "write_memory": 200,
}

_SUMMARY_PROMPT = (
    "Please produce a concise summary of the conversation above.\n"
    "Include: the user's original goal and questions, all files read (with key findings), "
    "all files edited (with what was changed), key facts discovered, decisions made, "
    "and anything that remains pending or unresolved.\n"
    "Be thorough but compact — this summary will replace the conversation history."
)


def _compact_working_messages(messages: list[dict]) -> list[dict]:
    """
    Keep the last _RECENT_TOOL_TURNS tool round-trip pairs at full fidelity.
    Compress older tool_result content by tool name.
    """
    tool_turn_indices: list[int] = []
    for i, msg in enumerate(messages):
        if msg.get("role") == "user" and isinstance(msg.get("content"), list):
            if any(b.get("type") == "tool_result" for b in msg["content"]):
                tool_turn_indices.append(i)

    compress_up_to = tool_turn_indices[:-_RECENT_TOOL_TURNS] if len(tool_turn_indices) > _RECENT_TOOL_TURNS else []
    compress_set = set(compress_up_to)

    if not compress_set:
        return messages

    tool_names_by_turn: dict[int, list[str]] = {}
    for idx in compress_set:
        if idx > 0 and messages[idx - 1].get("role") == "assistant":
            asst = messages[idx - 1]["content"]
            if isinstance(asst, list):
                names = [b["name"] for b in asst if b.get("type") == "tool_use"]
                tool_names_by_turn[idx] = names

    out = []
    for i, msg in enumerate(messages):
        if i in compress_set and msg.get("role") == "user" and isinstance(msg.get("content"), list):
            tool_names = tool_names_by_turn.get(i, [])
            new_content = []
            for j, block in enumerate(msg["content"]):
                if block.get("type") == "tool_result" and isinstance(block.get("content"), str):
                    tool_name = tool_names[j] if j < len(tool_names) else ""
                    limit = _TOOL_COMPRESS_TARGET.get(tool_name, 400)
                    c = block["content"]
                    if len(c) > limit:
                        block = {**block, "content": c[:limit] + "\n…[truncated]"}
                new_content.append(block)
            msg = {**msg, "content": new_content}
        out.append(msg)
    return out


def _strip_thinking_blocks(messages: list[dict]) -> list[dict]:
    """Remove thinking blocks from assistant messages (required when sending to models without thinking support)."""
    out = []
    for msg in messages:
        if msg.get("role") == "assistant" and isinstance(msg.get("content"), list):
            filtered = [b for b in msg["content"] if b.get("type") != "thinking"]
            if not filtered:
                filtered = [{"type": "text", "text": "[thinking]"}]
            msg = {**msg, "content": filtered}
        out.append(msg)
    return out


async def _summarize_history(
    client: ClaudeClient,
    messages: list[dict],
    system: str,
) -> str:
    """Call Claude (summary_model) to produce a compact summary of messages. Returns '' on failure."""
    settings = get_settings()
    clean_messages = _strip_thinking_blocks(messages)
    messages_with_request = clean_messages + [{"role": "user", "content": _SUMMARY_PROMPT}]
    try:
        response = await client._client.messages.create(
            model=settings.summary_model,
            max_tokens=2048,
            system=system,
            messages=messages_with_request,
        )
        return response.content[0].text if response.content else ""
    except Exception:
        return ""


def _compact_to_summary(working_messages: list[dict], summary: str) -> list[dict]:
    """Replace old history with a synthetic summary exchange + last _RECENT_TOOL_TURNS tool round-trips."""
    tool_result_indices = [
        i for i, msg in enumerate(working_messages)
        if msg.get("role") == "user"
        and isinstance(msg.get("content"), list)
        and any(b.get("type") == "tool_result" for b in msg["content"])
    ]

    if not tool_result_indices:
        recent_messages: list[dict] = []
    else:
        keep_from = (
            tool_result_indices[-_RECENT_TOOL_TURNS]
            if len(tool_result_indices) >= _RECENT_TOOL_TURNS
            else tool_result_indices[0]
        )
        recent_messages = working_messages[keep_from:]

    return [
        {"role": "user", "content": f"Here is a summary of our conversation so far:\n\n{summary}"},
        {"role": "assistant", "content": "Understood. I have full context from our earlier conversation and will continue."},
        *recent_messages,
    ]


def _trim_history(messages: list[dict], max_tokens: int) -> list[dict]:
    """
    Tier-based session history compaction:
    - Keep the last _RECENT_TOOL_TURNS tool round-trips at full fidelity
    - Compress older tool results by tool name using _TOOL_COMPRESS_TARGET
    - Drop oldest message pairs if still over token budget (~4 chars/token)
    """
    tool_turn_indices: list[int] = []
    for i, msg in enumerate(messages):
        if msg.get("role") == "user" and isinstance(msg.get("content"), list):
            if any(b.get("type") == "tool_result" for b in msg["content"]):
                tool_turn_indices.append(i)

    compress_up_to = tool_turn_indices[:-_RECENT_TOOL_TURNS] if len(tool_turn_indices) > _RECENT_TOOL_TURNS else []
    compress_set = set(compress_up_to)

    tool_names_by_turn: dict[int, list[str]] = {}
    for idx in compress_set:
        if idx > 0 and messages[idx - 1].get("role") == "assistant":
            asst = messages[idx - 1]["content"]
            if isinstance(asst, list):
                tool_names_by_turn[idx] = [b["name"] for b in asst if b.get("type") == "tool_use"]

    compressed = []
    for i, msg in enumerate(messages):
        if i in compress_set and msg.get("role") == "user" and isinstance(msg.get("content"), list):
            tool_names = tool_names_by_turn.get(i, [])
            new_content = []
            for j, block in enumerate(msg["content"]):
                if block.get("type") == "tool_result" and isinstance(block.get("content"), str):
                    tool_name = tool_names[j] if j < len(tool_names) else ""
                    limit = _TOOL_COMPRESS_TARGET.get(tool_name, 400)
                    c = block["content"]
                    if len(c) > limit:
                        block = {**block, "content": c[:limit] + "\n…[truncated]"}
                new_content.append(block)
            msg = {**msg, "content": new_content}
        compressed.append(msg)

    budget = max_tokens * 4
    total = 0
    kept = []
    for msg in reversed(compressed):
        size = len(str(msg))
        if total + size > budget:
            break
        kept.append(msg)
        total += size
    return list(reversed(kept))
