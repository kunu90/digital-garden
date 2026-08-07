---
name: agentic-dev
description: This skill should be used when working on agentic AI systems, ReAct loops, context engineering, orchestrator-subagent patterns, tool design, or LLM reasoning pipelines. Activate when the user mentions "react loop", "tool use", "context engineering", "orchestrator", "subagent", "extended thinking", "agentic", "harness", "PermissionGate", "ToolRegistry", "SSE streaming", or is building/debugging any part of the digital garden's AI orchestration layer.
version: 1.0.0
---

# Agentic Development Guide

This project implements an AI assistant as a **ReAct loop** (Reason + Act) over Claude, with streaming SSE to the frontend. The core architecture lives in `backend/assistant/`.

## Architecture Map

```
POST /chat
  → Orchestrator.run()
    → ReActLoop.step()  (loop until done or max_steps)
      → ClaudeClient.stream()  (Anthropic SDK, SSE)
        ↓ text delta, thinking delta, tool_use block
      → ToolRegistry.dispatch(tool_name, args)
        → PermissionGate.check()  (gate sensitive ops)
          ↓ emit permission_request SSE, await asyncio.Event
          ↓ POST /chat/approve or /chat/deny resumes gate
        → tool.execute()
      → append tool_result to messages
    ↺ loop (with context compaction if near limit)
  → emit done SSE
```

## ReAct Loop Engineering

**Core principle:** The loop runs until Claude stops calling tools OR hits a step limit. Each iteration: think → act → observe → repeat.

**Loop health checklist:**
- Always append `tool_result` after every `tool_use` — Claude will error if tool calls lack results
- Track `tool_use_id` precisely; mismatches cause API errors
- After `stop_reason == "end_turn"` with no tool calls, exit the loop
- After `stop_reason == "tool_use"`, always continue the loop even if you think you're done

**Step limiting:** Set a generous but finite `max_steps` (e.g. 20). Too low truncates legitimate tasks; too high enables runaway loops. Emit a `done` SSE with a "max steps reached" message if limit hit.

**Error recovery:** Wrap each step in try/except. Tool errors should be fed back as `tool_result` with `is_error: true` — let Claude self-correct rather than crashing the loop.

## Context Engineering

**The problem:** Claude has a finite context window. Long agentic sessions accumulate: system prompt + full message history + all tool results + thinking blocks.

**Strategy (implemented in harness):**
1. **Compress old tool results** — keep only the last N tool results in full; replace older ones with summaries or truncated versions
2. **Trim history** — when approaching the context limit, drop the oldest user/assistant turns (keep at least the system prompt + last K turns)
3. **Summarize mid-session** — for very long tasks, inject a "summary so far" assistant message and truncate prior history
4. **Token counting** — use `client.count_tokens()` before sending; gate compaction on threshold (e.g. 80% of max tokens)

**What to preserve:** System prompt always. The most recent tool results (they give Claude current state). The most recent assistant reasoning.

