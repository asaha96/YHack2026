import { useEffect, useRef, useState, useCallback } from "react";
import type { Modification } from "../utils/api";

export interface TimedModification extends Modification {
  delay_ms?: number;
  duration_ms?: number;
  animation?: "draw" | "pulse" | "fade";
}

export function useAnnotationSync() {
  const [visibleMods, setVisibleMods] = useState<TimedModification[]>([]);
  const [animationProgress, setAnimationProgress] = useState<Map<number, number>>(new Map());
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animFramesRef = useRef<ReturnType<typeof requestAnimationFrame>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    animFramesRef.current.forEach(cancelAnimationFrame);
    animFramesRef.current = [];
  }, []);

  const playAnnotations = useCallback(
    (modifications: TimedModification[]) => {
      clearTimers();
      setVisibleMods([]);
      setAnimationProgress(new Map());

      let baseDelay = 0;

      modifications.forEach((mod, index) => {
        const delay = mod.delay_ms ?? baseDelay;
        const duration = mod.duration_ms ?? 1000;

        // Schedule the appearance of this modification
        const timer = setTimeout(() => {
          setVisibleMods((prev) => [...prev, mod]);

          // Animate the progress from 0 to 1 over duration_ms
          const startTime = performance.now();
          const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            setAnimationProgress((prev) => {
              const next = new Map(prev);
              next.set(index, progress);
              return next;
            });

            if (progress < 1) {
              const frame = requestAnimationFrame(animate);
              animFramesRef.current.push(frame);
            }
          };
          const frame = requestAnimationFrame(animate);
          animFramesRef.current.push(frame);
        }, delay);

        timersRef.current.push(timer);

        // Auto-increment delay for mods without explicit timing
        if (!mod.delay_ms) {
          baseDelay += 1500; // 1.5s between annotations if no timing specified
        }
      });
    },
    [clearTimers]
  );

  // Cleanup on unmount
  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  return { visibleMods, animationProgress, playAnnotations };
}
