"use client";

import { useState } from "react";
import { FolderOpen, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  onConfigure: (path: string) => Promise<void>;
};

export function Onboarding({ onConfigure }: Props) {
  const [path, setPath] = useState("~/vault");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!path.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onConfigure(path.trim());
    } catch (err) {
      if (err instanceof Error && err.message === "backend_down") {
        setError(
          "Backend is not running on port 8000. Start it with: cd backend && uv run uvicorn main:app --reload — or double-click Digital Garden.app to start both servers."
        );
      } else {
        setError("Failed to configure vault. Check the folder path and that the backend is running.");
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex max-w-sm flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Sprout className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to your Digital Garden</h1>
          <p className="text-sm text-muted-foreground">
            Choose a folder on your machine to store your notes.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
          <div className="flex gap-2">
            <FolderOpen className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="~/vault"
              disabled={loading}
              spellCheck={false}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !path.trim()} className="w-full">
            {loading ? "Setting up…" : "Open Vault"}
          </Button>
        </form>
      </div>
    </div>
  );
}
