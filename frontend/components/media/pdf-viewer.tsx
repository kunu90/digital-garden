"use client";

import { ExternalLink } from "lucide-react";

interface Props {
  url: string;
  name: string;
}

export function PdfViewer({ url, name }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="dg-media-toolbar">
        <span className="flex-1 truncate text-xs text-muted-foreground">{name}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ExternalLink size={12} />
          Open
        </a>
      </div>
      {/* Native browser PDF renderer */}
      <iframe
        src={`${url}#navpanes=0`}
        title={name}
        className="min-h-0 flex-1 w-full border-none"
      />
    </div>
  );
}
