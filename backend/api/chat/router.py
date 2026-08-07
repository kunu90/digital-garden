import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.chat.schemas import ApprovalRequest, ChatRequest
from assistant.harness.orchestrator import Orchestrator
from assistant.harness.memory import delete_session, list_sessions_with_meta, load_session
from vault_config import get_vault_path

router = APIRouter(prefix="/chat", tags=["chat"])

# Single orchestrator instance for the app lifetime
_orchestrator = Orchestrator()


async def _sse_stream(gen):
    """Wrap an async generator of dicts into SSE-formatted text."""
    async for event in gen:
        yield f"data: {json.dumps(event)}\n\n"


def _get_vault():
    vault_path = get_vault_path()
    if not vault_path:
        raise HTTPException(status_code=400, detail="Vault path not configured.")
    return vault_path


def _content_to_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return ""


def _session_to_display(messages: list[dict]) -> list[dict]:
    display: list[dict] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        if role == "user" and isinstance(content, str) and content.strip():
            display.append({"role": "user", "text": content})
        elif role == "assistant":
            text = _content_to_text(content)
            if text.strip():
                display.append({"role": "assistant", "text": text})
    return display


@router.get("/sessions")
def get_sessions():
    """List all chat sessions with metadata."""
    vault_path = _get_vault()
    return {"sessions": list_sessions_with_meta(vault_path)}


@router.get("/sessions/{session_id}")
def get_session(session_id: str):
    """Load a chat session for display."""
    vault_path = _get_vault()
    messages = load_session(vault_path, session_id)
    if not messages:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {
        "session_id": session_id,
        "messages": _session_to_display(messages),
    }


@router.delete("/sessions/{session_id}")
def remove_session(session_id: str):
    """Delete a chat session."""
    vault_path = _get_vault()
    deleted = delete_session(vault_path, session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"deleted": session_id}


@router.post("")
async def chat(body: ChatRequest):
    """Stream a chat response as SSE."""
    vault_path = _get_vault()
    stream = await _orchestrator.run_chat(
        session_id=body.session_id,
        user_message=body.message,
        vault_path=vault_path,
        active_note_path=body.active_note_path,
    )
    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(_sse_stream(stream), media_type="text/event-stream", headers=headers)


@router.post("/approve")
def approve_tool(body: ApprovalRequest):
    """Approve a pending tool call (unblocks the ReActLoop)."""
    ok = _orchestrator.gate.approve(body.request_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No pending request with that ID.")
    return {"status": "approved", "request_id": body.request_id}


@router.post("/deny")
def deny_tool(body: ApprovalRequest):
    """Deny a pending tool call (unblocks the ReActLoop with denial)."""
    ok = _orchestrator.gate.deny(body.request_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No pending request with that ID.")
    return {"status": "denied", "request_id": body.request_id}
