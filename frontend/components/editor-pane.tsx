"use client";

import dynamic from "next/dynamic";
import { TabBar } from "@/components/tab-bar";
import { GraphTab } from "@/components/graph-tab";
import { MediaViewer } from "@/components/media/media-viewer";
import { Icon } from "@/components/icon";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { GRAPH_TAB_PATH, type Pane } from "@/context/workspace-context";
import { isMediaPath } from "@/lib/media-utils";
import { BacklinksPanel } from "@/components/backlinks-panel";

const MarkdownEditor = dynamic(
  () => import("@/components/markdown-editor").then((m) => m.MarkdownEditor),
  { ssr: false }
);

type Props = {
  pane: Pane;
  isActive: boolean;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onFocus: () => void;
  onOpenFile?: (path: string) => void;
  /** When false, tabs render above the workspace card (Figma layout). */
  showTabBar?: boolean;
  style?: React.CSSProperties;
};

export function EditorPane({
  pane,
  isActive,
  onSelect,
  onClose,
  onFocus,
  onOpenFile,
  showTabBar = true,
  style,
}: Props) {
  const activePath = pane.tabs[pane.activeIndex] ?? null;

  return (
    <div
      className="flex min-w-0 flex-1 flex-col overflow-hidden"
      style={style}
      onClick={onFocus}
    >
      {showTabBar && (
        <TabBar
          tabs={pane.tabs}
          activeIndex={pane.activeIndex}
          onSelect={onSelect}
          onClose={onClose}
        />
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--editor-bg)]">
        {activePath === GRAPH_TAB_PATH ? (
          <GraphTab key="graph" />
        ) : activePath && isMediaPath(activePath) ? (
          <MediaViewer key={activePath} filePath={activePath} />
        ) : activePath ? (
          <div key={activePath} className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-hidden">
              <MarkdownEditor filePath={activePath} />
            </div>
            {activePath.endsWith(".md") && onOpenFile && (
              <BacklinksPanel notePath={activePath} onOpenFile={onOpenFile} />
            )}
          </div>
        ) : (
          <EmptyPane />
        )}
        {!isActive && pane.tabs.length > 0 && (
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-transparent" />
        )}
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <Empty className="h-full bg-[var(--editor-bg)] border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="description" size={16} />
        </EmptyMedia>
        <EmptyTitle>No file open</EmptyTitle>
        <EmptyDescription>Open a note from the sidebar</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
