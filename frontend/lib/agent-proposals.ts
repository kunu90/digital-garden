import type { ChatMessage, ToolCallState } from "@/hooks/use-chat";

const GATED_TOOLS = new Set(["edit_file", "web_search", "write_memory"]);

export type ProposalDecision = "pending" | "approved" | "denied";

export type AgentProposal = {
  id: string;
  requestId?: string;
  toolName: string;
  target: string;
  summary: string;
  status: ToolCallState["status"];
  decision: ProposalDecision;
  awaitingApproval: boolean;
  input: Record<string, unknown>;
  decidedAt?: Date;
};

export function proposalTarget(
  toolName: string,
  input: Record<string, unknown>
): string {
  switch (toolName) {
    case "read_file":
    case "edit_file":
      return String(input.path ?? "");
    case "files_grep":
      return String(input.pattern ?? "");
    case "web_search":
      return String(input.query ?? "");
    case "write_memory":
      return String(input.entry ?? "").slice(0, 80);
    default:
      return Object.values(input).slice(0, 1).map(String).join(", ");
  }
}

export function proposalSummary(toolName: string): string {
  switch (toolName) {
    case "edit_file":
      return "Edit file";
    case "web_search":
      return "Web search";
    case "write_memory":
      return "Write memory";
    default:
      return toolName.replaceAll("_", " ");
  }
}

export function proposalDecision(tool: ToolCallState): ProposalDecision {
  if (tool.awaitingApproval || tool.status === "pending") return "pending";
  if (tool.status === "denied") return "denied";
  return "approved";
}

export function deriveAgentControl(
  messages: ChatMessage[],
  historyLimit = 8
): { pending: AgentProposal[]; recent: AgentProposal[] } {
  const items: AgentProposal[] = [];

  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.kind !== "tool_call") continue;
      const tool = block.tool;
      if (!GATED_TOOLS.has(tool.name)) continue;
      if (!tool.awaitingApproval && !tool.requestId) continue;

      items.push({
        id: tool.id,
        requestId: tool.requestId,
        toolName: tool.name,
        target: proposalTarget(tool.name, tool.input),
        summary: proposalSummary(tool.name),
        status: tool.status,
        decision: proposalDecision(tool),
        awaitingApproval: Boolean(tool.awaitingApproval && tool.requestId),
        input: tool.input,
        decidedAt: tool.resolvedAt,
      });
    }
  }

  const pending = items.filter((item) => item.awaitingApproval);
  const recent = items
    .filter(
      (item) =>
        !item.awaitingApproval &&
        (item.decision === "approved" || item.decision === "denied")
    )
    .slice(-historyLimit)
    .reverse();

  return { pending, recent };
}
