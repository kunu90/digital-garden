"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  approveToolCall,
  denyToolCall,
  loadSession,
  streamChat,
  type ChatSSEEvent,
  type SessionMeta,
} from "@/lib/api";

export type ThinkingState = "streaming" | "done";

export type ToolCallState = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "pending" | "approved" | "denied" | "running" | "done" | "error";
  result?: string;
  requestId?: string;
  awaitingApproval?: boolean;
  resolvedAt?: Date;
};

export type MessageBlock =
  | { kind: "text"; content: string; streaming?: boolean }
  | { kind: "thinking"; content: string; state: ThinkingState }
  | { kind: "tool_call"; tool: ToolCallState }
  | { kind: "permission"; requestId: string; tool: string; input: Record<string, unknown>; resolved?: "approved" | "denied" }
  | { kind: "diff"; filePath: string; hunks: import("@/lib/api").DiffHunk[]; content: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  blocks: MessageBlock[];
  createdAt: Date;
};

const SESSION_STORAGE_KEY = "digital-garden-session-id";

type ChatState = {
  messages: ChatMessage[];
  isStreaming: boolean;
  sessionId: string;
  sessions: SessionMeta[];
};

function displayToMessages(display: { role: "user" | "assistant"; text: string }[]): ChatMessage[] {
  return display.map((m) => ({
    id: crypto.randomUUID(),
    role: m.role,
    blocks: [{ kind: "text" as const, content: m.text }],
    createdAt: new Date(),
  }));
}

