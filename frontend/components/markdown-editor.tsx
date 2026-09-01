"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, EditorSelection } from "@codemirror/state";
import { createNote, getNote, saveNote, uploadFile, API_BASE } from "@/lib/api";
import { useTheme } from "next-themes";
import { wikilinkExtension } from "@/lib/wikilink-extension";
import { tableExtension, tableInsertNew, type TableState } from "@/lib/table-extension";
import { tabCompletionExtension } from "@/lib/tab-completion-extension";
import { mediaEmbedExtension } from "@/lib/media-embed-extension";
import { ALL_MEDIA_EXTS, getExt, getMediaType } from "@/lib/media-utils";
import { useNotesList } from "@/hooks/use-notes-list";
import { useWorkspace } from "@/context/workspace-context";
import { InlineAIToolbar, type SelectionCoords } from "@/components/inline-ai-toolbar";
import { TableToolbar } from "@/components/table-toolbar";

// --- Structural theme (layout, spacing, cursor) — Atlas tokens ---

const lightStructure = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "1rem",
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.8", padding: "0 0 120px 0" },
  ".cm-content": { maxWidth: "680px", margin: "0 auto", padding: "48px 48px", caretColor: "var(--foreground)" },
  ".cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)", borderLeftWidth: "2px" },
  ".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent) !important" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--primary) 22%, transparent) !important" },
  ".cm-line": { padding: "0" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--foreground) 4%, transparent)", borderRadius: "3px" },
});

const darkStructure = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "1rem",
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
    backgroundColor: "transparent",
    color: "var(--foreground)",
  },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.8", padding: "0 0 120px 0" },
  ".cm-content": { maxWidth: "680px", margin: "0 auto", padding: "48px 48px", caretColor: "var(--foreground)" },
  ".cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--foreground)", borderLeftWidth: "2px" },
  ".cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent) !important" },
  "&.cm-focused .cm-selectionBackground": { backgroundColor: "color-mix(in srgb, var(--primary) 28%, transparent) !important" },
  ".cm-line": { padding: "0" },
  ".cm-gutters": { display: "none" },
  ".cm-activeLineGutter": { backgroundColor: "transparent" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--foreground) 4%, transparent)", borderRadius: "3px" },
});

// --- Syntax highlight styles (token colors) — Pajamas ---

const lightHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.75em", fontWeight: "800", color: "var(--foreground)", lineHeight: "1.3" },
  { tag: t.heading2, fontSize: "1.4em",  fontWeight: "700", color: "var(--foreground)" },
  { tag: t.heading3, fontSize: "1.18em", fontWeight: "700", color: "var(--foreground)" },
  { tag: t.heading4, fontSize: "1.05em", fontWeight: "700", color: "var(--foreground)" },
  { tag: t.strong, fontWeight: "700", color: "var(--foreground)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--muted-foreground)" },
  { tag: t.processingInstruction, color: "var(--muted-foreground)" },
  { tag: t.punctuation, color: "var(--muted-foreground)" },
  { tag: [t.meta, t.bracket], color: "var(--muted-foreground)" },
  { tag: t.link, color: "var(--primary)", textDecoration: "underline" },
  { tag: t.url, color: "var(--primary)" },
  { tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: t.monospace, fontFamily: "var(--font-mono, monospace)", color: "var(--primary-hover)", fontSize: "0.9em" },
  { tag: t.keyword, color: "var(--fresh)", fontWeight: "600" },
  { tag: t.number, color: "var(--primary-hover)" },
  { tag: t.string, color: "var(--success)" },
  { tag: t.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: t.variableName, color: "var(--primary-hover)" },
  { tag: t.function(t.variableName), color: "var(--primary)" },
  { tag: t.typeName, color: "var(--paused)" },
  { tag: t.operator, color: "var(--primary-hover)" },
  { tag: t.bool, color: "var(--fresh)" },
  { tag: t.null, color: "var(--fresh)" },
  { tag: t.atom, color: "var(--primary-hover)" },
]);

const darkHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.75em", fontWeight: "800", color: "var(--foreground)", lineHeight: "1.3" },
  { tag: t.heading2, fontSize: "1.4em",  fontWeight: "700", color: "var(--foreground)" },
  { tag: t.heading3, fontSize: "1.18em", fontWeight: "700", color: "var(--foreground)" },
  { tag: t.heading4, fontSize: "1.05em", fontWeight: "700", color: "var(--foreground)" },
  { tag: t.strong, fontWeight: "700", color: "var(--foreground)" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--muted-foreground)" },
  { tag: t.processingInstruction, color: "var(--muted-foreground)" },
  { tag: t.punctuation, color: "var(--muted-foreground)" },
  { tag: [t.meta, t.bracket], color: "var(--muted-foreground)" },
  { tag: t.link, color: "var(--primary)", textDecoration: "underline" },
  { tag: t.url, color: "var(--primary)" },
  { tag: t.quote, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: t.monospace, fontFamily: "var(--font-mono, monospace)", color: "var(--primary)", fontSize: "0.9em" },
  { tag: t.keyword, color: "var(--fresh)", fontWeight: "600" },
  { tag: t.number, color: "var(--primary)" },
  { tag: t.string, color: "var(--success)" },
  { tag: t.comment, color: "var(--muted-foreground)", fontStyle: "italic" },
  { tag: t.variableName, color: "var(--primary)" },
  { tag: t.function(t.variableName), color: "var(--primary)" },
  { tag: t.typeName, color: "var(--paused)" },
  { tag: t.operator, color: "var(--primary)" },
  { tag: t.bool, color: "var(--fresh)" },
  { tag: t.null, color: "var(--fresh)" },
  { tag: t.atom, color: "var(--primary)" },
]);

const baseExtensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
  EditorState.tabSize.of(2),
  EditorView.contentAttributes.of({ spellcheck: "true" }),
];

type Props = {
  filePath: string;
};

