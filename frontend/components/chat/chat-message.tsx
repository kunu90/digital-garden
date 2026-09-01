"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThinkingBlock } from "./thinking-block";
import { ToolCallBlock } from "./tool-call-block";
import type { ChatMessage } from "@/hooks/use-chat";

interface ChatMessageProps {
  message: ChatMessage;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  activeNotePath?: string;
}

export function ChatMessageView({ message, onApprove, onDeny, activeNotePath }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="chat-user-bubble max-w-[85%] rounded-lg px-3 py-2">
          {message.blocks.map((block, i) =>
            block.kind === "text" ? (
              <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--user-text)]">
                {block.content}
              </p>
            ) : null
          )}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="mb-4">
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: "var(--ai-avatar-bg)", color: "var(--ai-avatar-text)" }}
          >
            A
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {message.blocks.length === 0 ? (
            <TypingIndicator />
          ) : (
          message.blocks.map((block, i) => {
            switch (block.kind) {
              case "thinking":
                return <ThinkingBlock key={i} content={block.content} state={block.state} />;

              case "tool_call":
                return (
                  <ToolCallBlock
                    key={i}
                    tool={block.tool}
                    onApprove={onApprove}
                    onDeny={onDeny}
                    activeNotePath={activeNotePath}
                  />
                );

              case "text": {
                if (!block.content) return null;
                return (
                  <div key={i} className="text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0 text-foreground">{children}</p>
                        ),
                        code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) =>
                          inline ? (
                            <code
                              className="px-1 py-0.5 rounded-[2px] text-xs font-mono"
                              style={{ background: "var(--code-bg)", color: "var(--code-text)" }}
                              {...props}
                            >
                              {children}
                            </code>
                          ) : (
                            <pre
                              className="my-2 p-2.5 rounded-sm overflow-x-auto text-xs font-mono leading-relaxed"
                              style={{ background: "var(--code-block-bg)", color: "var(--code-block-text)" }}
                            >
                              <code {...props}>{children}</code>
                            </pre>
                          ),
                        ul: ({ children }) => (
                          <ul className="my-1.5 ml-3.5 list-disc space-y-0.5 text-foreground">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="my-1.5 ml-3.5 list-decimal space-y-0.5 text-foreground">{children}</ol>
                        ),
                        li: ({ children }) => <li className="text-sm">{children}</li>,
                        h1: ({ children }) => (
                          <h1 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-sm font-semibold mt-2.5 mb-1 text-foreground">{children}</h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-medium mt-2 mb-0.5 text-foreground">{children}</h3>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="my-1.5 pl-2.5 border-l-2 border-border italic text-muted-foreground">
                            {children}
                          </blockquote>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 text-[var(--link-text)] hover:text-[var(--link-hover)]"
                          >
                            {children}
                          </a>
                        ),
                        strong: ({ children }) => (
                          <strong className="font-semibold text-foreground">{children}</strong>
                        ),
                        hr: () => <hr className="my-3 border-border" />,
                      }}
                    >
                      {block.content}
                    </ReactMarkdown>
                    {block.streaming && (
                      <span
                        className="inline-block w-[2px] h-[1em] align-middle ml-0.5 animate-pulse rounded-full"
                        style={{ background: "var(--cursor-color)" }}
                      />
                    )}
                  </div>
                );
              }

              default:
                return null;
            }
          })
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-[3px] py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[5px] h-[5px] rounded-full animate-bounce"
          style={{
            background: "var(--muted-foreground)",
            opacity: 0.5,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
