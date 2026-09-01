"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Atlas page composition primitives.
 * Application chrome (sidebar + top bar) + up to three panels:
 * static (primary context), dynamic (optional supporting), AI (collapsible).
 */

export function SkipToMain({
  targetId = "dg-main",
  label = "Skip to main content",
}: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a href={`#${targetId}`} className="dg-skip-link">
      {label}
    </a>
  );
}

export function PageRoot({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("dg-page", className)} data-dg-layout="page" {...props}>
      {children}
    </div>
  );
}

/** Column that holds the workspace card (right of left sidebar). */
export function PageBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("dg-page-body", className)}
      data-dg-layout="page-body"
      {...props}
    >
      {children}
    </div>
  );
}

/** Column that holds the workspace card (right of left sidebar). */
export function ChromeMain({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("dg-chrome-main", className)}
      data-dg-layout="chrome-main"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Outer workspace chrome — 8px radius + border wrap tabs and writing surface.
 */
export function WorkspaceShell({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("dg-workspace-shell", className)}
      data-dg-layout="workspace-shell"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Inner writing surface — panels live here; shell owns border + radius.
 */
export function WorkspaceCard({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("dg-workspace-card", className)}
      data-dg-layout="workspace-card"
      {...props}
    >
      {children}
    </div>
  );
}

export function TopBarRegion({
  className,
  children,
  ...props
}: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("dg-topbar", className)}
      data-dg-layout="top-bar"
      aria-label="Top bar"
      {...props}
    >
      {children}
    </header>
  );
}

/** Panels layer — static / dynamic / AI. */
export const Panels = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(function Panels({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      id="dg-main"
      role="main"
      className={cn("dg-panels", className)}
      data-dg-layout="panels"
      tabIndex={-1}
      {...props}
    >
      {children}
    </div>
  );
});

type PanelKind = "static" | "dynamic" | "ai";

const PANEL_LABEL: Record<PanelKind, string> = {
  static: "Note panel",
  dynamic: "Details panel",
  ai: "Agent panel",
};

export function Panel({
  kind,
  className,
  style,
  children,
  label,
  ...props
}: React.ComponentProps<"section"> & {
  kind: PanelKind;
  label?: string;
}) {
  return (
    <section
      className={cn(
        "dg-panel",
        kind === "static" && "dg-panel--static",
        kind === "dynamic" && "dg-panel--dynamic",
        kind === "ai" && "dg-panel--ai",
        className
      )}
      data-dg-layout="panel"
      data-dg-panel={kind}
      aria-label={label ?? PANEL_LABEL[kind]}
      style={style}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelSplitter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      className={cn("dg-panel-splitter", className)}
      data-dg-layout="panel-splitter"
      {...props}
    />
  );
}

/** Presentational content container — use sparingly inside panels. */
export function ContentContainer({
  tone = "default",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  tone?: "default" | "subtle" | "strong" | "section" | "overlap";
}) {
  return (
    <div
      className={cn(`dg-container dg-container--${tone}`, className)}
      data-dg-layout="container"
      data-dg-container={tone}
      {...props}
    >
      {children}
    </div>
  );
}
