import json
from html.parser import HTMLParser
from pathlib import Path

import httpx
from pydantic import BaseModel

TOOL_SPEC = {
    "name": "fetch_url",
    "description": (
        "Fetch the full text content of a web page. "
        "Use after web_search to read a complete article from a URL in the results. "
        "Returns plain text stripped of HTML, truncated to max_chars."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The URL to fetch.",
            },
            "max_chars": {
                "type": "integer",
                "description": "Maximum characters to return. Defaults to 8000.",
            },
        },
        "required": ["url"],
    },
}


class FetchUrlInput(BaseModel):
    url: str
    max_chars: int = 8000


class _HTMLStripper(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


async def run(input: FetchUrlInput, vault_path: Path) -> str:  # noqa: ARG001
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(input.url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()

        stripper = _HTMLStripper()
        stripper.feed(resp.text)
        text = " ".join(stripper.parts)
        text = " ".join(text.split())  # collapse whitespace

        if len(text) > input.max_chars:
            text = text[:input.max_chars] + "…"
        return text
    except Exception as e:
        return f"Error fetching URL: {e}"
