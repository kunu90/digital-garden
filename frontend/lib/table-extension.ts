import {
  EditorView,
  keymap,
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  WidgetType,
} from "@codemirror/view";
import { Prec, RangeSetBuilder } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";

// ─────────────────────────────────────────────────────────────────────────────
// Parsing helpers
// ─────────────────────────────────────────────────────────────────────────────

function isTableLine(text: string): boolean {
  return (text.match(/\|/g) || []).length >= 2;
}

function isSeparatorLine(text: string): boolean {
  return (
    isTableLine(text) &&
    /^\s*\|?[\s:*-]+(\|[\s:*-]+)*\|?\s*$/.test(text) &&
    /[-]/.test(text)
  );
}

function getPipes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) if (text[i] === "|") out.push(i);
  return out;
}

function getColCount(text: string): number {
  return Math.max(0, getPipes(text).length - 1);
}

function getColIndex(text: string, relPos: number): number {
  const pipes = getPipes(text);
  for (let i = 0; i < pipes.length - 1; i++) {
    if (relPos > pipes[i] && relPos <= pipes[i + 1]) return i;
  }
  if (pipes.length > 0 && relPos <= pipes[0]) return 0;
  return Math.max(0, pipes.length - 2);
}

function getTableBounds(
  state: EditorState,
  lineNum: number
): { start: number; end: number } | null {
  if (!isTableLine(state.doc.line(lineNum).text)) return null;
  let start = lineNum;
  while (start > 1 && isTableLine(state.doc.line(start - 1).text)) start--;
  let end = lineNum;
  while (end < state.doc.lines && isTableLine(state.doc.line(end + 1).text)) end++;
  return { start, end };
}

// Parse cells from a table row line
function parseCells(text: string): string[] {
  const pipes = getPipes(text);
  if (pipes.length < 2) return [];
  const cells: string[] = [];
  for (let i = 0; i < pipes.length - 1; i++) {
    cells.push(text.slice(pipes[i] + 1, pipes[i + 1]).trim());
  }
  return cells;
}

// Parse all rows from a table block (as arrays of cell strings)
function parseTableRows(state: EditorState, bounds: { start: number; end: number }) {
  const rows: string[][] = [];
  for (let i = bounds.start; i <= bounds.end; i++) {
    const line = state.doc.line(i);
    if (!isSeparatorLine(line.text)) {
      rows.push(parseCells(line.text));
    }
  }
  return rows;
}

// Parse column alignments from separator row
function parseAlignments(state: EditorState, bounds: { start: number; end: number }): string[] {
  for (let i = bounds.start; i <= bounds.end; i++) {
    const line = state.doc.line(i);
    if (isSeparatorLine(line.text)) {
      return parseCells(line.text).map((cell) => {
        const t = cell.trim();
        if (t.startsWith(":") && t.endsWith(":")) return "center";
        if (t.endsWith(":")) return "right";
        if (t.startsWith(":")) return "left";
        return "";
      });
    }
  }
  return [];
}

