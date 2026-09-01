import {
  Extension,
  RangeSetBuilder,
  StateField,
  Transaction,
  Facet,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { getMediaType, getAssetUrl } from "./media-utils";

// Facet to pass the current note's folder (for resolving relative paths)
export const noteDirFacet = Facet.define<string, string>({
  combine: (values) => values[0] ?? "",
});

// Standard markdown: ![alt](path)  — used for images
const STD_IMAGE_RE = /!\[([^\]\n]*)\]\(([^)\n]+)\)/g;
// Obsidian embed: ![[filename.ext]]  — used for all media
const OBSIDIAN_EMBED_RE = /!\[\[([^\[\]\n]+)\]\]/g;

// ── Widgets ───────────────────────────────────────────────────────────────────

class ImageWidget extends WidgetType {
  constructor(readonly url: string, readonly name: string) {
    super();
  }
  eq(other: ImageWidget) { return other.url === this.url; }
  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-media-embed cm-media-embed--image";
    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.name;
    img.title = this.name;
    img.onerror = () => { img.replaceWith(errorNode(this.name)); };
    wrap.appendChild(img);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class AudioWidget extends WidgetType {
  constructor(readonly url: string, readonly name: string) {
    super();
  }
  eq(other: AudioWidget) { return other.url === this.url; }
  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-media-embed cm-media-embed--audio";
    const label = document.createElement("span");
    label.className = "cm-media-embed__label";
    label.textContent = this.name;
    const audio = document.createElement("audio");
    audio.src = this.url;
    audio.controls = true;
    wrap.appendChild(label);
    wrap.appendChild(audio);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class VideoWidget extends WidgetType {
  constructor(readonly url: string, readonly name: string) {
    super();
  }
  eq(other: VideoWidget) { return other.url === this.url; }
  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-media-embed cm-media-embed--video";
    const video = document.createElement("video");
    video.src = this.url;
    video.controls = true;
    wrap.appendChild(video);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class PdfWidget extends WidgetType {
  constructor(readonly url: string, readonly name: string) {
    super();
  }
  eq(other: PdfWidget) { return other.url === this.url; }
  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-media-embed cm-media-embed--pdf";
    const iframe = document.createElement("iframe");
    iframe.src = `${this.url}#navpanes=0`;
    iframe.title = this.name;
    iframe.className = "cm-media-pdf-iframe";
    wrap.appendChild(iframe);
    return wrap;
  }
  ignoreEvent() { return false; }
}

function errorNode(name: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-media-embed__error";
  span.textContent = `⚠ Could not load: ${name}`;
  return span;
}

// ── Path resolution ───────────────────────────────────────────────────────────

function resolveAssetUrl(rawPath: string, noteDir: string): string | null {
  // Already absolute URL
  if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
    return getMediaType(rawPath) ? rawPath : null;
  }
  // Resolve relative to the note's folder
  const resolved = noteDir ? `${noteDir}/${rawPath}` : rawPath;
  // Normalize: remove leading slash
  const clean = resolved.replace(/^\/+/, "");
  return getMediaType(clean) ? getAssetUrl(clean) : null;
}

// ── Decoration builder ────────────────────────────────────────────────────────

const syntaxMark = Decoration.mark({ class: "cm-media-syntax" });

function buildDecorations(doc: string, noteDir: string): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  type Entry =
    | { kind: "syntax"; from: number; to: number }
    | { kind: "widget"; pos: number; widget: WidgetType };
  const entries: Entry[] = [];

  const lines = doc.split("\n");
  let lineStart = 0;

