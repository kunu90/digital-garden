"use client";

import { useCallback, useEffect, useState } from "react";
import { getVaultPath, setVaultPath, API_BASE } from "@/lib/api";

export type VaultStatus = "loading" | "unconfigured" | "ready";

export function useVault() {
  const [status, setStatus] = useState<VaultStatus>("loading");

  useEffect(() => {
    getVaultPath()
      .then(({ path }) => setStatus(path ? "ready" : "unconfigured"))
      .catch(() => setStatus("unconfigured"));
  }, []);

  const configure = useCallback(async (path: string) => {
    const health = await fetch(`${API_BASE}/health`).catch(() => null);
    if (!health?.ok) {
      throw new Error("backend_down");
    }
    await setVaultPath(path);
    setStatus("ready");
  }, []);

  return { status, configure };
}
