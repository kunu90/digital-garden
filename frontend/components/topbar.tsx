"use client";

import { Columns2, GitFork, Moon, Sun, Sparkles, Search, Keyboard, Undo2, Sprout } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useWorkspace, GRAPH_TAB_PATH } from "@/context/workspace-context";
import { cn } from "@/lib/utils";
import { getEditHistory, revertEdit } from "@/lib/api";
import { TopBarRegion } from "@/components/layout/page-composition";

const SHORTCUTS = [
  {
    section: "Navigation",
    items: [
      { keys: ["⌘", "K"], description: "Search files / Open command center" },
      { keys: ["⌘", "K"], description: "Inline AI edit (with text selected)" },
    ],
  },
  {
    section: "Editor",
    items: [
      { keys: ["Tab"], description: "Accept AI tab completion" },
      { keys: ["Esc"], description: "Dismiss AI tab completion" },
    ],
  },
  {
    section: "Interface",
    items: [
      { keys: ["⌘", "B"], description: "Toggle sidebar" },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded-[var(--gl-border-radius-sm)] border border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-strong)] px-1.5 py-0.5 font-mono text-[11px] leading-none text-[var(--gl-text-color-subtle)]">
      {children}
    </kbd>
  );
}

function KeyboardShortcutsPopover() {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon-sm" title="Keyboard shortcuts">
          <Keyboard size={16} />
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-[var(--gl-border-radius-lg)] border border-[var(--gl-border-color-strong)] bg-[var(--gl-background-color-overlap)] p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Keyboard Shortcuts
          </p>
          <div className="space-y-4">
            {SHORTCUTS.map((group) => (
              <div key={group.section}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {group.section}
                </p>
                <div className="space-y-1.5">
                  {group.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-foreground/80">{item.description}</span>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {item.keys.map((k, j) => (
                          <Kbd key={j}>{k}</Kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Shown in the top bar only while the sidebar is collapsed (⌘B also works). */
function SidebarExpandWhenCollapsed() {
  const { open, isMobile, openMobile } = useSidebar();
  const collapsed = isMobile ? !openMobile : !open;
  if (!collapsed) return null;
  return <SidebarTrigger title="Expand sidebar (⌘B)" />;
}

interface TopbarProps {
  chatOpen: boolean;
  onToggleChat: () => void;
  onOpenCommand: () => void;
}

export function Topbar({ chatOpen, onToggleChat, onOpenCommand }: TopbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { isSplit, splitPane, unsplitPane, openFile, openFilePath } = useWorkspace();
  const graphIsActive = openFilePath === GRAPH_TAB_PATH;
  const [reverting, setReverting] = useState(false);

  const canRevert =
    openFilePath &&
    !openFilePath.startsWith("__") &&
    openFilePath.endsWith(".md");

  const handleRevert = async () => {
    if (!canRevert || reverting) return;
    setReverting(true);
    try {
      const { edits } = await getEditHistory(openFilePath);
      if (edits.length === 0) return;
      const latest = edits[edits.length - 1];
      await revertEdit(openFilePath, latest.id);
      window.dispatchEvent(
        new CustomEvent("digital-garden:note-reverted", { detail: { path: openFilePath } })
      );
    } finally {
      setReverting(false);
    }
  };

  return (
    <TopBarRegion>
      <div className="dg-topbar__nav">
        <div className="dg-topbar__brand">
          <Sprout size={16} className="dg-topbar__brand-icon" aria-hidden />
          <span>Digital Garden</span>
        </div>
        <SidebarExpandWhenCollapsed />
      </div>
      <div className="dg-topbar__actions">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenCommand}
          title="Search files (⌘K)"
        >
          <Search size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(graphIsActive && "bg-muted text-foreground")}
          onClick={() => openFile(GRAPH_TAB_PATH)}
          title="Open graph view"
        >
          <GitFork size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(isSplit && "bg-muted text-foreground")}
          onClick={() => (isSplit ? unsplitPane() : splitPane())}
          title={isSplit ? "Close split" : "Split editor"}
        >
          <Columns2 size={16} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(chatOpen && "bg-muted text-foreground")}
          onClick={onToggleChat}
          title={chatOpen ? "Close agent" : "Open agent"}
        >
          <Sparkles size={16} />
        </Button>
        {canRevert && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRevert}
            disabled={reverting}
            title="Undo last AI edit"
          >
            <Undo2 size={16} />
          </Button>
        )}
        <KeyboardShortcutsPopover />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {mounted && resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </Button>
      </div>
    </TopBarRegion>
  );
}