  for (const line of lines) {
    // 1. Standard markdown images: ![alt](path)
    STD_IMAGE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STD_IMAGE_RE.exec(line)) !== null) {
      const rawPath = m[2].trim();
      const url = resolveAssetUrl(rawPath, noteDir);
      if (!url) continue;
      const name = rawPath.split("/").pop() ?? rawPath;
      const from = lineStart + m.index;
      const matchEnd = from + m[0].length;
      entries.push({ kind: "syntax", from, to: matchEnd });
      entries.push({ kind: "widget", pos: matchEnd, widget: new ImageWidget(url, name) });
    }

    // 2. Obsidian embeds: ![[filename.ext]]
    OBSIDIAN_EMBED_RE.lastIndex = 0;
    while ((m = OBSIDIAN_EMBED_RE.exec(line)) !== null) {
      const filename = m[1].trim();
      const mediaType = getMediaType(filename);
      if (!mediaType) continue;
      const url = getAssetUrl(filename);
      const from = lineStart + m.index;
      const matchEnd = from + m[0].length;
      let widget: WidgetType;
      if (mediaType === "image") widget = new ImageWidget(url, filename);
      else if (mediaType === "audio") widget = new AudioWidget(url, filename);
      else if (mediaType === "video") widget = new VideoWidget(url, filename);
      else widget = new PdfWidget(url, filename);
      entries.push({ kind: "syntax", from, to: matchEnd });
      entries.push({ kind: "widget", pos: matchEnd, widget });
    }

    lineStart += line.length + 1;
  }

  // Sort all entries by position
  entries.sort((a, b) => {
    const pa = a.kind === "syntax" ? a.from : a.pos;
    const pb = b.kind === "syntax" ? b.from : b.pos;
    return pa - pb;
  });

  for (const entry of entries) {
    if (entry.kind === "syntax") {
      builder.add(entry.from, entry.to, syntaxMark);
    } else {
      builder.add(entry.pos, entry.pos, Decoration.widget({ widget: entry.widget, block: true, side: 1 }));
    }
  }

  return builder.finish();
}

// ── State field ───────────────────────────────────────────────────────────────

const mediaEmbedField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state.doc.toString(), state.facet(noteDirFacet));
  },
  update(decos, tr: Transaction) {
    if (!tr.docChanged && !tr.reconfigured) return decos;
    return buildDecorations(tr.newDoc.toString(), tr.state.facet(noteDirFacet));
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Theme ─────────────────────────────────────────────────────────────────────

const mediaEmbedTheme = EditorView.baseTheme({
  // Neutralize any link/wikilink coloring on embed syntax lines
  ".cm-media-syntax, .cm-media-syntax *": {
    color: "var(--muted-foreground) !important",
    textDecoration: "none !important",
    background: "transparent !important",
    fontStyle: "normal !important",
  },
  ".cm-media-embed": {
    display: "block",
    margin: "8px 0 12px 0",
    borderRadius: "8px",
    overflow: "hidden",
  },
  ".cm-media-embed--image img": {
    display: "block",
    width: "100%",
    maxHeight: "480px",
    objectFit: "cover",
    borderRadius: "8px",
    boxShadow: "var(--shadow-md)",
  },
  ".cm-media-embed--audio": {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "10px 14px",
    background: "var(--muted)",
    borderRadius: "var(--radius)",
  },
  ".cm-media-embed__label": {
    fontSize: "0.75rem",
    color: "var(--muted-foreground)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-media-embed--audio audio": {
    width: "100%",
    height: "32px",
  },
  ".cm-media-embed--video video": {
    display: "block",
    width: "100%",
    maxHeight: "480px",
    borderRadius: "var(--radius)",
    background: "#0f131e",
  },
  ".cm-media-embed--pdf": {
    display: "block",
    borderRadius: "var(--radius)",
    overflow: "hidden",
    border: "1px solid var(--border)",
  },
  ".cm-media-pdf-iframe": {
    display: "block",
    width: "100%",
    height: "360px",
    border: "none",
  },
  ".cm-media-embed__error": {
    fontSize: "0.75rem",
    color: "var(--destructive)",
    padding: "6px 0",
    display: "block",
  },
});

// ── Public API ────────────────────────────────────────────────────────────────

export function mediaEmbedExtension(noteDir: string): Extension {
  return [noteDirFacet.of(noteDir), mediaEmbedField, mediaEmbedTheme];
}
