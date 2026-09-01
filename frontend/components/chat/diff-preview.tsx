"use client";

import { useEffect, useState } from "react";
import { getNote, getDiff, type DiffHunk } from "@/lib/api";

interface DiffPreviewProps {
  filePath: string;
  newContent: string;
}

export function DiffPreview({ filePath, newContent }: DiffPreviewProps) {
  const [hunks, setHunks] = useState<DiffHunk[] | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const existing = await getNote(filePath).catch(() => null);
        if (cancelled) return;

        if (!existing) {
          setIsNew(true);
          setHunks(null);
          setLoading(false);
          return;
        }

        const diff = await getDiff(existing.content, newContent, filePath);
        if (cancelled) return;

        if (!diff.has_changes) {
          setHunks([]);
        } else {
          setHunks(diff.hunks);
        }
      } catch {
        if (!cancelled) setHunks(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [filePath, newContent]);

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-[var(--tool-label)] italic">
        Loading diff…
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--tool-label)] mb-1.5">
          New file
        </div>
        <pre
          className="text-xs font-mono leading-relaxed whitespace-pre max-h-48 overflow-auto rounded p-2"
          style={{ background: "var(--diff-add-bg)", color: "var(--diff-add-text)" }}
        >
          {newContent.length > 1500 ? newContent.slice(0, 1500) + "\n…" : newContent}
        </pre>
      </div>
    );
  }

  if (hunks && hunks.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-[var(--tool-label)] italic">
        No changes detected.
      </div>
    );
  }

  if (!hunks) return null;

  return (
    <div className="px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--tool-label)] mb-1.5">
        Changes
      </div>
      <div className="rounded overflow-hidden border border-[var(--diff-border)] max-h-56 overflow-auto">
        {hunks.map((hunk, hi) => (
          <div key={hi}>
            <div
              className="px-2 py-0.5 text-xs font-mono sticky left-0"
              style={{ background: "var(--diff-header-bg)", color: "var(--diff-header-text)" }}
            >
              @@ -{hunk.old_start} +{hunk.new_start} @@
            </div>
            {hunk.lines.map((line, li) => (
              <div
                key={li}
                className="px-2 py-px text-xs font-mono whitespace-pre"
                style={{
                  background:
                    line.type === "add"
                      ? "var(--diff-add-bg)"
                      : line.type === "remove"
                      ? "var(--diff-remove-bg)"
                      : "var(--diff-context-bg)",
                  color:
                    line.type === "add"
                      ? "var(--diff-add-text)"
                      : line.type === "remove"
                      ? "var(--diff-remove-text)"
                      : "var(--diff-context-text)",
                }}
              >
                {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
                {line.content}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
