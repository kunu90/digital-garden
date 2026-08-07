import anthropic
from fastapi import APIRouter
from pydantic import BaseModel

from config import get_settings

router = APIRouter(prefix="/notes", tags=["notes"])


class CompleteBody(BaseModel):
    prefix: str
    suffix: str = ""


@router.post("/complete")
async def complete_text(body: CompleteBody):
    """
    Generate an inline tab-completion for the cursor position.
    prefix = text before cursor (last ~1000 chars)
    suffix = text after cursor (first ~200 chars), optional
    Returns only the completion text to insert.
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    suffix_section = f"\n\n<suffix>{body.suffix}</suffix>" if body.suffix.strip() else ""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=150,
        system=(
            "You are an inline writing assistant providing tab completions for a markdown note editor. "
            "Given text before the cursor, continue it naturally. Rules:\n"
            "- Output ONLY the completion text — no explanation, no quotes, no preamble\n"
            "- Continue naturally: if mid-sentence, finish the sentence; if end of sentence, add the next\n"
            "- Keep it concise: usually 5–40 words\n"
            "- Match the user's exact writing style, tone, and vocabulary\n"
            "- Preserve markdown formatting (bullets, headers, bold, etc.) where appropriate\n"
            "- Stop at a natural pause (end of sentence or short paragraph)\n"
            "- If the suffix is provided, make sure the completion flows into it"
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"<prefix>{body.prefix}</prefix>{suffix_section}\n\n"
                    "Continue the text at the cursor (after the prefix):"
                ),
            }
        ],
    )

    completion = ""
    for block in message.content:
        if block.type == "text":
            completion += block.text

    return {"completion": completion.strip()}
