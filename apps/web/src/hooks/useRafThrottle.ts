import { useRef, useEffect, useCallback } from "react";

/**
 * Coalesces rapid calls to at most one execution per animation frame, always
 * delivering the latest arguments. Suited to high-frequency inputs like slider
 * drags where the goal is to cap work at the display refresh rate instead of
 * waiting out a fixed delay.
 */
export function useRafThrottle<A extends unknown[]>(
  callback: (...args: A) => void,
): (...args: A) => void {
  const callbackRef = useRef(callback);
  const rafRef = useRef<number | null>(null);
  const argsRef = useRef<A | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return useCallback((...args: A) => {
    argsRef.current = args;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const latest = argsRef.current;
      argsRef.current = null;
      if (latest) callbackRef.current(...latest);
    });
  }, []);
}
