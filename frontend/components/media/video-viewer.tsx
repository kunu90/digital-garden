"use client";

interface Props {
  url: string;
  name: string;
}

export function VideoViewer({ url, name }: Props) {
  return (
    <div className="flex h-full flex-col dg-media-stage">
      <p className="shrink-0 truncate px-4 py-2 text-xs text-[var(--muted-foreground)]">{name}</p>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        controls
        src={url}
        className="min-h-0 w-full flex-1 object-contain"
      />
    </div>
  );
}
