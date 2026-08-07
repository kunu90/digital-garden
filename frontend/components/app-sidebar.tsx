"use client";

import { ArrowLeft } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const FileTree = dynamic(() => import("@/components/file-tree").then((m) => m.FileTree), {
  ssr: false,
});

function CollapseSidebarButton() {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      title="Collapse sidebar (⌘B)"
      className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <ArrowLeft size={16} className="shrink-0 opacity-80" aria-hidden />
      <span>Collapse sidebar</span>
    </button>
  );
}

export function AppSidebar() {
  return (
    <Sidebar
      collapsible="offcanvas"
      className={cn("dg-chrome-sidebar group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0")}
      aria-label="Notes sidebar"
    >
      <SidebarContent className="pt-1">
        <FileTree />
      </SidebarContent>
      <SidebarFooter className="border-t border-[var(--gl-border-color-subtle)] p-2">
        <CollapseSidebarButton />
      </SidebarFooter>
    </Sidebar>
  );
}
