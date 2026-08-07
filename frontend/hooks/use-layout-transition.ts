"use client";

import { useMotionAccessibility } from "@/components/motion-provider";
import { LAYOUT_SPRING } from "@/lib/motion";

export function useLayoutTransition() {
  const { reducedMotion, fadeTransition } = useMotionAccessibility();
  return reducedMotion ? fadeTransition : LAYOUT_SPRING;
}
