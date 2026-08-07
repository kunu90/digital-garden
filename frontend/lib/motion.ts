import type { Transition } from "framer-motion";

/** Critically damped layout spring — Component 1 (chat sidebar push). */
export const LAYOUT_SPRING: Transition = {
  type: "spring",
  bounce: 0,
  duration: 0.4,
};

/** Snappy vertical drop — Component 2 (command palette). */
export const COMMAND_PALETTE_SPRING: Transition = {
  type: "spring",
  bounce: 0.12,
  duration: 0.25,
};

export const COMMAND_PALETTE_OFFSET_Y = -100;

/** Node color state transitions — Component 3 (graph canvas). */
export const GRAPH_NODE_COLOR_DURATION = 0.35;

/** Opacity-only cross-fade when prefers-reduced-motion is active. */
export const FADE_TRANSITION: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

export const CHAT_PANEL_WIDTH = 360;

/** CSS length for AI panel — keep in sync with --dg-ai-panel-width in layout.css */
export const CHAT_PANEL_WIDTH_CSS = "var(--dg-ai-panel-width)";

/** Exponential velocity decay for graph pan momentum. */
export const GRAPH_PAN_DECAY = 0.9;
export const GRAPH_THROW_VELOCITY_SCALE = 0.28;
