"use client";

import { useCallback } from "react";
import { GraphView } from "@/components/graph-view";
import { useGraph } from "@/hooks/use-graph";
import { useWorkspace } from "@/context/workspace-context";
import type { GraphNode } from "@/types/notes";

export function GraphTab() {
  const { data, loading, error } = useGraph(true);
  const { openFilePath, openFile } = useWorkspace();

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.path) openFile(node.path);
    },
    [openFile]
  );

  return (
    <GraphView
      data={data}
      loading={loading}
      error={error}
      activeFilePath={openFilePath}
      onNodeClick={handleNodeClick}
    />
  );
}
