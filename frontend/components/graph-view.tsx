"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { GraphData, GraphNode } from "@/types/notes";
import {
  GRAPH_NODE_COLOR_DURATION,
  GRAPH_PAN_DECAY,
  GRAPH_THROW_VELOCITY_SCALE,
} from "@/lib/motion";
import { useMotionAccessibility } from "@/components/motion-provider";
import {
  approachOklch,
  formatOklch,
  parseOklch,
  type Oklch,
} from "@/lib/oklch";

// ── Physics simulation ────────────────────────────────────────────────────

type PhysNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
  pinned?: boolean; // dragged nodes freeze physics
};

function buildPhysNodes(nodes: GraphNode[], edges: GraphData["edges"]): PhysNode[] {
  const degreeMap = new Map<string, number>();
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }
  const golden = Math.PI * (3 - Math.sqrt(5));
  return nodes.map((n, i) => {
    const r = 80 * Math.sqrt(i / Math.max(nodes.length, 1));
    const angle = i * golden;
    return { ...n, x: r * Math.cos(angle), y: r * Math.sin(angle), vx: 0, vy: 0, degree: degreeMap.get(n.id) ?? 0 };
  });
}

function tickPhysics(nodes: PhysNode[], edges: GraphData["edges"], alpha: number) {
  const map = new Map(nodes.map((n) => [n.id, n]));
  const REPULSION = 3200, SPRING_LEN = 90, SPRING_K = 0.04, GRAVITY = 0.012, DAMPING = 0.86;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist2 = dx * dx + dy * dy + 1, dist = Math.sqrt(dist2);
      const force = (REPULSION * alpha) / dist2;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
      if (!b.pinned) { b.vx += fx; b.vy += fy; }
    }
  }

  for (const edge of edges) {
    const a = map.get(edge.source), b = map.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const force = (dist - SPRING_LEN) * SPRING_K * alpha;
    const fx = (dx / dist) * force, fy = (dy / dist) * force;
    if (!a.pinned) { a.vx += fx; a.vy += fy; }
    if (!b.pinned) { b.vx -= fx; b.vy -= fy; }
  }

  for (const n of nodes) {
    if (n.pinned) continue;
    n.vx -= n.x * GRAVITY * alpha;
    n.vy -= n.y * GRAVITY * alpha;
    n.vx *= DAMPING; n.vy *= DAMPING;
    n.x += n.vx; n.y += n.vy;
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────

type Theme = {
  bg: string; edge: string; edgeHighlight: string;
  nodeExists: string; nodeGhost: string; nodeActive: string; nodeHover: string; nodeDrag: string; nodeSearch: string;
  label: string; labelGhost: string; labelBg: string;
  overlay: string; overlayText: string;
};

/** Pajamas-aligned palette (oklch of --gl-color-* for canvas animation). */
const DARK_THEME: Theme = {
  bg: "oklch(0.208 0.012 293.0)", // neutral-950
  edge: "oklch(0.412 0.105 295.1 / 0.65)", // #503D7D
  edgeHighlight: "oklch(0.893 0.071 311.1)", // #EBCFFF — matches hover node
  nodeExists: "oklch(0.412 0.105 295.1)", // #503D7D — default note
  nodeGhost: "oklch(0.345 0.012 298.8)", // neutral-800
  nodeActive: "oklch(0.565 0.130 61.8)", // orange-500
  nodeHover: "oklch(0.893 0.071 311.1)", // #EBCFFF — hover
  nodeDrag: "oklch(0.557 0.176 293.4)", // purple-500
  nodeSearch: "oklch(0.543 0.134 153.2)", // green-500
  label: "oklch(0.944 0.004 286.3)", // neutral-50
  labelGhost: "oklch(0.629 0.007 295.4)", // neutral-400
  labelBg: "oklch(0.208 0.012 293.0 / 0.75)",
  overlay: "oklch(0.276 0.011 293.3 / 0.7)", // neutral-900
  overlayText: "oklch(0.629 0.007 295.4)",
};

const LIGHT_THEME: Theme = {
  bg: "oklch(0.987 0.004 301.4)", // neutral-10
  edge: "oklch(0.412 0.105 295.1 / 0.40)", // #503D7D — softer so thicker lines don’t dominate
  edgeHighlight: "oklch(0.893 0.071 311.1)", // #EBCFFF — matches hover node
  nodeExists: "oklch(0.412 0.105 295.1)", // #503D7D — default note
  nodeGhost: "oklch(0.806 0.006 286.3)", // neutral-200
  nodeActive: "oklch(0.565 0.130 61.8)", // orange-500
  nodeHover: "oklch(0.893 0.071 311.1)", // #EBCFFF — hover
  nodeDrag: "oklch(0.557 0.176 293.4)", // purple-500
  nodeSearch: "oklch(0.543 0.134 153.2)", // green-500
  label: "oklch(0.345 0.012 298.8)", // neutral-800
  labelGhost: "oklch(0.496 0.011 292.6)", // neutral-600
  labelBg: "oklch(1.000 0.000 89.9 / 0.80)", // neutral-0
  overlay: "oklch(0.987 0.004 301.4 / 0.7)",
  overlayText: "oklch(0.496 0.011 292.6)",
};

function nodeRadius(n: PhysNode): number {
  return Math.max(5, Math.min(18, 5 + n.degree * 2.0));
}

function resolveNodeTargetColor(
  n: PhysNode,
  theme: Theme,
  hoverId: string | null,
  activeId: string | null,
  dragId: string | null,
  searchIds: Set<string> | null,
): string {
  const hasSearch = searchIds !== null && searchIds.size > 0;
  const isInSearch = hasSearch && searchIds!.has(n.id);

  if (n.id === dragId) return theme.nodeDrag;
  if (n.id === activeId) return theme.nodeActive;
  if (isInSearch) return theme.nodeSearch;
  if (n.id === hoverId) return theme.nodeHover;
  if (n.exists) return theme.nodeExists;
  return theme.nodeGhost;
}

function updateNodeColorStates(
  nodes: PhysNode[],
  theme: Theme,
  colorStates: Map<string, Oklch>,
  hoverId: string | null,
  activeId: string | null,
  dragId: string | null,
  searchIds: Set<string> | null,
  dtSeconds: number,
  colorDurationSeconds: number,
) {
  for (const n of nodes) {
    const targetStr = resolveNodeTargetColor(n, theme, hoverId, activeId, dragId, searchIds);
    const target = parseOklch(targetStr);
    if (!target) continue;

    const current = colorStates.get(n.id) ?? target;
    colorStates.set(
      n.id,
      approachOklch(current, target, dtSeconds, colorDurationSeconds),
    );
  }
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, dpr: number,
  nodes: PhysNode[], edges: GraphData["edges"],
  theme: Theme, scale: number, offsetX: number, offsetY: number,
  hoverId: string | null, activeId: string | null,
  dragId: string | null, searchIds: Set<string> | null,
  showAllLabels: boolean,
  nodeColors: Map<string, Oklch>,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);

  const map = new Map(nodes.map((n) => [n.id, n]));
  const toCanvas = (wx: number, wy: number) => ({ x: wx * scale + offsetX, y: wy * scale + offsetY });

  const hasSearch = searchIds !== null && searchIds.size > 0;

  // Collect edge sets for hover highlight
  const hoverEdgeNodeIds = new Set<string>();
  if (hoverId) {
    for (const e of edges) {
      if (e.source === hoverId || e.target === hoverId) {
        hoverEdgeNodeIds.add(e.source);
        hoverEdgeNodeIds.add(e.target);
      }
    }
  }

  // Edges
  for (const edge of edges) {
    const a = map.get(edge.source), b = map.get(edge.target);
    if (!a || !b) continue;
    const ca = toCanvas(a.x, a.y), cb = toCanvas(b.x, b.y);
    const isConnectedToHover = hoverId && (edge.source === hoverId || edge.target === hoverId);
    const isConnectedToSearch = hasSearch && (searchIds!.has(edge.source) || searchIds!.has(edge.target));

    ctx.beginPath();
    ctx.moveTo(ca.x, ca.y);
    ctx.lineTo(cb.x, cb.y);

    if (isConnectedToHover) {
      ctx.strokeStyle = theme.edgeHighlight;
      ctx.lineWidth = 3;
    } else if (hasSearch && isConnectedToSearch) {
      ctx.strokeStyle = theme.edgeHighlight;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.7;
    } else if (hasSearch) {
      ctx.strokeStyle = theme.edge;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.25;
    } else {
      ctx.strokeStyle = theme.edge;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1;
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Nodes + labels
  for (const n of nodes) {
    const r = nodeRadius(n);
    const pos = toCanvas(n.x, n.y);
    const isHovered = n.id === hoverId;
    const isActive = n.id === activeId;
    const isDragging = n.id === dragId;
    const isInSearch = hasSearch && searchIds!.has(n.id);
    const isSearchDimmed = hasSearch && !isInSearch;

    const targetColor = resolveNodeTargetColor(
      n, theme, hoverId, activeId, dragId, searchIds,
    );
    const parsedTarget = parseOklch(targetColor);
    const displayColor = nodeColors.get(n.id) ?? parsedTarget ?? { l: 0.5, c: 0, h: 0, a: 1 };

    ctx.globalAlpha = isSearchDimmed ? 0.2 : 1;

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = formatOklch(displayColor);
    ctx.fill();

    // Pinned indicator ring
    if (n.pinned && !isDragging) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = theme.nodeDrag;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = isSearchDimmed ? 0.2 : 1;
    }

    ctx.globalAlpha = 1;

    // Labels
    const showLabel = isActive || isHovered || isDragging || isInSearch || (showAllLabels && n.exists) || (n.exists && scale > 0.8);
    if (showLabel) {
      const label = n.label.length > 24 ? n.label.slice(0, 22) + "…" : n.label;
      ctx.font = `${Math.max(10, Math.min(13, 10 + scale * 2))}px ui-monospace, monospace`;
      const metrics = ctx.measureText(label);
      const lx = pos.x, ly = pos.y - r - 5;
      const pad = 4;

      ctx.globalAlpha = isSearchDimmed ? 0.2 : (isHovered || isActive || isDragging || isInSearch) ? 1 : 0.85;

      // Label background pill
      ctx.fillStyle = theme.labelBg;
      const lh = 14;
      ctx.beginPath();
      const rx2 = lx - metrics.width / 2 - pad;
      const ry2 = ly - lh;
      const rw2 = metrics.width + pad * 2;
      const rh2 = lh;
      const cr = 3;
      ctx.roundRect(rx2, ry2, rw2, rh2, cr);
      ctx.fill();

      ctx.fillStyle = n.exists ? theme.label : theme.labelGhost;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, lx, ly);
      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = 1;
    }
  }
}

