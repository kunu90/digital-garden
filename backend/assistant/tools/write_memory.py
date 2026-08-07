from pathlib import Path

from pydantic import BaseModel

TOOL_SPEC = {
    "name": "write_memory",
    "description": (
        "Persist an important fact, preference, or piece of context to your cross-session memory. "
        "This memory is loaded at the start of every conversation. Use it to remember things the user "
        "has told you, preferences, ongoing projects, or anything worth recalling next session."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "entry": {
                "type": "string",
                "description": "The memory entry to persist (1-3 concise sentences).",
            }
        },
        "required": ["entry"],
    },
}


class WriteMemoryInput(BaseModel):
    entry: str


async def run(input: WriteMemoryInput, vault_path: Path) -> str:
    from assistant.harness.memory import append_memory

    append_memory(vault_path, input.entry)
    return f"Memory saved: {input.entry}"
