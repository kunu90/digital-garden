"use client";

import { useMotionAccessibility } from "@/components/motion-provider";
import { COMMAND_PALETTE_SPRING } from "@/lib/motion";

export function useCommandPaletteTransition() {
  const { reducedMotion, fadeTransition } = useMotionAccessibility();
  return reducedMotion ? fadeTransition : COMMAND_PALETTE_SPRING;
}
