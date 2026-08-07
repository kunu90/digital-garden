"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Minus,
  PanelLeftClose,
  PanelRightClose,
  Trash2,
} from "lucide-react";
import {
  type TableState,
  tableInsertRowBelow,
  tableInsertRowAbove,
  tableDeleteRow,
  tableInsertColLeft,
  tableInsertColRight,
  tableDeleteCol,
  tableDelete,
} from "@/lib/table-extension";

interface Props {
  tableState: TableState;
  getView: () => EditorView | undefined;
}

interface BtnProps {
  onClick: () => void;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function Btn({ onClick, title, danger, disabled, children }: BtnProps) {
  return (
    <button
      className={[
        "table-toolbar-btn",
        danger ? "table-toolbar-btn--danger" : "",
        disabled ? "table-toolbar-btn--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={disabled ? undefined : onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="table-toolbar-sep" />;
}

export function TableToolbar({ tableState, getView }: Props) {
  const [mounted, setMounted] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [flip, setFlip] = useState(false);

  useEffect(() => setMounted(true), []);

  // Check if toolbar would overflow viewport bottom — if so, flip above
  useEffect(() => {
    if (!toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    const willOverflow = rect.bottom > window.innerHeight - 8;
    setFlip(willOverflow);
  }, [tableState.coords.bottom]);

  if (!mounted) return null;

  const { coords, rowIndex, colIndex, colCount, dataRowCount } = tableState;

  const toolbarH = 34;
  const gap = 5;
  const top = flip
    ? coords.top - toolbarH - gap
    : coords.bottom + gap;

  const style: React.CSSProperties = {
    position: "fixed",
    top,
    left: coords.left,
    zIndex: 1001,
  };

  function op(fn: (v: EditorView, ts: TableState) => void) {
    return () => {
      const v = getView();
      if (v) fn(v, tableState);
    };
  }

  return createPortal(
    <div ref={toolbarRef} className="table-toolbar" style={style}>
      {/* Position badge */}
      <span className="table-toolbar-pos">
        R{rowIndex + 1}·C{colIndex + 1}
      </span>

      <Sep />

      {/* Row ops */}
      <Btn onClick={op(tableInsertRowAbove)} title="Insert row above (⇧Tab to prev)">
        <ArrowUpToLine size={12} strokeWidth={2} />
      </Btn>
      <Btn onClick={op(tableInsertRowBelow)} title="Insert row below (Tab from last col)">
        <ArrowDownToLine size={12} strokeWidth={2} />
      </Btn>
      <Btn
        onClick={op(tableDeleteRow)}
        title="Delete row"
        disabled={dataRowCount <= 1}
      >
        <Minus size={12} strokeWidth={2.5} />
      </Btn>

      <Sep />

      {/* Col ops */}
      <Btn onClick={op(tableInsertColLeft)} title="Insert column left">
        <PanelLeftClose size={12} strokeWidth={2} />
      </Btn>
      <Btn onClick={op(tableInsertColRight)} title="Insert column right">
        <PanelRightClose size={12} strokeWidth={2} />
      </Btn>
      <Btn
        onClick={op(tableDeleteCol)}
        title="Delete column"
        disabled={colCount <= 1}
      >
        <Minus size={12} strokeWidth={2.5} />
      </Btn>

      <Sep />

      {/* Delete table */}
      <Btn onClick={op(tableDelete)} title="Delete table" danger>
        <Trash2 size={12} strokeWidth={2} />
      </Btn>
    </div>,
    document.body
  );
}
