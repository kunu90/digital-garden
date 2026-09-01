import {
  Extension,
  Prec,
  StateField,
  StateEffect,
  Transaction,
} from "@codemirror/state";
import { API_BASE } from "@/lib/api";
import {
  EditorView,
  Decoration,
  DecorationSet,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
  keymap,
} from "@codemirror/view";

// ── State ────────────────────────────────────────────────────────────────────

interface Ghost {
  text: string;
  pos: number;
}

const setGhost = StateEffect.define<Ghost | null>();

const ghostField = StateField.define<Ghost | null>({
  create: () => null,
  update(value, tr: Transaction) {
    // Effects win first
    for (const effect of tr.effects) {
      if (effect.is(setGhost)) return effect.value;
    }
    // Any document edit or cursor move clears the ghost
    if (tr.docChanged || tr.selection) return null;
    return value;
  },
  provide: (field) =>
    EditorView.decorations.from(field, (ghost) => {
      if (!ghost) return Decoration.none;
      return Decoration.set([
        Decoration.widget({ widget: new GhostWidget(ghost.text), side: 1 }).range(ghost.pos),
      ]);
    }),
});

// ── Ghost text widget ─────────────────────────────────────────────────────────

class GhostWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  eq(other: GhostWidget) {
    return other.text === this.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.setAttribute("aria-hidden", "true");
    span.textContent = this.text;
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function ghostTheme(_isDark: boolean) {
  return EditorView.baseTheme({
    ".cm-ghost-text": {
      color: "var(--muted-foreground)",
      fontStyle: "italic",
      pointerEvents: "none",
      userSelect: "none",
      opacity: "0",
      animation: "cm-ghost-fade-in 120ms ease forwards",
    },
    "@keyframes cm-ghost-fade-in": {
      from: { opacity: "0" },
      to: { opacity: "1" },
    },
  });
}

// ── Fetcher plugin ────────────────────────────────────────────────────────────

function ghostPlugin() {
  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;
      private abort: AbortController | null = null;

      update(update: ViewUpdate) {
        if (!update.docChanged && !update.selectionSet) return;

        this.cancelPending();

        const state = update.view.state;
        const sel = state.selection.main;

        // Only trigger for collapsed cursor with no selection
        if (!sel.empty) return;

        const pos = sel.head;
        const doc = state.doc.toString();

        // Skip if document is too short to have meaningful context
        if (doc.trim().length < 15) return;

        // Don't complete mid-word (cursor wedged between two word chars)
        const before = doc[pos - 1] ?? "";
        const after = doc[pos] ?? "";
        const isMidWord = /\w/.test(before) && /\w/.test(after);
        if (isMidWord) return;

        this.timer = setTimeout(() => this.fetch(update.view, pos), 650);
      }

      private cancelPending() {
        if (this.timer !== null) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (this.abort) {
          this.abort.abort();
          this.abort = null;
        }
        // Clear existing ghost immediately when user types
        // (the state field handles this via tr.docChanged, but belt-and-suspenders)
      }

      private async fetch(view: EditorView, pos: number) {
        const state = view.state;
        const doc = state.doc.toString();

        // Build context window: 1000 chars before, 200 chars after
        const prefix = doc.slice(Math.max(0, pos - 1000), pos);
        const suffix = doc.slice(pos, Math.min(doc.length, pos + 200));

        // Don't bother if prefix is just whitespace
        if (!prefix.trim()) return;

        this.abort = new AbortController();

        try {
          const res = await fetch(`${API_BASE}/notes/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, suffix }),
            signal: this.abort.signal,
          });

          if (!res.ok) return;

          const data = (await res.json()) as { completion: string };
          const completion = data.completion?.trim();
          if (!completion) return;

          // Cursor must still be at the same position
          const nowPos = view.state.selection.main.head;
          if (nowPos !== pos || !view.state.selection.main.empty) return;

          view.dispatch({ effects: setGhost.of({ text: completion, pos }) });
        } catch {
          // AbortError or network failure — silently ignore
        }
      }

      destroy() {
        this.cancelPending();
      }
    }
  );
}

// ── Keymap ────────────────────────────────────────────────────────────────────

const ghostKeymap = keymap.of([
  {
    key: "Tab",
    run(view) {
      const ghost = view.state.field(ghostField);
      if (!ghost) return false; // let default Tab / indentation handle it

      view.dispatch({
        changes: { from: ghost.pos, to: ghost.pos, insert: ghost.text },
        selection: { anchor: ghost.pos + ghost.text.length },
        effects: setGhost.of(null),
      });
      return true;
    },
  },
  {
    key: "Escape",
    run(view) {
      const ghost = view.state.field(ghostField);
      if (!ghost) return false;
      view.dispatch({ effects: setGhost.of(null) });
      return true;
    },
  },
]);

// ── Public API ────────────────────────────────────────────────────────────────

export function tabCompletionExtension(isDark: boolean): Extension {
  return [ghostField, ghostTheme(isDark), ghostPlugin(), Prec.highest(ghostKeymap)];
}