export function useChat(onFileEdit?: (path: string) => void) {
  const [state, setState] = useState<ChatState>(() => ({
    messages: [],
    isStreaming: false,
    sessionId:
      (typeof window !== "undefined" && localStorage.getItem(SESSION_STORAGE_KEY)) ||
      crypto.randomUUID(),
    sessions: [],
  }));

  const abortRef = useRef<AbortController | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const { sessions } = await import("@/lib/api").then((m) => m.listSessions());
      setState((s) => ({ ...s, sessions }));
    } catch {
      // vault may not be ready
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, state.sessionId);
  }, [state.sessionId]);

  const addUserMessage = useCallback((text: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      blocks: [{ kind: "text", content: text }],
      createdAt: new Date(),
    };
    setState((s) => ({ ...s, messages: [...s.messages, msg] }));
    return msg;
  }, []);

  const handleEvent = async (
    event: ChatSSEEvent,
    updateBlocks: (fn: (b: MessageBlock[]) => MessageBlock[]) => void,
    appendTextDelta: (d: string) => void
  ) => {
    switch (event.type) {
      case "text":
        appendTextDelta(event.delta);
        break;

      case "thinking_start":
        updateBlocks((blocks) => [
          ...blocks,
          { kind: "thinking", content: "", state: "streaming" },
        ]);
        break;

      case "thinking_delta":
        updateBlocks((blocks) => {
          const last = blocks[blocks.length - 1];
          if (last?.kind === "thinking" && last.state === "streaming") {
            return [
              ...blocks.slice(0, -1),
              { ...last, content: last.content + event.delta },
            ];
          }
          return blocks;
        });
        break;

      case "thinking_end":
        updateBlocks((blocks) =>
          blocks.map((b) =>
            b.kind === "thinking" && b.state === "streaming"
              ? { ...b, state: "done" as ThinkingState }
              : b
          )
        );
        break;

      case "tool_call": {
        const tool: ToolCallState = {
          id: event.tool_use_id,
          name: event.name,
          input: event.input,
          status: "running",
        };
        updateBlocks((blocks) => [...blocks, { kind: "tool_call", tool }]);
        break;
      }

      case "permission_request":
        updateBlocks((blocks) =>
          blocks.map((b) => {
            if (b.kind === "tool_call" && b.tool.name === event.tool && b.tool.status === "running") {
              return {
                ...b,
                tool: {
                  ...b.tool,
                  status: "pending",
                  requestId: event.request_id,
                  awaitingApproval: true,
                },
              };
            }
            return b;
          })
        );
        break;

      case "tool_result":
        updateBlocks((blocks) => {
          let editedPath: string | undefined;
          const updated = blocks.map((b) => {
            if (
              b.kind === "tool_call" &&
              b.tool.name === event.name &&
              (b.tool.status === "running" || b.tool.status === "pending" || b.tool.status === "approved")
            ) {
              if (event.name === "edit_file") {
                editedPath = b.tool.input.path as string | undefined;
              }
              return {
                ...b,
                tool: {
                  ...b.tool,
                  status: "done" as const,
                  result: event.content,
                },
              };
            }
            return b;
          });
          if (editedPath && onFileEdit) {
            setTimeout(() => onFileEdit(editedPath!), 50);
          }
          return updated;
        });
        break;

      case "tool_denied":
        updateBlocks((blocks) =>
          blocks.map((b) =>
            b.kind === "tool_call" && b.tool.requestId === event.request_id
              ? {
                  ...b,
                  tool: {
                    ...b.tool,
                    status: "denied",
                    awaitingApproval: false,
                    resolvedAt: b.tool.resolvedAt ?? new Date(),
                  },
                }
              : b
          )
        );
        break;

      case "done":
        break;
    }
  };

  const sendMessage = useCallback(
    async (text: string, activeNotePath?: string) => {
      if (state.isStreaming) return;

      addUserMessage(text);

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        blocks: [],
        createdAt: new Date(),
      };

      setState((s) => ({
        ...s,
        isStreaming: true,
        messages: [...s.messages, assistantMsg],
      }));

      const updateBlocks = (updater: (blocks: MessageBlock[]) => MessageBlock[]) => {
        setState((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === assistantId ? { ...m, blocks: updater(m.blocks) } : m
          ),
        }));
      };

      const appendTextDelta = (delta: string) => {
        updateBlocks((blocks) => {
          const last = blocks[blocks.length - 1];
          if (last?.kind === "text" && last.streaming) {
            return [
              ...blocks.slice(0, -1),
              { ...last, content: last.content + delta },
            ];
          }
          return [...blocks, { kind: "text", content: delta, streaming: true }];
        });
      };

      const finalizeText = () => {
        updateBlocks((blocks) =>
          blocks.map((b) => (b.kind === "text" && b.streaming ? { ...b, streaming: false } : b))
        );
      };

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const event of streamChat(
          {
            session_id: state.sessionId,
            message: text,
            active_note_path: activeNotePath,
          },
          controller.signal
        )) {
          await handleEvent(event, updateBlocks, appendTextDelta);
        }
        await refreshSessions();
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          updateBlocks((blocks) => [
            ...blocks,
            { kind: "text", content: `\n\n*Error: ${(err as Error).message}*`, streaming: false },
          ]);
        }
      } finally {
        finalizeText();
        setState((s) => ({ ...s, isStreaming: false }));
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.isStreaming, state.sessionId, addUserMessage, refreshSessions]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const approve = useCallback(async (requestId: string) => {
    setState((s) => ({
      ...s,
      messages: s.messages.map((m) => ({
        ...m,
        blocks: m.blocks.map((b) =>
          b.kind === "tool_call" && b.tool.requestId === requestId
            ? {
                ...b,
                tool: {
                  ...b.tool,
                  status: "approved" as const,
                  awaitingApproval: false,
                  resolvedAt: new Date(),
                },
              }
            : b
        ),
      })),
    }));
    await approveToolCall(requestId);
  }, []);

  const deny = useCallback(async (requestId: string) => {
    setState((s) => ({
      ...s,
      messages: s.messages.map((m) => ({
        ...m,
        blocks: m.blocks.map((b) =>
          b.kind === "tool_call" && b.tool.requestId === requestId
            ? {
                ...b,
                tool: {
                  ...b.tool,
                  status: "denied" as const,
                  awaitingApproval: false,
                  resolvedAt: new Date(),
                },
              }
            : b
        ),
      })),
    }));
    await denyToolCall(requestId);
  }, []);

  const approveAll = useCallback(async () => {
    const pending: string[] = [];
    state.messages.forEach((m) =>
      m.blocks.forEach((b) => {
        if (b.kind === "tool_call" && b.tool.awaitingApproval && b.tool.requestId) {
          pending.push(b.tool.requestId);
        }
      })
    );
    await Promise.all(pending.map((id) => approve(id)));
  }, [state.messages, approve]);

  const denyAll = useCallback(async () => {
    const pending: string[] = [];
    state.messages.forEach((m) =>
      m.blocks.forEach((b) => {
        if (b.kind === "tool_call" && b.tool.awaitingApproval && b.tool.requestId) {
          pending.push(b.tool.requestId);
        }
      })
    );
    await Promise.all(pending.map((id) => deny(id)));
  }, [state.messages, deny]);

  const pendingCount = state.messages.reduce((count, m) => {
    return (
      count +
      m.blocks.filter(
        (b) => b.kind === "tool_call" && b.tool.awaitingApproval && b.tool.requestId
      ).length
    );
  }, 0);

  const newSession = useCallback(() => {
    abortRef.current?.abort();
    const newId = crypto.randomUUID();
    setState((s) => ({
      ...s,
      messages: [],
      isStreaming: false,
      sessionId: newId,
    }));
    localStorage.setItem(SESSION_STORAGE_KEY, newId);
  }, []);

  const selectSession = useCallback(async (sessionId: string) => {
    abortRef.current?.abort();
    try {
      const data = await loadSession(sessionId);
      setState((s) => ({
        ...s,
        sessionId,
        messages: displayToMessages(data.messages),
        isStreaming: false,
      }));
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    } catch {
      // keep current session on error
    }
  }, []);

  // Restore session on mount if persisted
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      loadSession(stored)
        .then((data) => {
          if (data.messages.length > 0) {
            setState((s) => ({
              ...s,
              sessionId: stored,
              messages: displayToMessages(data.messages),
            }));
          }
        })
        .catch(() => {
          // new session id is fine
        });
    }
  }, []);

  return {
    messages: state.messages,
    isStreaming: state.isStreaming,
    sessionId: state.sessionId,
    sessions: state.sessions,
    pendingCount,
    sendMessage,
    stopStreaming,
    approve,
    deny,
    approveAll,
    denyAll,
    newSession,
    selectSession,
    refreshSessions,
  };
}
