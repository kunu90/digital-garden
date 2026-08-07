"use client";

import { useState } from "react";
import { ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  state: "streaming" | "done";
}

export function ThinkingBlock({ content, state }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="thinking-block my-2 rounded-md overflow-hidden border border-[var(--thinking-border)]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--thinking-bg-hover)] transition-colors"
        style={{ background: "var(--thinking-bg)" }}
      >
        <Brain size={13} className="shrink-0 text-[var(--thinking-icon)]" />
        <span className="text-xs font-medium text-[var(--thinking-label)] flex-1">
          {state === "streaming" ? (
            <span className="flex items-center gap-1.5">
              Thinking
              <span className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-1 h-1 rounded-full bg-[var(--thinking-icon)] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </span>
          ) : (
            "Thinking"
          )}
        </span>
        <ChevronRight
          size={13}
          className={cn(
            "shrink-0 text-[var(--thinking-icon)] transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
      </button>

      {expanded && (
        <div
          className="px-3 py-2.5 text-xs leading-relaxed font-mono whitespace-pre-wrap text-[var(--thinking-text)] border-t border-[var(--thinking-border)]"
          style={{ background: "var(--thinking-content-bg)" }}
        >
          {content}
          {state === "streaming" && (
            <span className="inline-block w-1.5 h-3 bg-[var(--thinking-icon)] ml-0.5 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
