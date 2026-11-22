// Q15 throttling primitives for the chart editor.
//
// Two patterns the spec calls for that aren't covered by `src/utils/debounce.ts`:
//
// 1. **Debounce-with-flush** for text inputs (cell values, series labels,
//    chart title). Typing fires intermediate commits every 200ms so live
//    collaborators see the partial state; blur/Enter triggers an immediate
//    flush so the final value isn't held back by the timer.
//
// 2. **Throttle-with-trailing** for color-picker drags. Continuous slider
//    movement fires onChange ~60 times per second; we want at most one
//    commit every 60ms, with the **final** color value always landing
//    (otherwise the user picks a color, releases, and ends up on a slightly
//    earlier value because the trailing emit was dropped).

import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a `{ schedule, flush, cancel }` triple. `schedule(value)` queues
 * `commit(value)` to fire after `delayMs` of inactivity, replacing any
 * earlier queue. `flush()` fires the pending value immediately. `cancel()`
 * drops the pending value without firing.
 */
export function useDebouncedCommit<T>(
  commit: (value: T) => void,
  delayMs = 200,
): { schedule: (value: T) => void; flush: () => void; cancel: () => void } {
  const commitRef = useRef(commit);
  useEffect(() => { commitRef.current = commit; }, [commit]);

  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ value: T } | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const schedule = useCallback((value: T) => {
    pendingRef.current = { value };
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const p = pendingRef.current;
      if (p) {
        pendingRef.current = null;
        commitRef.current(p.value);
      }
    }, delayMs);
  }, [delayMs]);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const p = pendingRef.current;
    if (p) {
      pendingRef.current = null;
      commitRef.current(p.value);
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
  }, []);

  return { schedule, flush, cancel };
}

/**
 * Throttle with leading + trailing emission. The first call within an idle
 * window fires immediately. Subsequent calls within `intervalMs` queue the
 * latest args; when the window expires, the queued args fire (the final
 * trailing emit). This matches the "60Hz drag, but the user's final color
 * always lands" expectation from Q15.
 */
export function useThrottledCallback<T extends (...args: any[]) => void>(
  fn: T,
  intervalMs: number,
): T {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  const lastFireRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return useCallback(((...args: Parameters<T>) => {
    const now = Date.now();
    const since = now - lastFireRef.current;
    if (since >= intervalMs) {
      lastFireRef.current = now;
      fnRef.current(...args);
      return;
    }
    pendingArgsRef.current = args;
    if (timerRef.current === null) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const queued = pendingArgsRef.current;
        if (queued) {
          pendingArgsRef.current = null;
          lastFireRef.current = Date.now();
          fnRef.current(...queued);
        }
      }, intervalMs - since);
    }
  }) as T, [intervalMs]);
}
