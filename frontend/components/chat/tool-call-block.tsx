"use client";

import { useState } from "react";
import {
  FileText,
  Search,
  Globe,
  Edit3,
  Brain,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronRight,
  FilePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallState } from "@/hooks/use-chat";
import { DiffPreview } from "./diff-preview";
import { getNote, saveNote } from "@/lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_META: Record<string, { icon: React.ComponentType<any>; label: string; color: string }> = {
  read_file:    { icon: FileText, label: "Read file",    color: "var(--tool-read)"   },
  edit_file:    { icon: Edit3,    label: "Edit file",    color: "var(--tool-edit)"   },
  files_grep:   { icon: Search,   label: "Search vault", color: "var(--tool-search)" },
  web_search:   { icon: Globe,    label: "Web search",   color: "var(--tool-web)"    },
  write_memory: { icon: Brain,    label: "Write memory", color: "var(--tool-memory)" },
};

const STATUS_ICONS = {
  pending:  <Clock        size={11} className="text-[var(--tool-pending)]"                />,
  approved: <Loader2      size={11} className="text-[var(--tool-running)] animate-spin"   />,
  running:  <Loader2      size={11} className="text-[var(--tool-running)] animate-spin"   />,
  done:     <CheckCircle2 size={11} className="text-[var(--tool-done)]"                   />,
  denied:   <XCircle      size={11} className="text-[var(--tool-denied)]"                 />,
  error:    <XCircle      size={11} className="text-[var(--tool-denied)]"                 />,
};

interface ToolCallBlockProps {
  tool: ToolCallState;
  onApprove?: (requestId: string) => void;
  onDeny?: (requestId: string) => void;
  activeNotePath?: string;
}

export function ToolCallBlock({ tool, onApprove, onDeny, activeNotePath }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [inserting, setInserting] = useState(false);
  const meta = TOOL_META[tool.name] ?? { icon: Search, label: tool.name, color: "var(--tool-read)" };
  const Icon = meta.icon;
  const statusIcon = STATUS_ICONS[tool.status];
  const inputSummary = formatInputSummary(tool.name, tool.input);

  return (
    <div className={cn("my-1.5 rounded-[3px] overflow-hidden border text-xs", getStatusBorderClass(tool.status))}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-accent transition-colors bg-muted/30"
      >
        <Icon size={11} className="shrink-0" style={{ color: meta.color }} />
        <span className="font-medium shrink-0" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className="text-muted-foreground flex-1 truncate">
          {inputSummary}
        </span>
        <span className="shrink-0">{statusIcon}</span>
        <ChevronRight
          size={11}
          className={cn("shrink-0 text-muted-foreground/50 transition-transform duration-150", expanded && "rotate-90")}
        />
      </button>

      {/* Diff preview for edit_file — only while awaiting approval */}
      {tool.awaitingApproval && tool.name === "edit_file" &&
        typeof tool.input.path === "string" && typeof tool.input.content === "string" && (
        <div className="border-t border-border bg-background">
          <DiffPreview filePath={tool.input.path} newContent={tool.input.content} />
        </div>
      )}

      {/* Approval row */}
      {tool.awaitingApproval && tool.requestId && (
        <div className="px-2.5 py-2 flex items-center gap-2 border-t border-border bg-muted/20">
          <span className="text-muted-foreground flex-1">Allow this action?</span>
          <button
            onClick={() => onApprove?.(tool.requestId!)}
            className="px-2.5 py-1 rounded-[3px] font-medium bg-foreground text-background hover:opacity-80 transition-opacity"
          >
            Approve
          </button>
          <button
            onClick={() => onDeny?.(tool.requestId!)}
            className="px-2.5 py-1 rounded-[3px] font-medium border border-border bg-background text-muted-foreground hover:bg-accent transition-colors"
          >
            Deny
          </button>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-background">
          <div className="px-2.5 py-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Input</div>
            <pre className="font-mono text-muted-foreground whitespace-pre overflow-x-auto max-h-32 overflow-y-auto">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.result && (
            <div className="px-2.5 py-1.5 border-t border-border">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Result</div>
              <pre className="font-mono text-muted-foreground whitespace-pre overflow-x-auto max-h-36 overflow-y-auto">
                {tool.result.length > 2000 ? tool.result.slice(0, 2000) + "\n…" : tool.result}
              </pre>
              {tool.name === "web_search" && tool.status === "done" && activeNotePath && (
                <button
                  type="button"
                  disabled={inserting}
                  onClick={async () => {
                    setInserting(true);
                    try {
                      const note = await getNote(activeNotePath);
                      const query = String(tool.input.query ?? "Web search");
                      const block = `\n\n## Web research: ${query}\n\n${tool.result}\n`;
                      await saveNote(activeNotePath, note.content + block);
                    } finally {
                      setInserting(false);
                    }
                  }}
                  className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-[3px] border border-border hover:bg-accent transition-colors"
                >
                  <FilePlus size={10} />
                  {inserting ? "Inserting…" : "Insert into note"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatInputSummary(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "read_file":
    case "edit_file":
      return String(input.path ?? "");
    case "files_grep":
      return String(input.pattern ?? "");
    case "web_search":
      return String(input.query ?? "");
    case "write_memory":
      return String(input.entry ?? "").slice(0, 60);
    default:
      return Object.values(input).slice(0, 1).join(", ");
  }
}

function getStatusBorderClass(status: ToolCallState["status"]): string {
  switch (status) {
    case "done":    return "border-[var(--tool-done-border)]";
    case "denied":  return "border-[var(--tool-denied-border)]";
    case "pending": return "border-[var(--tool-pending-border)]";
    default:        return "border-border";
  }
}