export function MarkdownEditor({ filePath }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const vaultNotes = useNotesList();
  const { openFile } = useWorkspace();
  const [content, setContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>("");
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [selectionCoords, setSelectionCoords] = useState<SelectionCoords | null>(null);
  const [tableState, setTableState] = useState<TableState | null>(null);
  const isAIEditing = useRef(false);
  // Tracks whether the toolbar is visible or loading — blocks new Cmd+K triggers
  const toolbarActiveRef = useRef(false);

  useEffect(() => {
    setContent(null);
    setLoadError(null);
    lastSaved.current = "";

    getNote(filePath)
      .then((note) => {
        setContent(note.content ?? "");
        lastSaved.current = note.content ?? "";
      })
      .catch(() => setLoadError("Failed to load note."));
  }, [filePath]);

  const handleChange = useCallback(
    (value: string) => {
      // Skip React state update when AI is dispatching to preserve CM undo history
      if (!isAIEditing.current) setContent(value);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        if (value !== lastSaved.current) {
          try {
            await saveNote(filePath, value);
            lastSaved.current = value;
          } catch {
            // silently retry on next change
          }
        }
      }, 800);
    },
    [filePath]
  );

  // Reload content when the file is externally modified (e.g. by the agent)
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/vault/watch`);
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as { type: string; path: string };
        if (msg.type === "file_changed" && msg.path === filePath && !saveTimer.current) {
          getNote(filePath).then((note) => {
            setContent(note.content ?? "");
            lastSaved.current = note.content ?? "";
          }).catch(() => {});
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [filePath]);

  useEffect(() => {
    const onReverted = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail.path !== filePath) return;
      getNote(filePath).then((note) => {
        setContent(note.content ?? "");
        lastSaved.current = note.content ?? "";
      }).catch(() => {});
    };
    window.addEventListener("digital-garden:note-reverted", onReverted);
    return () => window.removeEventListener("digital-garden:note-reverted", onReverted);
  }, [filePath]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const handleWikilinkNavigate = useCallback(
    async (noteName: string) => {
      // Try exact path match first, then stem match
      const exact = vaultNotes.find((p) => p === noteName || p === `${noteName}.md`);
      const stem = vaultNotes.find(
        (p) => p.replace(/\.md$/, "").split("/").pop()?.toLowerCase() === noteName.toLowerCase()
      );
      const target = exact ?? stem;
      if (target) {
        openFile(target);
      } else {
        // Create the note then open it
        const newPath = noteName.endsWith(".md") ? noteName : `${noteName}.md`;
        await createNote(newPath);
        openFile(newPath);
      }
    },
    [vaultNotes, openFile]
  );

  // Cmd+K triggers inline AI toolbar when selection exists;
  // returns false when no selection so the global handler opens command center.
  // Also blocked when toolbar is already active (loading or review).
  const showToolbarKeymap = useMemo(() => keymap.of([{
    key: "Mod-k",
    run: (view) => {
      // Don't interrupt an in-progress edit
      if (toolbarActiveRef.current) return true; // consume key, do nothing
      const sel = view.state.selection.main;
      if (sel.empty || view.state.doc.sliceString(sel.from, sel.to).trim().length < 3) return false;
      const fromCoords = view.coordsAtPos(sel.from);
      if (!fromCoords) return false;
      const toCoords = view.coordsAtPos(sel.to) ?? fromCoords;
      toolbarActiveRef.current = true;
      setSelectionCoords({
        from: sel.from, to: sel.to,
        text: view.state.doc.sliceString(sel.from, sel.to),
        top: fromCoords.top, bottom: toCoords.bottom,
        left: fromCoords.left, right: toCoords.right,
      });
      return true;
    },
  }]), []);

  const handleApply = useCallback(
    (from: number, to: number, result: string) => {
      const view = editorRef.current?.view;
      if (!view) return;
      isAIEditing.current = true;
      view.dispatch({
        changes: { from, to, insert: result },
        selection: EditorSelection.cursor(from + result.length),
      });
      isAIEditing.current = false;
      setContent(view.state.doc.toString());
      toolbarActiveRef.current = false;
      setSelectionCoords(null);
    },
    []
  );

  const handleDismiss = useCallback(() => {
    toolbarActiveRef.current = false;
    setSelectionCoords(null);
  }, []);

  // Rebuild wikilink extension when notes list or navigate fn changes
  const wikilinkExt = useMemo(
    () =>
      wikilinkExtension({
        vaultNotes,
        onNavigate: handleWikilinkNavigate,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vaultNotes]
  );

  const tableExt = useMemo(
    () => tableExtension({ onTableState: setTableState, isDark }),
    [isDark]
  );

  const insertTableKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-Shift-t",
          run: (view) => { tableInsertNew(view); return true; },
        },
      ]),
    []
  );

  const tabCompletionExt = useMemo(
    () => tabCompletionExtension(isDark),
    [isDark]
  );

  const noteDir = filePath.includes("/") ? filePath.split("/").slice(0, -1).join("/") : "";
  const mediaEmbedExt = useMemo(
    () => mediaEmbedExtension(noteDir),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [noteDir]
  );

  const extensions = [
    ...baseExtensions,
    syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
    wikilinkExt,
    ...tableExt,
    showToolbarKeymap,
    insertTableKeymap,
    tabCompletionExt,
    mediaEmbedExt,
  ];

  // Drag-and-drop media files from desktop into editor
  const [isDragOver, setIsDragOver] = useState(false);

  const handleEditorDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, []);

  const handleEditorDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleEditorDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        ALL_MEDIA_EXTS.has(getExt(f.name))
      );
      if (files.length === 0) return;

      const view = editorRef.current?.view;
      for (const file of files) {
        try {
          const { path } = await uploadFile(file, noteDir);
          const name = path.split("/").pop() ?? file.name;
          const mediaType = getMediaType(file.name);
          // Images use standard markdown; other media use Obsidian-style embed
          const embed = mediaType === "image"
            ? `![${name}](${name})`
            : `![[${name}]]`;
          if (view) {
            const pos = view.state.selection.main.head;
            view.dispatch({
              changes: { from: pos, insert: embed + "\n" },
              selection: { anchor: pos + embed.length + 1 },
            });
          }
        } catch {
          // silently skip failed uploads
        }
      }
    },
    [filePath]
  );

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {loadError}
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="h-full bg-[var(--editor-bg)]"
      style={{ position: "relative" }}
      onDragOver={handleEditorDragOver}
      onDragLeave={handleEditorDragLeave}
      onDrop={handleEditorDrop}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded border-2 border-dashed border-primary/50 bg-primary/5">
          <p className="text-sm text-primary/70">Drop to embed</p>
        </div>
      )}
      {selectionCoords && (
        <InlineAIToolbar
          selection={selectionCoords}
          onApply={handleApply}
          onDismiss={handleDismiss}
          onLoadingChange={(loading) => { toolbarActiveRef.current = loading || selectionCoords !== null; }}
        />
      )}
      {tableState && (
        <TableToolbar
          tableState={tableState}
          getView={() => editorRef.current?.view}
        />
      )}
      <CodeMirror
        ref={editorRef}
        value={content}
        onChange={handleChange}
        theme={isDark ? darkStructure : lightStructure}
        extensions={extensions}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false, // we use our own via wikilinkExtension
          rectangularSelection: true,
          crosshairCursor: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          syntaxHighlighting: false,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: false,
          completionKeymap: true,
          lintKeymap: false,
        }}
        className="h-full overflow-auto"
        style={{ height: "100%" }}
      />
    </div>
  );
}
