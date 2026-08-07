"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { MotionConfig, useReducedMotion, type Transition } from "framer-motion";
import { FADE_TRANSITION } from "@/lib/motion";

type MotionAccessibility = {
  reducedMotion: boolean;
  reducedTransparency: boolean;
  fadeTransition: Transition;
};

const MotionAccessibilityContext = createContext<MotionAccessibility>({
  reducedMotion: false,
  reducedTransparency: false,
  fadeTransition: FADE_TRANSITION,
});

function MotionAccessibilityBridge({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion() ?? false;
  const [reducedTransparency, setReducedTransparency] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const sync = () => setReducedTransparency(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <MotionAccessibilityContext.Provider
      value={{
        reducedMotion,
        reducedTransparency,
        fadeTransition: FADE_TRANSITION,
      }}
    >
      {children}
    </MotionAccessibilityContext.Provider>
  );
}

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <MotionAccessibilityBridge>{children}</MotionAccessibilityBridge>
    </MotionConfig>
  );
}

export function useMotionAccessibility() {
  return useContext(MotionAccessibilityContext);
}
