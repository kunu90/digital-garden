import asyncio
import uuid
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class PendingRequest:
    tool: str
    input: dict
    event: asyncio.Event = field(default_factory=asyncio.Event)
    approved: bool = False


class PermissionGate:
    """
    Human-in-the-loop approval gate.

    Before any tool executes, the ReActLoop calls `request()` which:
    1. Stores a pending approval keyed by request_id
    2. Yields a `permission_request` SSE event to the frontend
    3. Suspends execution until the frontend calls approve() or deny()
    """

    def __init__(self) -> None:
        self._pending: dict[str, PendingRequest] = {}

    async def request(
        self, tool: str, tool_input: dict
    ) -> AsyncGenerator[dict, None]:
        """
        Async generator that yields a permission_request event then suspends.
        Resume by calling approve() or deny() with the returned request_id.
        Returns (approved: bool) via the pending request object.
        """
        request_id = str(uuid.uuid4())
        pending = PendingRequest(tool=tool, input=tool_input)
        self._pending[request_id] = pending

        yield {
            "type": "permission_request",
            "request_id": request_id,
            "tool": tool,
            "input": tool_input,
        }

        await pending.event.wait()
        # Do NOT pop here — is_approved() reads the status and cleans up

    def approve(self, request_id: str) -> bool:
        """Approve a pending tool call. Returns False if request_id not found."""
        if pending := self._pending.get(request_id):
            pending.approved = True
            pending.event.set()
            return True
        return False

    def deny(self, request_id: str) -> bool:
        """Deny a pending tool call. Returns False if request_id not found."""
        if pending := self._pending.get(request_id):
            pending.approved = False
            pending.event.set()
            return True
        return False

    def is_approved(self, request_id: str) -> bool:
        """Read approval status then clean up. Must be called exactly once per request."""
        pending = self._pending.pop(request_id, None)
        return pending.approved if pending else False

    @property
    def vault_path(self) -> Path | None:  # noqa: D102
        return None