// ── Component ─────────────────────────────────────────────────────────────

type Props = {
  data: GraphData | null;
  loading: boolean;
  error: string | null;
  activeFilePath: string | null;
  onNodeClick: (node: GraphNode) => void;
};

export function GraphView({ data, loading, error, activeFilePath, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { reducedMotion } = useMotionAccessibility();
  const reducedMotionRef = useRef(reducedMotion);

  // Physics
  const nodesRef = useRef<PhysNode[]>([]);
  const alphaRef = useRef(1.0);

  // Canvas size
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // Camera
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });

  // Interaction state (mutable refs to avoid re-renders in hot path)
  const hoverIdRef = useRef<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Drag
  const dragNodeRef = useRef<PhysNode | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const themeRef = useRef<Theme>(isDark ? DARK_THEME : LIGHT_THEME);
  useEffect(() => { themeRef.current = isDark ? DARK_THEME : LIGHT_THEME; }, [isDark]);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);

  const activeId = useMemo(() => {
    if (!activeFilePath || !data) return null;
    return data.nodes.find((n) => n.path === activeFilePath)?.id ?? null;
  }, [activeFilePath, data]);
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Search matching
  const searchIds = useMemo((): Set<string> | null => {
    if (!searchQuery.trim() || !data) return null;
    const q = searchQuery.toLowerCase();
    const ids = new Set<string>();
    for (const n of data.nodes) {
      if (n.label.toLowerCase().includes(q)) ids.add(n.id);
    }
    return ids;
  }, [searchQuery, data]);
  const searchIdsRef = useRef(searchIds);
  useEffect(() => { searchIdsRef.current = searchIds; }, [searchIds]);

  const showAllLabelsRef = useRef(showAllLabels);
  useEffect(() => { showAllLabelsRef.current = showAllLabels; }, [showAllLabels]);

  const dragIdRef = useRef<string | null>(null);
  const dragGrabOffsetRef = useRef({ dx: 0, dy: 0 });
  const lastDragSampleRef = useRef({ x: 0, y: 0, t: 0 });
  const throwVelocityRef = useRef({ vx: 0, vy: 0 });
  const panVelocityRef = useRef({ vx: 0, vy: 0 });
  const nodeColorStatesRef = useRef(new Map<string, Oklch>());
  const lastFrameTimeRef = useRef(performance.now());
  const didDragRef = useRef(false);

  // Rebuild physics on data change
  useEffect(() => {
    if (!data) { nodesRef.current = []; nodeColorStatesRef.current.clear(); return; }
    nodesRef.current = buildPhysNodes(data.nodes, data.edges);
    nodeColorStatesRef.current.clear();
    alphaRef.current = 1.0;
    for (let i = 0; i < 60; i++) {
      tickPhysics(nodesRef.current, data.edges, alphaRef.current);
      alphaRef.current *= 0.985;
    }
  }, [data]);

  // Canvas sizing
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w === 0 || h === 0) return;
      const prev = sizeRef.current;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      sizeRef.current = { w, h, dpr };
      if (prev.w === 0 || prev.h === 0) {
        offsetRef.current = { x: w / 2, y: h / 2 };
        scaleRef.current = 1;
      } else {
        offsetRef.current = { x: offsetRef.current.x + (w - prev.w) / 2, y: offsetRef.current.y + (h - prev.h) / 2 };
      }
    };
    applySize();
    const ro = new ResizeObserver(applySize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const dtSeconds = Math.min((now - lastFrameTimeRef.current) / 1000, 0.05);
      lastFrameTimeRef.current = now;

      let { w, h, dpr } = sizeRef.current;
      if ((w === 0 || h === 0) && canvas.clientWidth > 0) {
        dpr = window.devicePixelRatio || 1;
        w = canvas.clientWidth; h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        sizeRef.current = { w, h, dpr };
        offsetRef.current = { x: w / 2, y: h / 2 };
      }
      if (w === 0 || h === 0) { requestAnimationFrame(loop); return; }

      // Pan throw momentum — skip when reduced motion is preferred
      if (!isPanningRef.current && !reducedMotionRef.current) {
        panVelocityRef.current.vx *= GRAPH_PAN_DECAY;
        panVelocityRef.current.vy *= GRAPH_PAN_DECAY;
        if (Math.abs(panVelocityRef.current.vx) > 0.05 || Math.abs(panVelocityRef.current.vy) > 0.05) {
          offsetRef.current = {
            x: offsetRef.current.x + panVelocityRef.current.vx,
            y: offsetRef.current.y + panVelocityRef.current.vy,
          };
        } else {
          panVelocityRef.current.vx = 0;
          panVelocityRef.current.vy = 0;
        }
      }

      if (data && nodesRef.current.length > 0) {
        updateNodeColorStates(
          nodesRef.current,
          themeRef.current,
          nodeColorStatesRef.current,
          hoverIdRef.current,
          activeIdRef.current,
          dragIdRef.current,
          searchIdsRef.current,
          dtSeconds,
          reducedMotionRef.current ? 0 : GRAPH_NODE_COLOR_DURATION,
        );

        if (alphaRef.current > 0.005) {
          tickPhysics(nodesRef.current, data.edges, alphaRef.current);
          alphaRef.current *= 0.985;
        }

        drawGraph(
          ctx, w, h, dpr, nodesRef.current, data.edges,
          themeRef.current, scaleRef.current, offsetRef.current.x, offsetRef.current.y,
          hoverIdRef.current, activeIdRef.current,
          dragIdRef.current, searchIdsRef.current, showAllLabelsRef.current,
          nodeColorStatesRef.current,
        );
      } else if (w > 0 && h > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
      }
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
    return () => { running = false; };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hit test
  const hitTest = useCallback((cx: number, cy: number): PhysNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    const wx = (x - offsetRef.current.x) / scaleRef.current;
    const wy = (y - offsetRef.current.y) / scaleRef.current;
    let best: PhysNode | null = null, bestDist = Infinity;
    for (const n of nodesRef.current) {
      const hitR = nodeRadius(n) + 6;
      const dx = wx - n.x, dy = wy - n.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < hitR && d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  }, []);

  const worldFromClient = useCallback((cx: number, cy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      wx: (cx - rect.left - offsetRef.current.x) / scaleRef.current,
      wy: (cy - rect.top - offsetRef.current.y) / scaleRef.current,
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragNodeRef.current) {
      const { wx, wy } = worldFromClient(e.clientX, e.clientY);
      const node = dragNodeRef.current;
      const newX = wx + dragGrabOffsetRef.current.dx;
      const newY = wy + dragGrabOffsetRef.current.dy;
      const now = performance.now();
      const dt = (now - lastDragSampleRef.current.t) / 1000;

      if (dt > 0) {
        throwVelocityRef.current = {
          vx: (newX - lastDragSampleRef.current.x) / dt,
          vy: (newY - lastDragSampleRef.current.y) / dt,
        };
      }

      if (
        Math.abs(newX - node.x) > 0.5 ||
        Math.abs(newY - node.y) > 0.5
      ) {
        didDragRef.current = true;
      }

      node.x = newX;
      node.y = newY;
      lastDragSampleRef.current = { x: newX, y: newY, t: now };
      alphaRef.current = Math.max(alphaRef.current, 0.3);
      return;
    }

    if (isPanningRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      offsetRef.current = {
        x: offsetRef.current.x + dx,
        y: offsetRef.current.y + dy,
      };
      panVelocityRef.current = reducedMotionRef.current
        ? { vx: 0, vy: 0 }
        : { vx: dx, vy: dy };
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const node = hitTest(e.clientX, e.clientY);
    const id = node?.id ?? null;
    if (id !== hoverIdRef.current) {
      hoverIdRef.current = id;
      setHoverId(id);
    }
  }, [hitTest, worldFromClient]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    didDragRef.current = false;
    const node = hitTest(e.clientX, e.clientY);
    if (node) {
      const { wx, wy } = worldFromClient(e.clientX, e.clientY);
      dragGrabOffsetRef.current = { dx: node.x - wx, dy: node.y - wy };
      lastDragSampleRef.current = { x: node.x, y: node.y, t: performance.now() };
      throwVelocityRef.current = { vx: 0, vy: 0 };
      node.pinned = false;
      dragNodeRef.current = node;
      dragIdRef.current = node.id;
      setDragId(node.id);
    } else {
      isPanningRef.current = true;
      panVelocityRef.current = { vx: 0, vy: 0 };
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [hitTest, worldFromClient]);

  const releaseDraggedNode = useCallback(() => {
    const node = dragNodeRef.current;
    if (node) {
      if (!reducedMotionRef.current) {
        node.vx = throwVelocityRef.current.vx * GRAPH_THROW_VELOCITY_SCALE;
        node.vy = throwVelocityRef.current.vy * GRAPH_THROW_VELOCITY_SCALE;
      } else {
        node.vx = 0;
        node.vy = 0;
      }
      node.pinned = false;
      alphaRef.current = Math.max(alphaRef.current, 0.45);
    }
    dragNodeRef.current = null;
    dragIdRef.current = null;
    setDragId(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (dragNodeRef.current) releaseDraggedNode();
    if (reducedMotionRef.current) {
      panVelocityRef.current = { vx: 0, vy: 0 };
    }
    isPanningRef.current = false;
  }, [releaseDraggedNode]);

  const handleMouseLeave = useCallback(() => {
    if (dragNodeRef.current) releaseDraggedNode();
    if (reducedMotionRef.current) {
      panVelocityRef.current = { vx: 0, vy: 0 };
    }
    isPanningRef.current = false;
    hoverIdRef.current = null;
    setHoverId(null);
  }, [releaseDraggedNode]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) return;
    const node = hitTest(e.clientX, e.clientY);
    if (node?.exists && node.path) onNodeClick(node);
  }, [hitTest, onNodeClick]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(5, Math.max(0.1, scaleRef.current * factor));
    offsetRef.current = {
      x: mx - (mx - offsetRef.current.x) * (newScale / scaleRef.current),
      y: my - (my - offsetRef.current.y) * (newScale / scaleRef.current),
    };
    scaleRef.current = newScale;
  }, []);

  // Double-click to unpin a node
  const handleDblClick = useCallback((e: React.MouseEvent) => {
    const node = hitTest(e.clientX, e.clientY);
    if (node) {
      node.pinned = !node.pinned;
      if (!node.pinned) {
        node.vx = 0;
        node.vy = 0;
      }
      alphaRef.current = Math.max(alphaRef.current, 0.3);
    }
  }, [hitTest]);

  // Controls
  const zoomIn = useCallback(() => {
    const { w, h } = sizeRef.current;
    const mx = w / 2, my = h / 2;
    const newScale = Math.min(5, scaleRef.current * 1.25);
    offsetRef.current = { x: mx - (mx - offsetRef.current.x) * (newScale / scaleRef.current), y: my - (my - offsetRef.current.y) * (newScale / scaleRef.current) };
    scaleRef.current = newScale;
  }, []);

  const zoomOut = useCallback(() => {
    const { w, h } = sizeRef.current;
    const mx = w / 2, my = h / 2;
    const newScale = Math.max(0.1, scaleRef.current * 0.8);
    offsetRef.current = { x: mx - (mx - offsetRef.current.x) * (newScale / scaleRef.current), y: my - (my - offsetRef.current.y) * (newScale / scaleRef.current) };
    scaleRef.current = newScale;
  }, []);

  const resetView = useCallback(() => {
    const { w, h } = sizeRef.current;
    offsetRef.current = { x: w / 2, y: h / 2 };
    scaleRef.current = 1;
  }, []);

  const unpinAll = useCallback(() => {
    nodesRef.current.forEach((n) => { n.pinned = false; });
    alphaRef.current = Math.max(alphaRef.current, 0.5);
  }, []);

  const toggleSearch = useCallback(() => {
    setShowSearch((s) => {
      if (!s) setTimeout(() => searchInputRef.current?.focus(), 50);
      else setSearchQuery("");
      return !s;
    });
  }, []);

  const hoverNode = hoverId ? nodesRef.current.find((n) => n.id === hoverId) : null;
  const searchMatchCount = searchIds?.size ?? 0;

  // ── UI states ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground px-4 text-center">{error}</div>;
  }
  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
        <p className="text-sm">No notes yet.</p>
        <p className="text-xs opacity-60">Use <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{"[[Note Name]]"}</code> to link notes.</p>
      </div>
    );
  }

  const cursor = dragId ? "grabbing" : hoverId ? "pointer" : isPanningRef.current ? "grabbing" : "grab";

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="h-full w-full block"
        style={{ cursor }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
        onWheel={handleWheel}
        onMouseLeave={handleMouseLeave}
      />

      {/* Search bar */}
      {showSearch && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-[var(--gl-border-radius-default)] border border-[var(--gl-border-color-strong)] bg-[var(--gl-background-color-overlap)] px-3 py-1.5 shadow-md w-56">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 text-muted-foreground">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") toggleSearch(); }}
            placeholder="Filter nodes…"
            className="flex-1 bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground/50"
          />
          {searchQuery && (
            <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
              {searchMatchCount}
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {/* Search toggle */}
        <button
          onClick={toggleSearch}
          title="Search nodes (F)"
          className={`flex h-6 w-6 items-center justify-center rounded-[var(--gl-border-radius-sm)] border text-[10px] transition-colors ${
            showSearch
              ? "border-[var(--gl-border-color-default)] bg-[var(--gl-background-color-strong)] text-foreground"
              : "border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-overlap)] text-muted-foreground hover:bg-[var(--gl-background-color-strong)] hover:text-foreground"
          }`}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Labels toggle */}
        <button
          onClick={() => setShowAllLabels((s) => !s)}
          title="Toggle all labels"
          className={`flex h-6 w-6 items-center justify-center rounded-[var(--gl-border-radius-sm)] border text-[10px] font-mono transition-colors ${
            showAllLabels
              ? "border-[var(--gl-border-color-default)] bg-[var(--gl-background-color-strong)] text-foreground"
              : "border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-overlap)] text-muted-foreground hover:bg-[var(--gl-background-color-strong)] hover:text-foreground"
          }`}
        >
          T
        </button>

        <div className="my-0.5 border-t border-[var(--gl-border-color-subtle)]" />

        {/* Zoom in */}
        <button onClick={zoomIn} title="Zoom in"
          className="flex h-6 w-6 items-center justify-center rounded-[var(--gl-border-radius-sm)] border border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-overlap)] text-muted-foreground hover:bg-[var(--gl-background-color-strong)] hover:text-foreground transition-colors text-sm font-light">
          +
        </button>
        {/* Zoom out */}
        <button onClick={zoomOut} title="Zoom out"
          className="flex h-6 w-6 items-center justify-center rounded-[var(--gl-border-radius-sm)] border border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-overlap)] text-muted-foreground hover:bg-[var(--gl-background-color-strong)] hover:text-foreground transition-colors text-sm font-light">
          −
        </button>
        {/* Reset view */}
        <button onClick={resetView} title="Reset view"
          className="flex h-6 w-6 items-center justify-center rounded-[var(--gl-border-radius-sm)] border border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-overlap)] text-muted-foreground hover:bg-[var(--gl-background-color-strong)] hover:text-foreground transition-colors">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6a4 4 0 1 1 1 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M2 9V6h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="my-0.5 border-t border-[var(--gl-border-color-subtle)]" />

        {/* Unpin all */}
        <button onClick={unpinAll} title="Release pinned nodes"
          className="flex h-6 w-6 items-center justify-center rounded-[var(--gl-border-radius-sm)] border border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-overlap)] text-muted-foreground hover:bg-[var(--gl-background-color-strong)] hover:text-foreground transition-colors">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M6 4v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Hover tooltip */}
      {hoverNode && !dragId && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--gl-border-radius-default)] border border-[var(--gl-border-color-strong)] bg-[var(--gl-background-color-overlap)] px-3 py-1 text-xs font-mono text-foreground shadow-sm">
          {hoverNode.label}
        </div>
      )}

      {/* Drag hint */}
      {dragId && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--gl-border-radius-default)] border border-[var(--gl-border-color-subtle)] bg-[var(--gl-background-color-overlap)] px-3 py-1 text-xs font-mono text-muted-foreground shadow-sm">
          drag to throw · double-click to pin
        </div>
      )}

      {/* Stats */}
      <div className="pointer-events-none absolute bottom-2 right-2.5 flex items-center gap-2.5 font-mono text-[10px] text-muted-foreground/50">
        <span>{data.nodes.length} notes</span>
        <span>{data.edges.length} links</span>
      </div>
    </div>
  );
}
