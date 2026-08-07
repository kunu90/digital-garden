from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id: str
    message: str
    active_note_path: str | None = None


class ApprovalRequest(BaseModel):
    request_id: str
