"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { Onboarding } from "@/components/onboarding";
import { EditorPane } from "@/components/editor-pane";
import { TabBar } from "@/components/tab-bar";
import { CommandCenter } from "@/components/command-center";
import { WorkspaceProvider, useWorkspace } from "@/context/workspace-context";
import { useVault } from "@/hooks/use-vault";
import { useLayoutTransition } from "@/hooks/use-layout-transition";
import { useMotionAccessibility } from "@/components/motion-provider";
import { CHAT_PANEL_WIDTH } from "@/lib/motion";
import {
  ChromeMain,
  PageBody,
  PageRoot,
  Panel,
  Panels,
  PanelSplitter,
  SkipToMain,
  WorkspaceCard,
  WorkspaceShell,
} from "@/components/layout/page-composition";

const ChatPanel = dynamic(
  () => import("@/components/chat/chat-panel").then((m) => m.ChatPanel),
  { ssr: false }
);

interface WorkspaceLayoutProps {
  chatOpen: boolean;
  commandOpen: boolean;
  onCloseCommand: () => void;
}

/**
 * Panels layer (Pajamas):
 * - static  → primary note / editor context
 * - dynamic → optional details (split editor)
 * - AI      → agent chat (collapsible)
 */
function WorkspaceLayout({ chatOpen, commandOpen, onCloseCommand }: WorkspaceLayoutProps) {
  const {
    panes,
    isSplit,
    splitRatio,
    activePaneIndex,
    openFile,
    closeTab,
    setActiveTab,
    setActivePaneIndex,
    setSplitRatio,
    openFilePath,
  } = useWorkspace();

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const layoutTransition = useLayoutTransition();
  const { reducedMotion } = useMotionAccessibility();

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = Math.min(0.85, Math.max(0.15, (ev.clientX - rect.left) / rect.width));
        setSplitRatio(ratio);
      };

      const onUp = () => {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [setSplitRatio]
  );

  const activeNote =
    openFilePath && !openFilePath.startsWith("__") ? openFilePath : undefined;

  const hasTabs = panes.some((p) => p.tabs.length > 0);

  const chromeTabs = hasTabs ? (
    <div className="dg-chrome-tabs">
      <TabBar
        tabs={panes[0].tabs}
        activeIndex={panes[0].activeIndex}
        onSelect={(path) => {
          setActiveTab(path, 0);
          setActivePaneIndex(0);
        }}
        onClose={(path) => closeTab(path, 0)}
      />
      {isSplit && panes[1] && panes[1].tabs.length > 0 && (
        <TabBar
          tabs={panes[1].tabs}
          activeIndex={panes[1].activeIndex}
          onSelect={(path) => {
            setActiveTab(path, 1);
            setActivePaneIndex(1);
          }}
          onClose={(path) => closeTab(path, 1)}
        />
      )}
    </div>
  ) : null;

  const staticPanel = (
    <Panel
      kind="static"
      style={isSplit ? { flex: "none", width: `${splitRatio * 100}%` } : undefined}
    >
      <EditorPane
        pane={panes[0]}
        isActive={activePaneIndex === 0}
        showTabBar={false}
        onFocus={() => setActivePaneIndex(0)}
        onSelect={(path) => {
          setActiveTab(path, 0);
          setActivePaneIndex(0);
        }}
        onClose={(path) => closeTab(path, 0)}
        onOpenFile={openFile}
      />
    </Panel>
  );

  const dynamicPanel =
    isSplit && panes[1] ? (
      <>
        <PanelSplitter onMouseDown={handleDragStart} />
        <Panel
          kind="dynamic"
          style={{ flex: "none", width: `${(1 - splitRatio) * 100}%` }}
        >
          <EditorPane
            pane={panes[1]}
            isActive={activePaneIndex === 1}
            showTabBar={false}
            onFocus={() => setActivePaneIndex(1)}
            onSelect={(path) => {
              setActiveTab(path, 1);
              setActivePaneIndex(1);
            }}
            onClose={(path) => closeTab(path, 1)}
            onOpenFile={openFile}
          />
        </Panel>
      </>
    ) : null;

  const aiPanelInner = (
    <ChatPanel
      activeNotePath={activeNote}
      onFileEdit={(path) => openFile(path)}
    />
  );

  return (
    <>
      <WorkspaceShell>
        {chromeTabs}
        <WorkspaceCard>
          {reducedMotion ? (
            <Panels ref={containerRef}>
              {staticPanel}
              {dynamicPanel}
              {chatOpen && (
                <Panel kind="ai">{aiPanelInner}</Panel>
              )}
            </Panels>
          ) : (
            <LayoutGroup id="workspace-layout">
              <Panels ref={containerRef}>
                <motion.div
                  layout
                  transition={layoutTransition}
                  className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
                >
                  {staticPanel}
                  {dynamicPanel}
                </motion.div>

                <AnimatePresence initial={false} mode="popLayout">
                  {chatOpen && (
                    <motion.div
                      key="ai-panel"
                      layout
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: CHAT_PANEL_WIDTH, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={layoutTransition}
                      className="flex h-full shrink-0 flex-col overflow-hidden"
                    >
                      <Panel
                        kind="ai"
                        className="h-full !w-full !flex-none border-l-0"
                        style={{ width: "100%" }}
                      >
                        {aiPanelInner}
                      </Panel>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Panels>
            </LayoutGroup>
          )}
        </WorkspaceCard>
      </WorkspaceShell>

      <CommandCenter
        open={commandOpen}
        onClose={onCloseCommand}
        onOpenFile={(path) => {
          openFile(path);
        }}
      />
    </>
  );
}

function AppShell() {
  const { status, configure } = useVault();
  const [chatOpen, setChatOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !e.shiftKey && !e.defaultPrevented) {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  if (status === "loading") {
    return <div className="flex h-screen w-full items-center justify-center bg-background" />;
  }

  if (status === "unconfigured") {
    return <Onboarding onConfigure={configure} />;
  }

  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <PageRoot>
          <SkipToMain />
          <Topbar
            chatOpen={chatOpen}
            onToggleChat={() => setChatOpen((o) => !o)}
            onOpenCommand={() => setCommandOpen(true)}
          />
          <PageBody>
            <AppSidebar />
            <ChromeMain>
              <WorkspaceLayout
                chatOpen={chatOpen}
                commandOpen={commandOpen}
                onCloseCommand={() => setCommandOpen(false)}
              />
            </ChromeMain>
          </PageBody>
        </PageRoot>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}

export default function Home() {
  return <AppShell />;
}
