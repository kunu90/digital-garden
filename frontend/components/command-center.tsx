"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@/components/icon";
import { useNotesList } from "@/hooks/use-notes-list";
import { searchNotes, streamAgenticSearch, type SearchMatch } from "@/lib/api";
import { useCommandPaletteTransition } from "@/hooks/use-command-palette-transition";
import { useMotionAccessibility } from "@/components/motion-provider";
import { COMMAND_PALETTE_OFFSET_Y } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface CommandCenterProps {
  open: boolean;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}

interface FileResult {
  path: string;
  name: string;
  dir: string;
  score: number;
}

interface ContentResult {
  file: string;
  name: string;
  dir: string;
  line: number;
  snippet: string; // the matching line, cleaned
}

function parsePath(path: string): { name: string; dir: string } {
  const parts = path.split("/");
  const name = parts[parts.length - 1].replace(/\.md$/, "");
  const dir = parts.slice(0, -1).join("/");
  return { name, dir };
}

function fuzzyScore(path: string, query: string): number | null {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const { name, dir } = parsePath(path);
  const lName = name.toLowerCase();
  const lDir = dir.toLowerCase();
  const lPath = path.toLowerCase();
  if (lName === q) return 100;
  if (lName.startsWith(q)) return 85;
  if (lName.includes(q)) return 70;
  if (lDir.includes(q)) return 50;
  if (lPath.includes(q)) return 45;
  let ni = 0, qi = 0;
  while (ni < lName.length && qi < q.length) {
    if (lName[ni] === q[qi]) qi++;
    ni++;
  }
  if (qi === q.length) return 30;
  let pi = 0;
  qi = 0;
  while (pi < lPath.length && qi < q.length) {
    if (lPath[pi] === q[qi]) qi++;
    pi++;
  }
  if (qi === q.length) return 15;
  return null;
}

