"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGraph, sanitizeGraphData, API_BASE } from "@/lib/api";
import type { GraphData } from "@/types/notes";

export function useGraph(enabled: boolean) {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      const graphData = sanitizeGraphData(await getGraph());
      setData(graphData);
      setError(null);
    } catch {
      setError("Failed to load graph.");
    }
  }, []);

  // Debounced refresh — coalesce rapid file-change events
  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(fetchGraph, 600);
  }, [fetchGraph]);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }

    setLoading(true);
    fetchGraph().finally(() => setLoading(false));

    // Subscribe to vault file-change events to keep graph live
    const es = new EventSource(`${API_BASE}/vault/watch`);
    eventSourceRef.current = es;

    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as { type: string };
        if (msg.type === "file_changed") {
          scheduleRefresh();
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [enabled, fetchGraph, scheduleRefresh]);

  return { data, loading, error, refresh: fetchGraph };
}
