"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Sparkles, CornerDownLeft, X, Loader2, Check } from "lucide-react";
import { transformText } from "@/lib/api";

export interface SelectionCoords {
  top: number;
  bottom: number;
  left: number;
  right: number;
  from: number;
  to: number;
  text: string;
}

interface InlineAIToolbarProps {
  selection: SelectionCoords;
  onApply: (from: number, to: number, result: string) => void;
  onDismiss: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

const TOOLBAR_W = 560;
const GAP = 8;

type Phase = "prompt" | "loading" | "review";
type DiffOp = { type: "equal" | "remove" | "add"; text: string };

function lineDiff(before: string, after: string): DiffOp[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const m = a.length, n = b.length;
  // LCS DP
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
  // Backtrack
  const raw: DiffOp[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.unshift({ type: "equal", text: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.unshift({ type: "add", text: b[j - 1] });
      j--;
    } else {
      raw.unshift({ type: "remove", text: a[i - 1] });
      i--;
    }
  }
  // Interleave consecutive remove/add blocks so changes appear side-by-side
  const ops: DiffOp[] = [];
  let k = 0;
  while (k < raw.length) {
    if (raw[k].type === "equal") {
      ops.push(raw[k++]);
    } else {
      const removes: DiffOp[] = [];
      const adds: DiffOp[] = [];
      while (k < raw.length && raw[k].type === "remove") removes.push(raw[k++]);
      while (k < raw.length && raw[k].type === "add") adds.push(raw[k++]);
      const maxLen = Math.max(removes.length, adds.length);
      for (let x = 0; x < maxLen; x++) {
        if (x < removes.length) ops.push(removes[x]);
        if (x < adds.length) ops.push(adds[x]);
      }
    }
  }
  return ops;
}

export function InlineAIToolbar({
  selection,
  onApply,
  onDismiss,
  onLoadingChange,
}: InlineAIToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("prompt");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Freeze coords so position never shifts after toolbar opens
  const frozenCoords = useRef(selection);

  const { top, bottom, left, right } = frozenCoords.current;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const midX = (left + right) / 2;
  const x = Math.max(GAP, Math.min(midX - TOOLBAR_W / 2, vw - TOOLBAR_W - GAP));
  // For review card use a max-height that matches CSS; for prompt/loading use 40px pill height
  const REVIEW_H = 360;
  const cardH = phase === "review" ? REVIEW_H : 40;
  const spaceAbove = top - GAP;
  const spaceBelow = vh - bottom - GAP;
  // Prefer above if it fits, otherwise below; always clamp to viewport
  const yRaw = spaceAbove >= cardH ? top - cardH - GAP : bottom + GAP;
  const y = Math.max(GAP, Math.min(yRaw, vh - cardH - GAP));

  const diffOps = useMemo(
    () => (result !== null ? lineDiff(selection.text, result) : []),
    [result, selection.text]
  );

  useEffect(() => {
    if (phase === "prompt") setTimeout(() => inputRef.current?.focus(), 30);
  }, [phase]);

  const handleSubmit = useCallback(async () => {
    const q = prompt.trim();
    if (!q || phase !== "prompt") return;
    setPhase("loading");
    setError(null);
    onLoadingChange?.(true);
    try {
      const { result: r } = await transformText(selection.text, q);
      setResult(r);
      setPhase("review");
    } catch {
      setError("Failed — try again");
      setPhase("prompt");
    } finally {
      onLoadingChange?.(false);
    }
  }, [prompt, phase, selection.text, onLoadingChange]);

  const handleAccept = useCallback(() => {
    if (result === null) return;
    onApply(selection.from, selection.to, result);
  }, [result, onApply, selection.from, selection.to]);

  const handleReject = useCallback(() => {
    setResult(null);
    setPhase("prompt");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    },
    [handleSubmit, onDismiss]
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{ position: "fixed", zIndex: 9998, left: x, top: y, width: TOOLBAR_W }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Prompt phase */}
      {phase === "prompt" && (
        <div className="inline-ai-bar">
          <Sparkles className="inline-ai-icon" size={14} />
          <input
            ref={inputRef}
            className="inline-ai-input"
            placeholder={error ?? "How should I change this?"}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {prompt ? (
            <button className="inline-ai-send" onClick={handleSubmit} title="Apply (Enter)">
              <CornerDownLeft size={13} />
            </button>
          ) : (
            <button className="inline-ai-dismiss" onClick={onDismiss} title="Dismiss (Esc)">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* Loading phase — shows frozen prompt so user knows what's happening */}
      {phase === "loading" && (
        <div className="inline-ai-bar inline-ai-bar--loading">
          <Sparkles className="inline-ai-icon" size={14} />
          <span className="inline-ai-loading-prompt">{prompt}</span>
          <Loader2 size={13} className="inline-ai-spin" />
        </div>
      )}

      {/* Review phase — line-by-line diff */}
      {phase === "review" && result !== null && (
        <div className="inline-ai-card">
          <div className="inline-ai-diff-lines">
            {diffOps.map((op, idx) => (
              <div key={idx} className={`diff-line diff-line--${op.type}`}>
                <span className="diff-line-gutter" aria-hidden>
                  {op.type === "remove" ? "−" : op.type === "add" ? "+" : " "}
                </span>
                <span className="diff-line-text">{op.text || "\u00a0"}</span>
              </div>
            ))}
          </div>
          <div className="inline-ai-card-actions">
            <button className="inline-ai-card-accept" onClick={handleAccept}>
              <Check size={12} strokeWidth={2.5} />
              Accept
            </button>
            <button className="inline-ai-card-reject" onClick={handleReject}>
              Try again
            </button>
            <button className="inline-ai-card-dismiss" onClick={onDismiss} title="Dismiss">
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