function extractMatchLine(snippet: string): string {
  // Backend marks matching line with ">>> "
  const lines = snippet.split("\n");
  const matchLine = lines.find((l) => l.startsWith(">>> "));
  if (matchLine) return matchLine.slice(4).trim();
  // Fallback: return first non-empty line
  return lines.find((l) => l.trim()) ?? snippet;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const q = query.toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="cmd-match">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

// Flattened item for unified keyboard navigation
type NavItem =
  | { kind: "file"; result: FileResult }
  | { kind: "content"; result: ContentResult };

export function CommandCenter({ open, onClose, onOpenFile }: CommandCenterProps) {
  const notes = useNotesList();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contentResults, setContentResults] = useState<ContentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [agenticAnswer, setAgenticAnswer] = useState("");
  const [agenticLoading, setAgenticLoading] = useState(false);
  const agenticAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paletteTransition = useCommandPaletteTransition();
  const { reducedMotion, fadeTransition } = useMotionAccessibility();

  const isAskVault = query.trimStart().startsWith("?");
  const searchQuery = isAskVault ? query.trimStart().slice(1).trim() : query;

  // Local filename fuzzy search (instant)
  const fileResults: FileResult[] = useMemo(() => {
    if (isAskVault) return [];
    const filtered: FileResult[] = [];
    for (const path of notes) {
      const score = fuzzyScore(path, searchQuery);
      if (score === null) continue;
      const { name, dir } = parsePath(path);
      filtered.push({ path, name, dir, score });
    }
    return filtered
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [notes, searchQuery, isAskVault]);

  // Debounced content search via backend
  useEffect(() => {
    if (isAskVault) {
      setContentResults([]);
      setSearching(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setContentResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchNotes(q, 30);
        // Filter to content-only matches (line > 0), dedupe by file+line
        const seen = new Set<string>();
        const results: ContentResult[] = [];
        for (const m of data.results) {
          if (m.line === 0) continue; // filename match — handled locally
          const key = `${m.file}:${m.line}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const { name, dir } = parsePath(m.file);
          results.push({
            file: m.file,
            name,
            dir,
            line: m.line,
            snippet: extractMatchLine(m.snippet),
          });
        }
        setContentResults(results.slice(0, 20));
      } catch {
        setContentResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, isAskVault]);

  // Agentic vault search when query starts with ?
  useEffect(() => {
    agenticAbortRef.current?.abort();
    if (!isAskVault || !searchQuery.trim() || searchQuery.trim().length < 3) {
      setAgenticAnswer("");
      setAgenticLoading(false);
      return;
    }

    const controller = new AbortController();
    agenticAbortRef.current = controller;
    setAgenticLoading(true);
    setAgenticAnswer("");

    (async () => {
      try {
        let answer = "";
        for await (const event of streamAgenticSearch(searchQuery.trim(), controller.signal)) {
          if (event.type === "text") answer += event.delta;
        }
        setAgenticAnswer(answer);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setAgenticAnswer(`Error: ${(err as Error).message}`);
        }
      } finally {
        setAgenticLoading(false);
      }
    })();

    return () => controller.abort();
  }, [isAskVault, searchQuery]);

  // Unified nav items
  const navItems: NavItem[] = useMemo(() => [
    ...fileResults.map((r): NavItem => ({ kind: "file", result: r })),
    ...contentResults.map((r): NavItem => ({ kind: "content", result: r })),
  ], [fileResults, contentResults]);

  const totalItems = navItems.length;

  // Reset selection on results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [navItems]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setContentResults([]);
      setAgenticAnswer("");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (path: string) => {
      onOpenFile(path);
      onClose();
    },
    [onOpenFile, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = navItems[selectedIndex];
        if (item) handleSelect(item.kind === "file" ? item.result.path : item.result.file);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [navItems, selectedIndex, totalItems, handleSelect, onClose]
  );

  if (typeof document === "undefined") return null;

  const hasQuery = searchQuery.trim().length > 0;
  const showContentSection = !isAskVault && hasQuery && (contentResults.length > 0 || searching);
  let globalIdx = 0;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reducedMotion ? fadeTransition : paletteTransition}
          onClick={onClose}
        >
          <motion.div
            className="cmd-panel"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: COMMAND_PALETTE_OFFSET_Y }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: COMMAND_PALETTE_OFFSET_Y }}
            transition={reducedMotion ? fadeTransition : paletteTransition}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command center"
            aria-modal="true"
          >
        {/* Search input */}
        <div className="cmd-search-row">
          <Icon name="search" className="cmd-search-icon" size={16} />
          <input
            ref={inputRef}
            className="cmd-search-input"
            placeholder="Search files… or ?ask your vault"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          {searching && <span className="cmd-searching-dot" />}
          <kbd className="cmd-esc-hint">esc</kbd>
        </div>

        <div className="cmd-divider" />

        {/* Results */}
        <div className="cmd-results" ref={listRef}>
          {isAskVault && (
            <div className="px-3 py-2">
              <div className="cmd-section-label flex items-center gap-1">
                <Icon name="auto_awesome" size={16} />
                Ask vault
                {agenticLoading && <span className="cmd-section-loading"> thinking…</span>}
              </div>
              {!searchQuery.trim() && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Type a question after <kbd className="cmd-esc-hint">?</kbd> e.g. ?Which notes mention machine learning?
                </p>
              )}
              {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
                <p className="text-[11px] text-muted-foreground mt-2">Type at least 3 characters…</p>
              )}
              {agenticAnswer && (
                <pre className="mt-2 text-[11px] whitespace-pre-wrap text-foreground leading-relaxed max-h-48 overflow-y-auto">
                  {agenticAnswer}
                </pre>
              )}
            </div>
          )}

          {/* File name matches */}
          {fileResults.length > 0 && (
            <>
              {showContentSection && (
                <div className="cmd-section-label">Files</div>
              )}
              {fileResults.map((item) => {
                const idx = globalIdx++;
                return (
                  <div
                    key={item.path}
                    data-idx={idx}
                    className={cn("cmd-item", idx === selectedIndex && "cmd-item--selected")}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(item.path)}
                  >
                    <Icon name="description" className="cmd-file-icon" size={16} />
                    <div className="cmd-item-text">
                      <span className="cmd-file-name">
                        <HighlightMatch text={item.name} query={query} />
                      </span>
                      {item.dir && (
                        <span className="cmd-file-dir">
                          <HighlightMatch text={item.dir} query={query} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Content matches */}
          {showContentSection && (
            <>
              <div className="cmd-section-label">
                Content
                {searching && <span className="cmd-section-loading"> searching…</span>}
              </div>
              {contentResults.map((item) => {
                const idx = globalIdx++;
                return (
                  <div
                    key={`${item.file}:${item.line}`}
                    data-idx={idx}
                    className={cn("cmd-item cmd-item--content", idx === selectedIndex && "cmd-item--selected")}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(item.file)}
                  >
                    <Icon name="description" className="cmd-file-icon" size={16} />
                    <div className="cmd-item-text">
                      <div style={{ display: "flex", alignItems: "baseline", gap: 0, overflow: "hidden" }}>
                        <span className="cmd-file-name" style={{ flexShrink: 0 }}>
                          <HighlightMatch text={item.name} query={query} />
                        </span>
                        {item.dir && (
                          <span className="cmd-content-dir">&nbsp;— {item.dir}</span>
                        )}
                      </div>
                      <span className="cmd-content-snippet">
                        <HighlightMatch text={item.snippet} query={query} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Empty states */}
          {fileResults.length === 0 && !showContentSection && (
            <div className="cmd-empty">
              {hasQuery ? "No files found" : "No files in vault"}
            </div>
          )}
          {hasQuery && fileResults.length === 0 && !searching && contentResults.length === 0 && (
            <div className="cmd-empty">No results found</div>
          )}
        </div>

        {/* Footer */}
        {totalItems > 0 && (
          <div className="cmd-footer">
            <span className="cmd-footer-hint">
              <kbd>↑↓</kbd> navigate
            </span>
            <span className="cmd-footer-hint">
              <kbd>↵</kbd> open
            </span>
            <span className="cmd-footer-count">{totalItems} results</span>
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