function selectCell(view: EditorView, lineNum: number, colIdx: number): boolean {
  const { state } = view;
  if (lineNum < 1 || lineNum > state.doc.lines) return false;
  const line = state.doc.line(lineNum);
  if (!isTableLine(line.text) || isSeparatorLine(line.text)) return false;
  const pipes = getPipes(line.text);
  if (colIdx < 0 || colIdx >= pipes.length - 1) return false;
  const cs = pipes[colIdx] + 1;
  const ce = pipes[colIdx + 1];
  const content = line.text.slice(cs, ce);
  const ts = content.length - content.trimStart().length;
  const te = content.length - content.trimEnd().length;
  view.dispatch({
    selection: { anchor: line.from + cs + ts, head: line.from + ce - te },
    scrollIntoView: true,
  });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────

function navigate(view: EditorView, forward: boolean): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  if (!isTableLine(line.text) || isSeparatorLine(line.text)) return false;
  const pipes = getPipes(line.text);
  if (pipes.length < 2) return false;
  const colIdx = getColIndex(line.text, pos - line.from);
  const colCount = pipes.length - 1;

  if (forward) {
    if (colIdx < colCount - 1) return selectCell(view, line.number, colIdx + 1);
    for (let n = line.number + 1; n <= state.doc.lines; n++) {
      const next = state.doc.line(n);
      if (!isTableLine(next.text)) break;
      if (!isSeparatorLine(next.text)) return selectCell(view, n, 0);
    }
    // Append new row
    let end = line.number;
    while (end < state.doc.lines && isTableLine(state.doc.line(end + 1).text)) end++;
    const endLine = state.doc.line(end);
    const newRow = "|" + Array(colCount).fill("   |").join("");
    view.dispatch({
      changes: { from: endLine.to, insert: "\n" + newRow },
      selection: { anchor: endLine.to + 3 },
      scrollIntoView: true,
    });
    return true;
  } else {
    if (colIdx > 0) return selectCell(view, line.number, colIdx - 1);
    for (let n = line.number - 1; n >= 1; n--) {
      const prev = state.doc.line(n);
      if (!isTableLine(prev.text)) break;
      if (!isSeparatorLine(prev.text)) {
        const pp = getPipes(prev.text);
        return selectCell(view, n, pp.length - 2);
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline markdown → DOM (bold, italic, strikethrough, code)
// ─────────────────────────────────────────────────────────────────────────────

function renderInlineMarkdown(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // inline code first (content is literal, no nesting)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // bold+italic ***
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    // bold ** or __
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // italic * or _
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    // strikethrough ~~
    .replace(/~~(.+?)~~/g, "<del>$1</del>");
  span.innerHTML = html;
  return span;
}

// ─────────────────────────────────────────────────────────────────────────────
// Table widget (rendered view)
// ─────────────────────────────────────────────────────────────────────────────

class TableWidget extends WidgetType {
  constructor(
    readonly rows: string[][],
    readonly alignments: string[],
    readonly tableFrom: number
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return (
      this.tableFrom === other.tableFrom &&
      JSON.stringify(this.rows) === JSON.stringify(other.rows) &&
      JSON.stringify(this.alignments) === JSON.stringify(other.alignments)
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-widget";
    wrapper.setAttribute("contenteditable", "false");

    const table = document.createElement("table");
    table.className = "cm-rendered-table";

    // Header row (first non-separator row)
    if (this.rows.length > 0) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      this.rows[0].forEach((cell, i) => {
        const th = document.createElement("th");
        if (cell) th.appendChild(renderInlineMarkdown(cell));
        else th.innerHTML = "\u00a0";
        if (this.alignments[i]) th.style.textAlign = this.alignments[i];
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    // Data rows (skip first = header)
    if (this.rows.length > 1) {
      const tbody = document.createElement("tbody");
      for (let i = 1; i < this.rows.length; i++) {
        const tr = document.createElement("tr");
        this.rows[i].forEach((cell, j) => {
          const td = document.createElement("td");
          if (cell) td.appendChild(renderInlineMarkdown(cell));
          else td.innerHTML = "\u00a0";
          if (this.alignments[j]) td.style.textAlign = this.alignments[j];
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
    }

    wrapper.appendChild(table);

    // Click anywhere on the widget → move cursor into the table (first cell)
    wrapper.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.dispatch({
        selection: { anchor: this.tableFrom + 1 },
        scrollIntoView: true,
      });
      view.focus();
    });

    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Table state (for toolbar)
// ─────────────────────────────────────────────────────────────────────────────

export interface TableState {
  inTable: true;
  tableStartLine: number;
  tableEndLine: number;
  rowIndex: number;
  colIndex: number;
  colCount: number;
  dataRowCount: number;
  lineDocFrom: number;
  lineDocTo: number;
  coords: { top: number; bottom: number; left: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Decorations — rendered widget OR raw editing view
// ─────────────────────────────────────────────────────────────────────────────

const pipeMark = Decoration.mark({ class: "cm-table-pipe" });
const sepLineDeco = Decoration.line({ class: "cm-table-sep" });
const headerLineDeco = Decoration.line({ class: "cm-table-header-row" });
const hiddenLineDeco = Decoration.line({ class: "cm-table-hidden" });

// Zero-content widget used to replace hidden table lines
class EmptyWidget extends WidgetType {
  toDOM() { return document.createElement("span"); }
  eq() { return true; }
  get estimatedHeight() { return 0; }
}
const emptyWidget = new EmptyWidget();

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { state } = view;
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  const processedStarts = new Set<number>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = state.doc.lineAt(pos);

      if (isTableLine(line.text)) {
        const bounds = getTableBounds(state, line.number);

        if (bounds && !processedStarts.has(bounds.start)) {
          processedStarts.add(bounds.start);

          const cursorInTable =
            cursorLine >= bounds.start && cursorLine <= bounds.end;
          const firstLine = state.doc.line(bounds.start);
          const lastLine = state.doc.line(bounds.end);

          if (!cursorInTable) {
            // ── Rendered widget ──────────────────────────────────
            // Non-block Decoration.replace on each line avoids the
            // "Block decorations may not be specified on lines with
            // other decorations" error that block:true triggers when
            // syntax highlighting has inline marks on the same lines.
            const rows = parseTableRows(state, bounds);
            const alignments = parseAlignments(state, bounds);

            // First line: replace content with the rendered table widget
            builder.add(
              firstLine.from,
              firstLine.to,
              Decoration.replace({
                widget: new TableWidget(rows, alignments, firstLine.from),
              })
            );

            // Remaining lines: line class (startSide:-1) then replace (startSide:1)
            for (let i = bounds.start + 1; i <= bounds.end; i++) {
              const l = state.doc.line(i);
              builder.add(l.from, l.from, hiddenLineDeco);
              builder.add(l.from, l.to, Decoration.replace({ widget: emptyWidget }));
            }
          } else {
            // ── Raw editing with pipe decorations ────────────────
            for (let i = bounds.start; i <= bounds.end; i++) {
              const l = state.doc.line(i);
              if (isSeparatorLine(l.text)) {
                builder.add(l.from, l.from, sepLineDeco);
              } else if (i === bounds.start) {
                builder.add(l.from, l.from, headerLineDeco);
              }
              for (const p of getPipes(l.text)) {
                builder.add(l.from + p, l.from + p + 1, pipeMark);
              }
            }
          }

          // Skip to end of table
          pos = lastLine.to + 1;
          continue;
        }
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewPlugin
// ─────────────────────────────────────────────────────────────────────────────

export function tablePlugin(onTableState: (ts: TableState | null) => void) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
        requestAnimationFrame(() => this.emit(view));
      }

      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) {
          this.decorations = buildDecorations(u.view);
        }
        if (u.docChanged || u.selectionSet || u.viewportChanged) {
          const view = u.view;
          requestAnimationFrame(() => this.emit(view));
        }
      }

      emit(view: EditorView) {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);

        if (!isTableLine(line.text) || isSeparatorLine(line.text)) {
          onTableState(null);
          return;
        }

        const bounds = getTableBounds(view.state, line.number);
        if (!bounds) { onTableState(null); return; }

        let rowIdx = 0, dataRowCount = 0;
        for (let i = bounds.start; i <= bounds.end; i++) {
          const l = view.state.doc.line(i);
          if (!isSeparatorLine(l.text)) {
            if (i === line.number) rowIdx = dataRowCount;
            dataRowCount++;
          }
        }

        const pipes = getPipes(line.text);
        const colIdx = getColIndex(line.text, pos - line.from);
        const colCount = Math.max(
          getColCount(view.state.doc.line(bounds.start).text),
          pipes.length - 1
        );

        const coords = view.coordsAtPos(line.from);
        if (!coords) { onTableState(null); return; }

        onTableState({
          inTable: true,
          tableStartLine: bounds.start,
          tableEndLine: bounds.end,
          rowIndex: rowIdx,
          colIndex: colIdx,
          colCount,
          dataRowCount,
          lineDocFrom: line.from,
          lineDocTo: line.to,
          coords: { top: coords.top, bottom: coords.bottom, left: coords.left },
        });
      }
    },
    { decorations: (v) => v.decorations }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row / column operations
// ─────────────────────────────────────────────────────────────────────────────

function findDataRowLineNum(view: EditorView, ts: TableState, rowIdx: number): number {
  let seen = 0;
  for (let i = ts.tableStartLine; i <= ts.tableEndLine; i++) {
    const line = view.state.doc.line(i);
    if (!isSeparatorLine(line.text)) {
      if (seen === rowIdx) return i;
      seen++;
    }
  }
  return -1;
}

export function tableInsertRowBelow(view: EditorView, ts: TableState): void {
  const lineNum = findDataRowLineNum(view, ts, ts.rowIndex);
  if (lineNum === -1) return;
  let insertAfter = lineNum;
  if (insertAfter < ts.tableEndLine) {
    const next = view.state.doc.line(insertAfter + 1);
    if (isSeparatorLine(next.text)) insertAfter++;
  }
  const afterLine = view.state.doc.line(insertAfter);
  const newRow = "|" + Array(ts.colCount).fill("   |").join("");
  view.dispatch({
    changes: { from: afterLine.to, insert: "\n" + newRow },
    selection: { anchor: afterLine.to + 3 },
    scrollIntoView: true,
  });
}

export function tableInsertRowAbove(view: EditorView, ts: TableState): void {
  if (ts.rowIndex === 0) { tableInsertRowBelow(view, ts); return; }
  const lineNum = findDataRowLineNum(view, ts, ts.rowIndex);
  if (lineNum === -1) return;
  const line = view.state.doc.line(lineNum);
  const newRow = "|" + Array(ts.colCount).fill("   |").join("");
  view.dispatch({
    changes: { from: line.from, insert: newRow + "\n" },
    selection: { anchor: line.from + 3 },
    scrollIntoView: true,
  });
}

export function tableDeleteRow(view: EditorView, ts: TableState): void {
  if (ts.dataRowCount <= 1) return;
  const lineNum = findDataRowLineNum(view, ts, ts.rowIndex);
  if (lineNum === -1) return;
  const line = view.state.doc.line(lineNum);
  const from = line.from > 0 ? line.from - 1 : line.from;
  const to = line.from > 0 ? line.to : Math.min(line.to + 1, view.state.doc.length);
  view.dispatch({ changes: { from, to, insert: "" } });
}

export function tableInsertColRight(view: EditorView, ts: TableState): void {
  _insertCol(view, ts, ts.colIndex + 1);
}

export function tableInsertColLeft(view: EditorView, ts: TableState): void {
  _insertCol(view, ts, ts.colIndex);
}

function _insertCol(view: EditorView, ts: TableState, pipeIdx: number): void {
  const { state } = view;
  const changes: { from: number; insert: string }[] = [];
  for (let i = ts.tableStartLine; i <= ts.tableEndLine; i++) {
    const line = state.doc.line(i);
    const pipes = getPipes(line.text);
    if (pipeIdx > pipes.length - 1) continue;
    const at = line.from + pipes[pipeIdx];
    changes.push({ from: at, insert: isSeparatorLine(line.text) ? "---|" : "   |" });
  }
  if (changes.length) view.dispatch({ changes });
}

export function tableDeleteCol(view: EditorView, ts: TableState): void {
  if (ts.colCount <= 1) return;
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  for (let i = ts.tableStartLine; i <= ts.tableEndLine; i++) {
    const line = state.doc.line(i);
    const pipes = getPipes(line.text);
    if (ts.colIndex >= pipes.length - 1) continue;
    changes.push({
      from: line.from + pipes[ts.colIndex],
      to: line.from + pipes[ts.colIndex + 1],
      insert: "",
    });
  }
  if (changes.length) view.dispatch({ changes });
}

export function tableDelete(view: EditorView, ts: TableState): void {
  const { state } = view;
  const startLine = state.doc.line(ts.tableStartLine);
  const endLine = state.doc.line(ts.tableEndLine);
  const from = startLine.from > 0 ? startLine.from - 1 : 0;
  view.dispatch({ changes: { from, to: endLine.to, insert: "" } });
}

export function tableSetAlignment(
  view: EditorView,
  ts: TableState,
  align: "left" | "center" | "right" | "none"
): void {
  const { state } = view;
  for (let i = ts.tableStartLine; i <= ts.tableEndLine; i++) {
    const line = state.doc.line(i);
    if (!isSeparatorLine(line.text)) continue;
    const pipes = getPipes(line.text);
    if (ts.colIndex >= pipes.length - 1) break;
    const cellFrom = line.from + pipes[ts.colIndex] + 1;
    const cellTo = line.from + pipes[ts.colIndex + 1];
    const cell =
      align === "left" ? ":---" :
      align === "center" ? ":---:" :
      align === "right" ? "---:" :
      "---";
    view.dispatch({ changes: { from: cellFrom, to: cellTo, insert: cell } });
    break;
  }
}

export function tableInsertNew(view: EditorView, cols = 3, rows = 2): void {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const header = "|" + Array.from({ length: cols }, (_, i) => ` Col ${i + 1} `).join("|") + "|";
  const sep = "|" + Array(cols).fill("---|").join("");
  const emptyRow = "|" + Array(cols).fill("   |").join("");
  const tableText = [header, sep, ...Array(rows).fill(emptyRow)].join("\n");
  const needsBefore = line.text.trim() !== "";
  const insertAt = needsBefore ? line.to : line.from;
  const prefix = needsBefore ? "\n" : "";
  view.dispatch({
    changes: { from: insertAt, insert: prefix + tableText + "\n" },
    selection: { anchor: insertAt + prefix.length + 2 },
    scrollIntoView: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme (for raw editing mode)
// ─────────────────────────────────────────────────────────────────────────────

export function tableTheme(_isDark: boolean) {
  return EditorView.theme({
    ".cm-table-pipe": {
      color: "var(--muted-foreground)",
    },
    ".cm-table-sep .cm-table-pipe": {
      color: "var(--muted-foreground)",
    },
    ".cm-table-sep": { opacity: "0.55" },
    ".cm-table-header-row": { fontWeight: "600" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function tableExtension(opts: {
  onTableState: (ts: TableState | null) => void;
  isDark: boolean;
}) {
  return [
    Prec.highest(
      keymap.of([
        { key: "Tab", run: (v) => navigate(v, true) },
        { key: "Shift-Tab", run: (v) => navigate(v, false) },
      ])
    ),
    tablePlugin(opts.onTableState),
    tableTheme(opts.isDark),
  ];
}
