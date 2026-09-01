import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { Extension } from "@codemirror/state";
import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionResult,
} from "@codemirror/autocomplete";

// Matches [[Note Name]], [[Note Name|Alias]], [[Note Name#heading]]
// Negative lookbehind ensures we don't match ![[...]] (media embeds)
const WIKILINK_RE = /(?<!!)\[\[([^\[\]\n|#]+?)(?:[|#][^\]\n]*)?\]\]/g;

function buildWikilinkDecorator() {
  return new MatchDecorator({
    regexp: WIKILINK_RE,
    decoration: () =>
      Decoration.mark({
        class: "cm-wikilink",
      }),
  });
}

function wikilinkPlugin(onNavigate: (name: string) => void) {
  const decorator = buildWikilinkDecorator();

  return ViewPlugin.define(
    (view) => ({
      decorations: decorator.createDeco(view),
      update(u: ViewUpdate) {
        this.decorations = decorator.updateDeco(u, this.decorations);
      },
    }),
    {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        click(event: MouseEvent, view: EditorView) {
          if (!(event.metaKey || event.ctrlKey)) return false;
          const pos = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (pos === null) return false;

          const line = view.state.doc.lineAt(pos);
          const text = line.text;
          const relPos = pos - line.from;

          const re = /(?<!!)\[\[([^\[\]\n|#]+?)(?:[|#][^\]\n]*)?\]\]/g;
          let match: RegExpExecArray | null;
          while ((match = re.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (start <= relPos && relPos <= end) {
              onNavigate(match[1].trim());
              event.preventDefault();
              return true;
            }
          }
          return false;
        },
      },
    }
  );
}

function wikilinkTheme() {
  return EditorView.baseTheme({
    ".cm-tooltip.cm-tooltip-autocomplete": {
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      background: "var(--popover)",
      boxShadow: "var(--shadow-md)",
      overflow: "hidden",
      fontFamily: "var(--font-sans)",
      fontSize: "0.875rem",
      minWidth: "160px",
    },
    ".cm-tooltip-autocomplete > ul": {
      padding: "2px",
      fontFamily: "var(--font-sans)",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "5px 10px",
      borderRadius: "4px",
      color: "var(--popover-foreground)",
      lineHeight: "1.4",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      background: "var(--accent)",
      color: "var(--accent-foreground)",
    },
    ".cm-completionIcon": {
      display: "none",
    },
    ".cm-completionDetail": {
      color: "var(--muted-foreground)",
      fontSize: "0.75rem",
      marginLeft: "6px",
      fontStyle: "normal",
    },
  });
}

function wikilinkCompletionSource(notes: string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    // Matches from [[ to the cursor, without a closing ]]
    const match = context.matchBefore(/\[\[[^\[\]\n]*$/);
    if (!match) return null;

    const query = match.text.slice(2).toLowerCase();

    const options: Completion[] = notes
      .map((note) => {
        const stem = note.replace(/\.md$/, "");
        const parts = stem.split("/");
        const filename = parts[parts.length - 1];
        const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : undefined;
        return {
          label: filename,
          detail: folder,
          apply: (_view: EditorView, _completion: Completion, _from: number, to: number) => {
            // Extend `to` to consume any existing ]] after the cursor so we
            // don't end up with double-bracket wrapping on an existing link.
            const docStr = _view.state.doc.toString();
            const afterCursor = docStr.slice(to);
            const closing = afterCursor.match(/^([^\[\]\n]*)\]\]/);
            const insertTo = closing ? to + closing[0].length : to;
            _view.dispatch({
              changes: {
                from: match.from,
                to: insertTo,
                insert: `[[${stem}]]`,
              },
            });
          },
          type: "text",
          boost: filename.toLowerCase().startsWith(query) ? 10 : 0,
        };
      })
      .filter((o) => o.label.toLowerCase().includes(query) ||
        (o.detail && o.detail.toLowerCase().includes(query)));

    return {
      from: match.from + 2,
      options,
      filter: false,
    };
  };
}

export type WikilinkExtensionOptions = {
  vaultNotes: string[];
  onNavigate: (noteName: string) => void;
};

export function wikilinkExtension({
  vaultNotes,
  onNavigate,
}: WikilinkExtensionOptions): Extension {
  return [
    wikilinkPlugin(onNavigate),
    wikilinkTheme(),
    autocompletion({
      override: [wikilinkCompletionSource(vaultNotes)],
      activateOnTyping: true,
      closeOnBlur: true,
    }),
  ];
}
