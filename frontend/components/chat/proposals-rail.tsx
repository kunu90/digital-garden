"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AgentProposal, ProposalDecision } from "@/lib/agent-proposals";
import { DiffPreview } from "./diff-preview";

const HISTORY_LIMIT_HINT = 8;

function decisionBadge(decision: ProposalDecision) {
  switch (decision) {
    case "pending":
      return { variant: "attention" as const, label: "Pending" };
    case "denied":
      return { variant: "error" as const, label: "Denied" };
    default:
      return { variant: "success" as const, label: "Approved" };
  }
}

function formatDecisionTime(date?: Date) {
  if (!date) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ProposalsRailProps {
  pending: AgentProposal[];
  recent: AgentProposal[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onApproveAll: () => void;
  onDenyAll: () => void;
}

export function ProposalsRail({
  pending,
  recent,
  onApprove,
  onDeny,
  onApproveAll,
  onDenyAll,
}: ProposalsRailProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const firstPendingId = pending[0]?.id ?? null;
  const openId =
    expandedId && pending.some((item) => item.id === expandedId)
      ? expandedId
      : firstPendingId;

  return (
    <section
      aria-label="Agent proposals"
      className="shrink-0 border-b border-border bg-card"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <p className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {pending.length > 0 ? "Waiting for your decision" : "Proposals"}
        </p>
        {pending.length > 0 && (
          <Badge variant="attention">
            {pending.length} pending
          </Badge>
        )}
      </div>

      {pending.length === 0 ? (
        <Empty className="flex-none rounded-none border-0 p-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon name="task_alt" size={16} />
            </EmptyMedia>
            <EmptyTitle>Nothing waiting</EmptyTitle>
            <EmptyDescription>
              The agent proposes changes here. You approve or deny before anything is written.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {pending.map((item) => (
            <ProposalCard
              key={item.id}
              item={item}
              expanded={openId === item.id}
              onToggle={() => setExpandedId(item.id)}
              onApprove={onApprove}
              onDeny={onDeny}
            />
          ))}
          {pending.length > 1 && (
            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={onApproveAll}
              >
                Approve all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onDenyAll}
              >
                Deny all
              </Button>
            </div>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <>
          <Separator />
          <div className="px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent decisions
            </p>
            <ol className="flex max-h-28 flex-col gap-1 overflow-y-auto">
              {recent.slice(0, HISTORY_LIMIT_HINT).map((item) => {
                const badge = decisionBadge(item.decision);
                return (
                  <li
                    key={item.id}
                    className="flex min-w-0 items-center gap-2 text-xs"
                  >
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {item.target || item.summary}
                    </span>
                    <time
                      className="shrink-0 text-muted-foreground tabular-nums"
                      dateTime={item.decidedAt?.toISOString()}
                    >
                      {formatDecisionTime(item.decidedAt)}
                    </time>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </section>
  );
}

function ProposalCard({
  item,
  expanded,
  onToggle,
  onApprove,
  onDeny,
}: {
  item: AgentProposal;
  expanded: boolean;
  onToggle: () => void;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}) {
  const badge = decisionBadge(item.decision);
  const path =
    item.toolName === "edit_file" && typeof item.input.path === "string"
      ? item.input.path
      : undefined;
  const nextContent =
    item.toolName === "edit_file" && typeof item.input.content === "string"
      ? item.input.content
      : undefined;

  return (
    <article className="overflow-hidden rounded-md border border-[var(--tool-pending-border)] bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left hover:bg-accent"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {item.summary}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {item.target || "No target"}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <Icon
          name="expand_more"
          size={16}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-150",
            !expanded && "-rotate-90"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border">
          {path && nextContent ? (
            <DiffPreview filePath={path} newContent={nextContent} />
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {item.target}
            </p>
          )}
        </div>
      )}

      {item.requestId && (
        <div className="flex items-center justify-end gap-1.5 border-t border-border bg-muted/20 px-2.5 py-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => onDeny(item.requestId!)}
          >
            Deny
          </Button>
          <Button
            type="button"
            size="xs"
            onClick={() => onApprove(item.requestId!)}
          >
            Approve
          </Button>
        </div>
      )}
    </article>
  );
}
