"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";

interface Props {
  url: string;
  name: string;
}

export function ImageViewer({ url, name }: Props) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground/50">
        Failed to load image: {name}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden dg-media-stage">
      {/* Toolbar */}
      <div className="dg-media-toolbar">
        <span className="flex-1 truncate text-xs text-muted-foreground">{name}</span>
        <button
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.25).toFixed(2)))}
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <span className="min-w-[40px] text-center text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setZoom((z) => Math.min(8, +(z + 0.25).toFixed(2)))}
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="ml-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          title="Rotate"
        >
          <RotateCw size={14} />
        </button>
        <button
          className="ml-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setZoom(1)}
          title="Reset zoom"
        >
          Reset
        </button>
      </div>

      {/* Image area */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name}
          onError={() => setError(true)}
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "center",
            transition: "transform 0.15s ease",
            maxWidth: zoom <= 1 ? "100%" : "none",
            maxHeight: zoom <= 1 ? "100%" : "none",
          }}
          className="rounded shadow-2xl"
          draggable={false}
        />
      </div>
    </div>
  );
}