**What to compress first:** Middle tool results from routine read/search operations. Thinking blocks from prior turns (Claude's visible `<thinking>` output is often large but not needed for future reasoning).

## Tool Design

**ToolRegistry pattern:** Tools register themselves with a spec (JSON Schema for `input_schema`) and an async `execute()` method. The registry dispatches by name and validates inputs.

```python
# Good tool spec — tight schema prevents hallucinated args
{
  "name": "read_file",
  "description": "Read a file from the vault. Use for reading note content.",
  "input_schema": {
    "type": "object",
    "properties": {
      "path": {"type": "string", "description": "Relative path from vault root"}
    },
    "required": ["path"]
  }
}
```

**Tool description rules:**
- Be specific about WHEN to use it vs similar tools (e.g. `read_file` vs `files_grep`)
- State what it returns so Claude can reason about the output
- Mention side effects explicitly (e.g. "writes to disk", "makes web request")
- Don't bloat — Claude reads all tool descriptions every turn; keep them tight

**Permission-gated tools:** `edit_file`, `web_search`, `write_memory` require user approval. The gate suspends the loop via `asyncio.Event`. Frontend shows diff/details and Approve/Deny buttons. On approval, the event is set and loop resumes. On denial, a synthetic `tool_result` with `is_error: true` is injected.

**Agentic search pattern:** Don't read everything — search first, then read selectively:
1. `files_grep(pattern)` → get candidate file list
2. `read_file(path)` → read the most relevant hits
3. Only request more if first reads are insufficient

## Prompt Engineering

**System prompt structure for agentic tasks:**
```
1. Role + capabilities (brief)
2. Vault structure + conventions (what files mean, how wikilinks work)
3. Tool usage policy (when to use which tool, search-before-read)
4. Reasoning policy (think before acting, be explicit about uncertainty)
5. Output policy (stream natural language, don't dump raw tool output)
6. Memory + session context (inject cross-session memory here)
```

**Prompt for longer tasks:** Explicitly instruct Claude NOT to stop prematurely:
> "For complex tasks: search, read, edit, verify, then summarize. Don't ask for confirmation mid-task unless you hit a genuine ambiguity. Complete the full task before reporting."

**Tool call steering:** If Claude tends to over-use a tool, add negative examples in the description. If Claude under-uses thinking, add `"Think step by step before choosing a tool."` to the system prompt.

**Anti-patterns to avoid:**
- Vague tool descriptions → Claude picks wrong tool
- No explicit stop condition → loop runs to max_steps every time
- Injecting raw JSON into the assistant turn → confuses the message format

## Orchestrator–Subagents Pattern

**This project's orchestrator:** The `ReActLoop` + `Orchestrator` in `backend/assistant/harness/` acts as the orchestrator. It has a single Claude instance doing all reasoning and tool dispatch.

**When to go multi-agent:**
- Tasks that benefit from parallelism (e.g. search multiple sources simultaneously)
- Tasks with distinct reasoning modes (e.g. one agent plans, another executes)
- Isolation: give a subagent only the tools it needs (least privilege)

**Subagent invocation pattern (Claude Code style):**
The orchestrator calls `Agent` tool with a `prompt` and `subagent_type`. The subagent runs in isolation, returns a single result message. The orchestrator incorporates the result and continues.

**Key design decisions:**
- Subagents should be **stateless** — they receive all context in the prompt, return a complete result
- The orchestrator manages **state** (conversation history, files modified, decisions made)
- Don't spawn subagents for tasks that need back-and-forth; they're for bounded, parallel, or isolated work

**Fan-out pattern:**
```
orchestrator: "Search these 5 sources in parallel"
  → spawn subagent A: search source 1
  → spawn subagent B: search source 2  (parallel)
  → spawn subagent C: search source 3  (parallel)
orchestrator: collect results, synthesize, continue
```

## Extended Thinking

**When to enable:** Complex multi-step reasoning tasks, ambiguous requests, planning tasks where Claude needs to weigh tradeoffs. NOT needed for simple tool dispatch.

**Implementation:** Pass `thinking: {"type": "enabled", "budget_tokens": N}` in the API call. The `ClaudeClient` handles streaming `thinking_start/delta/end` events and emits them as SSE for the frontend's `ThinkingBlock` component.

**Budget tokens:** 1024–4096 for most tasks. 8192+ for deep planning. Thinking counts toward context — don't enable for every turn in a long session.

**Frontend display:** `thinking-block.tsx` renders as a collapsible block. Users can expand to see Claude's reasoning. This builds trust and helps debug unexpected tool choices.

**Prompt interaction:** When thinking is enabled, you can be less prescriptive in the system prompt — Claude will reason through ambiguity internally. Still provide structure for output format.

## SSE Streaming Architecture

**Event flow (backend → frontend):**
```
text          → append to current assistant message bubble
thinking_*    → update ThinkingBlock (collapsible)
tool_call     → show ToolCallBlock with spinner
permission_request → show diff preview + Approve/Deny
tool_result   → update ToolCallBlock with result/status
tool_denied   → show denied state in ToolCallBlock
done          → finalize message, enable input
```

**Critical:** Always emit `done` even on error — otherwise the frontend spinner never stops.

**Backpressure:** FastAPI + asyncio handles backpressure naturally via the async generator. Don't buffer large responses; stream token by token.

## Debugging Agentic Loops

**Common failure modes:**
1. **Loop exits too early** — Claude's `stop_reason` was `end_turn` but it didn't finish. Fix: stronger system prompt instruction to complete the task.
2. **Loop runs forever** — tool always returns results, Claude always searches more. Fix: add "stop searching after 3 unsuccessful attempts" to system prompt.
3. **Tool result ignored** — Claude re-calls same tool with same args. Fix: check if prior result is in context; may be getting truncated.
4. **Permission gate hangs** — frontend never got `permission_request`. Fix: check SSE connection is alive; check `asyncio.Event` is being awaited.
5. **Context overflow** — API returns 400 on token limit. Fix: trigger compaction earlier (lower threshold).

**Instrumentation:** Log each loop iteration: step number, tool called, token count, stop_reason. This makes agentic traces debuggable.
