"use client";

import { getMediaType, getAssetUrl } from "@/lib/media-utils";
import { ImageViewer } from "./image-viewer";
import { PdfViewer } from "./pdf-viewer";
import { AudioViewer } from "./audio-viewer";
import { VideoViewer } from "./video-viewer";
import { FileQuestion } from "lucide-react";

interface Props {
  filePath: string;
}

export function MediaViewer({ filePath }: Props) {
  const mediaType = getMediaType(filePath);
  const url = getAssetUrl(filePath);
  const name = filePath.split("/").pop() ?? filePath;

  if (mediaType === "image") return <ImageViewer url={url} name={name} />;
  if (mediaType === "pdf") return <PdfViewer url={url} name={name} />;
  if (mediaType === "audio") return <AudioViewer url={url} name={name} />;
  if (mediaType === "video") return <VideoViewer url={url} name={name} />;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground/50">
      <FileQuestion size={40} strokeWidth={1} />
      <p className="text-sm">Unsupported file type</p>
      <p className="text-xs opacity-60">{name}</p>
    </div>
  );
}
