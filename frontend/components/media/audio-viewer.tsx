"use client";

import { Music } from "lucide-react";

interface Props {
  url: string;
  name: string;
}

export function AudioViewer({ url, name }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-background p-12">
      <div className="flex flex-col items-center gap-4 text-muted-foreground/40">
        <Music size={56} strokeWidth={0.75} />
        <p className="max-w-xs truncate text-center text-sm font-medium text-muted-foreground">{name}</p>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        controls
        src={url}
        className="w-full max-w-md"
        style={{ accentColor: "var(--gl-color-blue-500)" }}
      />
    </div>
  );
}
