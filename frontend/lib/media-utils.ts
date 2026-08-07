import { API_BASE } from "@/lib/api";

const BASE = API_BASE;

export type MediaType = "image" | "pdf" | "audio" | "video";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp"]);
const PDF_EXTS = new Set([".pdf"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

export const ALL_MEDIA_EXTS = new Set([
  ...IMAGE_EXTS,
  ...PDF_EXTS,
  ...AUDIO_EXTS,
  ...VIDEO_EXTS,
]);

export function getExt(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

export function getMediaType(path: string): MediaType | null {
  const ext = getExt(path);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (PDF_EXTS.has(ext)) return "pdf";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  return null;
}

export function isMediaPath(path: string): boolean {
  return getMediaType(path) !== null;
}

export function getAssetUrl(path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${BASE}/vault/assets/${encoded}`;
}
