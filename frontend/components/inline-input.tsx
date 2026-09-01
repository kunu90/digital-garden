"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  defaultValue?: string;
  placeholder?: string;
  /** Select text only up to this index (e.g. before file extension) */
  selectEnd?: number;
  onConfirm: (value: string) => Promise<void> | void;
  onCancel: () => void;
};

export function InlineInput({ defaultValue = "", placeholder, selectEnd, onConfirm, onCancel }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.focus();
    }, 10);
    const end = selectEnd ?? defaultValue.length;
    ref.current?.setSelectionRange(0, end);
  }, []);

  async function confirm() {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    committedRef.current = true;
    setSaving(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    if (committedRef.current) return;
    committedRef.current = true;
    onCancel();
  }

  return (
    <input
      ref={ref}
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); confirm(); }
        if (e.key === "Escape") { e.preventDefault(); cancel(); }
      }}
      onBlur={cancel}
      placeholder={placeholder}
      className="h-[22px] min-w-0 flex-1 rounded-[var(--radius-sm)] bg-[var(--card)] px-1.5 text-[11px] text-foreground outline-none border border-[var(--input)] focus:border-[var(--ring)] focus:ring-2 focus:ring-[var(--ring)] disabled:opacity-40"
    />
  );
}
