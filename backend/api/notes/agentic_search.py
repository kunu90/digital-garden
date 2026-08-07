import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from assistant.harness.agents.research import ResearchAgent
from vault_config import get_vault_path

router = APIRouter(prefix="/search", tags=["search"])


class AgenticSearchRequest(BaseModel):
    query: str


async def _sse_stream(gen):
    async for event in gen:
        yield f"data: {json.dumps(event)}\n\n"


@router.post("/agentic")
async def agentic_search(body: AgenticSearchRequest):
    """Run the research agent over the vault and stream the answer."""
    vault_path = get_vault_path()
    if vault_path is None:
        raise HTTPException(status_code=400, detail="Vault not configured.")

    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query is required.")

    agent = ResearchAgent()
    stream = await agent.search(body.query.strip(), vault_path)

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(_sse_stream(stream), media_type="text/event-stream", headers=headers)
