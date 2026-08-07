"use client";

import { useCallback, useEffect, useState } from "react";
import { getBacklinks, type Backlink } from "@/lib/api";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContentContainer } from "@/components/layout/page-composition";

interface BacklinksPanelProps {
  notePath: string;
  onOpenFile: (path: string) => void;
}

/**
 * Supporting content inside the note (static) panel.
 * One subtle section — not a nested card around the editor or each row.
 * Spec: https://design.gitlab.com/product-foundations/layout#content-containers
 */
export function BacklinksPanel({ notePath, onOpenFile }: BacklinksPanelProps) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBacklinks(notePath);
      setBacklinks(data.backlinks);
    } catch {
      setBacklinks([]);
    } finally {
      setLoading(false);
    }
  }, [notePath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ContentContainer
      tone="subtle"
      className="shrink-0 rounded-none border-x-0 border-b-0"
      aria-label="Backlinks"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-[var(--gl-background-color-strong)]"
      >
        <Link2 size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Backlinks
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {loading ? "…" : backlinks.length}
        </span>
      </button>

      {expanded && (
        <div
          className="max-h-36 overflow-y-auto px-1 pb-2"
          style={{ scrollbarWidth: "thin" }}
        >
          {!loading && backlinks.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">No backlinks</p>
          )}
          {backlinks.map((bl) => (
            <button
              key={bl.path}
              type="button"
              onClick={() => onOpenFile(bl.path)}
              className={cn(
                "w-full rounded-sm px-2 py-1.5 text-left transition-colors",
                "hover:bg-[var(--gl-background-color-strong)]"
              )}
            >
              <div className="truncate text-xs font-medium text-foreground">
                {bl.path.replace(/\.md$/, "").split("/").pop()}
              </div>
              {bl.excerpt && (
                <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {bl.excerpt}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </ContentContainer>
  );
}
