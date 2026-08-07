import anthropic
from fastapi import APIRouter
from pydantic import BaseModel

from config import get_settings

router = APIRouter(prefix="/notes", tags=["notes"])


class TransformBody(BaseModel):
    text: str
    prompt: str


@router.post("/transform")
async def transform_text(body: TransformBody):
    """
    Transform a piece of text using Claude.
    Returns only the transformed text — no explanation or commentary.
    """
    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4000,
        system=(
            "You are a writing assistant. Transform the given text according to the user's instruction. "
            "Return ONLY the transformed text. No explanation, no preamble, no quotes around it, no commentary. "
            "Preserve the original formatting style (markdown) unless told otherwise."
        ),
        messages=[
            {
                "role": "user",
                "content": f"Text:\n{body.text}\n\nInstruction: {body.prompt}",
            }
        ],
    )

    result = ""
    for block in message.content:
        if block.type == "text":
            result += block.text

    return {"result": result.strip()}
