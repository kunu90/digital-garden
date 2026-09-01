"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { getHealth } from "@/lib/api";
import { useChat } from "@/hooks/use-chat";
import { ChatMessageView } from "./chat-message";

interface ChatPanelProps {
  activeNotePath?: string;
  onFileEdit?: (path: string) => void;
}

export function ChatPanel({ activeNotePath, onFileEdit }: ChatPanelProps) {
  const {
    messages,
    isStreaming,
    sessions,
    pendingCount,
    sendMessage,
    stopStreaming,
    approve,
    deny,
    approveAll,
    denyAll,
    newSession,
    selectSession,
    sessionId,
  } = useChat(onFileEdit);

  const [input, setInput] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [anthropicConfigured, setAnthropicConfigured] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sessionsRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    getHealth()
      .then((h) => setAnthropicConfigured(h.ai.anthropic_configured))
      .catch(() => setAnthropicConfigured(null));
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (sessionsRef.current && !sessionsRef.current.contains(e.target as Node)) {
        setSessionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAutoScroll(nearBottom);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isStreaming) {
      stopStreaming();
      return;
    }
    const text = input.trim();
    if (!text) return;
    setInput("");
    setAutoScroll(true);
    await sendMessage(text, activeNotePath);
  }, [input, isStreaming, sendMessage, activeNotePath, stopStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const isEmpty = messages.length === 0;
  const currentPreview =
    sessions.find((s) => s.id === sessionId)?.preview ||
    (isEmpty ? "New chat" : "Current chat");

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex h-10 items-center justify-between shrink-0 border-b border-border px-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon name="auto_awesome" size={16} className="text-muted-foreground shrink-0" />
          <div className="relative min-w-0" ref={sessionsRef}>
            <button
              type="button"
              onClick={() => setSessionsOpen((o) => !o)}
              className="flex items-center gap-1 max-w-[180px] text-[11px] font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground transition-colors"
            >
              <span className="truncate">{currentPreview.slice(0, 28) || "Agent"}</span>
              <Icon name="expand_more" size={16} className="shrink-0" />
            </button>
            {sessionsOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-popover shadow-md py-1 max-h-48 overflow-y-auto">
                {sessions.length === 0 && (
                  <p className="px-2.5 py-1.5 text-[11px] text-muted-foreground">No saved sessions</p>
                )}
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      selectSession(s.id);
                      setSessionsOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 text-[11px] hover:bg-accent transition-colors",
                      s.id === sessionId && "bg-accent/60"
                    )}
                  >
                    <div className="truncate font-medium">
                      {s.preview || s.id.slice(0, 8)}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {new Date(s.updated_at).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={newSession}
          title="New conversation"
          className="flex items-center gap-1 px-1.5 py-1 rounded-sm text-[11px] transition-colors hover:bg-accent text-muted-foreground shrink-0"
        >
          <Icon name="add" size={16} />
          New
        </button>
      </div>

      {anthropicConfigured === false && (
        <div className="shrink-0 border-b border-[color-mix(in_srgb,var(--attention)_25%,var(--border))] bg-[color-mix(in_srgb,var(--attention)_8%,var(--card))] px-3 py-2 text-[11px] leading-snug text-[var(--attention)]">
          Add your Anthropic API key to <code className="rounded bg-black/8 px-1 py-0.5 font-mono text-[10px]">backend/.env</code> as{" "}
          <code className="rounded bg-black/8 px-1 py-0.5 font-mono text-[10px]">ANTHROPIC_API_KEY</code>, then restart the app. See{" "}
          <code className="font-mono text-[10px]">backend/API_KEYS.md</code>.
        </div>
      )}

      {pendingCount > 1 && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0">
          <span className="text-[10px] text-muted-foreground flex-1">
            {pendingCount} actions awaiting approval
          </span>
          <button
            type="button"
            onClick={approveAll}
            className="text-[10px] px-2 py-0.5 rounded-[3px] bg-foreground text-background hover:opacity-80"
          >
            Approve all
          </button>
          <button
            type="button"
            onClick={denyAll}
            className="text-[10px] px-2 py-0.5 rounded-[3px] border border-border hover:bg-accent"
          >
            Deny all
          </button>
        </div>
      )}

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 min-h-0"
        style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
      >
        {isEmpty ? (
          <EmptyState onSuggest={(s) => sendMessage(s, activeNotePath)} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessageView
                key={msg.id}
                message={msg}
                onApprove={approve}
                onDeny={deny}
                activeNotePath={activeNotePath}
              />
            ))}
            <div ref={messagesEndRef} className="h-1" />
          </>
        )}
      </div>

      {activeNotePath && (
        <div className="px-3 py-1 flex items-center gap-1.5 border-t border-border shrink-0 bg-muted/30">
          <span className="text-[10px] text-muted-foreground truncate">
            Context: <span className="font-medium">{activeNotePath}</span>
          </span>
        </div>
      )}

      <div className="px-2.5 pb-2 pt-1.5 shrink-0 border-t border-border">
        <div className="flex items-end gap-1.5 rounded-[3px] px-2 py-1 border border-border bg-background focus-within:border-ring/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your notes…"
            rows={1}
            disabled={isStreaming}
            className={cn(
              "flex-1 resize-none bg-transparent text-[12px] outline-none min-h-[20px] max-h-[120px] leading-relaxed",
              "placeholder:text-muted-foreground/50",
              "text-foreground",
              "disabled:opacity-60"
            )}
            style={{ fontFamily: "inherit" }}
          />
          <button
            onClick={handleSubmit}
            disabled={!isStreaming && !input.trim()}
            title={isStreaming ? "Stop generation" : "Send"}
            className={cn(
              "shrink-0 h-[22px] w-[22px] rounded-[3px] flex items-center justify-center transition-all mb-px",
              isStreaming
                ? "bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer"
                : "bg-foreground text-background hover:opacity-75 disabled:opacity-25 disabled:cursor-not-allowed"
            )}
          >
            {isStreaming ? (
                <Icon name="stop" size={16} filled />
              ) : (
                <Icon name="send" size={16} />
              )}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggest }: { onSuggest: (s: string) => void }) {
  const suggestions = [
    "Summarize my recent notes",
    "Search the web for a topic and create a note",
    "Help me brainstorm ideas for a new note",
    "Find connections between my notes",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 py-6">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-accent">
          <Icon name="auto_awesome" size={16} className="text-muted-foreground" />
        </div>
        <p className="text-[11px] font-semibold text-foreground">Writing Agent</p>
        <p className="text-[11px] text-center text-muted-foreground max-w-[180px]">
          Research, write, and edit your notes with AI assistance
        </p>
      </div>

      <div className="w-full space-y-1">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="w-full text-left px-2.5 py-1.5 rounded-[3px] text-[11px] text-muted-foreground border border-border hover:border-primary/40 hover:bg-accent cursor-pointer transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
