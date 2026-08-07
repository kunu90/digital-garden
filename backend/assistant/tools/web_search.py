import json
from pathlib import Path

from pydantic import BaseModel

TOOL_SPEC = {
    "name": "web_search",
    "description": "Search the web using Tavily. Returns up to 10 results with titles, URLs, snippets, and full article text where available.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query.",
            },
            "max_results": {
                "type": "integer",
                "description": "Number of results to return. Defaults to 10.",
            },
        },
        "required": ["query"],
    },
}


class WebSearchInput(BaseModel):
    query: str
    max_results: int = 10


async def run(input: WebSearchInput, vault_path: Path) -> str:  # noqa: ARG001
    from config import get_settings

    settings = get_settings()
    if not settings.tavily_api_key:
        return "Error: TAVILY_API_KEY is not configured."

    try:
        from tavily import AsyncTavilyClient

        client = AsyncTavilyClient(api_key=settings.tavily_api_key)
        response = await client.search(
            input.query,
            max_results=input.max_results,
            include_raw_content=True,
        )
        results = []
        for r in response.get("results", []):
            entry = {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "snippet": r.get("content", ""),
            }
            raw = r.get("raw_content") or ""
            if raw:
                entry["full_content"] = raw[:3000] + ("…" if len(raw) > 3000 else "")
            results.append(entry)
        return json.dumps(results)
    except Exception as e:
        return f"Error: web search failed — {e}"
