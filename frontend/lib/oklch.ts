export type Oklch = { l: number; c: number; h: number; a: number };

const OKLCH_RE =
  /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/i;

export function parseOklch(value: string): Oklch | null {
  const match = OKLCH_RE.exec(value.trim());
  if (!match) return null;
  return {
    l: Number(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
    a: match[4] !== undefined ? Number(match[4]) : 1,
  };
}

export function formatOklch({ l, c, h, a }: Oklch): string {
  if (a < 1) return `oklch(${l} ${c} ${h} / ${a})`;
  return `oklch(${l} ${c} ${h})`;
}

function lerpHue(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

/** Interpolate along the OKLCH track (shortest hue arc). */
export function lerpOklch(from: Oklch, to: Oklch, t: number): Oklch {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    l: from.l + (to.l - from.l) * clamped,
    c: from.c + (to.c - from.c) * clamped,
    h: lerpHue(from.h, to.h, clamped),
    a: from.a + (to.a - from.a) * clamped,
  };
}

/** Frame-rate-independent exponential approach toward target. */
export function approachOklch(
  current: Oklch,
  target: Oklch,
  dtSeconds: number,
  durationSeconds: number,
): Oklch {
  const tau = Math.max(durationSeconds, 0.001);
  const t = 1 - Math.exp(-dtSeconds / tau);
  return lerpOklch(current, target, t);
}
