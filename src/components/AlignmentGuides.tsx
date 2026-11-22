import React, { useRef, useEffect, memo, useCallback } from 'react';
import { useStore } from '../store/index';
import { useAlignmentGuidesStore } from '../store/alignmentGuidesStore';
import type { SlideElement } from '../store/sliceTypes';

interface AlignmentGuidesProps {
  containerSize?: { width: number; height: number };
}

const SNAP_THRESHOLD = 8; // pixels - slightly tighter for snappier feel
const GUIDE_COLOR = '#FF6B6B'; // Red color like PowerPoint
const GUIDE_CENTER_COLOR = '#007AFF'; // Blue for center guides
const MAX_GUIDES = 32; // upper bound on simultaneously-visible guides

export function AlignmentGuides({
  containerSize = { width: 1024, height: 768 }
}: AlignmentGuidesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elements = useStore((s) => s.slides[s.currentSlide]?.elements);

  // Refs that the imperative update loop reads; kept in sync via effects
  // so the store subscription itself doesn't need to re-wire when deps change.
  const elementsRef = useRef(elements);
  const containerSizeRef = useRef(containerSize);
  const othersCacheRef = useRef<{
    sourceRef: SlideElement[] | undefined;
    activeId: string | null;
    data: Array<{ left: number; right: number; top: number; bottom: number; centerX: number; centerY: number }>;
  }>({ sourceRef: undefined, activeId: null, data: [] });

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { containerSizeRef.current = containerSize; }, [containerSize.width, containerSize.height]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Pre-allocate a pool of guide divs. Imperative DOM updates mean React
    // does zero work per drag frame — we just mutate existing node styles.
    const pool: HTMLDivElement[] = [];
    for (let i = 0; i < MAX_GUIDES; i++) {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.display = 'none';
      div.style.pointerEvents = 'none';
      container.appendChild(div);
      pool.push(div);
    }

    const update = () => {
      const state = useAlignmentGuidesStore.getState();
      const activeId = state.activeElementId;
      const activePos = state.activePosition;
      const activeSize = state.activeSize;

      if (!activeId || !activePos || !activeSize) {
        for (let i = 0; i < pool.length; i++) {
          const s = pool[i].style;
          if (s.display !== 'none') s.display = 'none';
        }
        return;
      }

      // Rebuild "other elements" cache only when the source list or active
      // id changes — not on every pointer frame.
      const elementsSnapshot = elementsRef.current;
      const cache = othersCacheRef.current;
      if (cache.sourceRef !== elementsSnapshot || cache.activeId !== activeId) {
        const list = elementsSnapshot ?? [];
        const next: typeof cache.data = [];
        for (const el of list) {
          if (el.id === activeId) continue;
          next.push({
            left: el.position.x,
            right: el.position.x + el.size.width,
            top: el.position.y,
            bottom: el.position.y + el.size.height,
            centerX: el.position.x + el.size.width / 2,
            centerY: el.position.y + el.size.height / 2,
          });
        }
        cache.data = next;
        cache.sourceRef = elementsSnapshot;
        cache.activeId = activeId;
      }
      const others = cache.data;

      const cw = containerSizeRef.current.width;
      const ch = containerSizeRef.current.height;
      const cwHalf = cw / 2;
      const chHalf = ch / 2;

      const aLeft = activePos.x;
      const aRight = activePos.x + activeSize.width;
      const aTop = activePos.y;
      const aBottom = activePos.y + activeSize.height;
      const aCenterX = aLeft + activeSize.width / 2;
      const aCenterY = aTop + activeSize.height / 2;

      let idx = 0;
      const apply = (vertical: boolean, pos: number, start: number, end: number, center: boolean) => {
        if (idx >= pool.length) return;
        const s = pool[idx++].style;
        if (s.display !== 'block') s.display = 'block';
        const color = center ? GUIDE_CENTER_COLOR : GUIDE_COLOR;
        if (s.backgroundColor !== color) s.backgroundColor = color;
        if (vertical) {
          s.left = pos + 'px';
          s.top = start + 'px';
          s.width = '1px';
          s.height = (end - start) + 'px';
        } else {
          s.left = start + 'px';
          s.top = pos + 'px';
          s.width = (end - start) + 'px';
          s.height = '1px';
        }
      };

      // Container guides
      if (Math.abs(aLeft) <= SNAP_THRESHOLD) apply(true, 0, 0, ch, false);
      if (Math.abs(aRight - cw) <= SNAP_THRESHOLD) apply(true, cw, 0, ch, false);
      if (Math.abs(aCenterX - cwHalf) <= SNAP_THRESHOLD) apply(true, cwHalf, 0, ch, true);
      if (Math.abs(aTop) <= SNAP_THRESHOLD) apply(false, 0, 0, cw, false);
      if (Math.abs(aBottom - ch) <= SNAP_THRESHOLD) apply(false, ch, 0, cw, false);
      if (Math.abs(aCenterY - chHalf) <= SNAP_THRESHOLD) apply(false, chHalf, 0, cw, true);

      // Element-to-element alignments
      for (let i = 0; i < others.length; i++) {
        const o = others[i];
        const vStart = Math.max(0, Math.min(aTop, o.top) - 10);
        const vEnd = Math.min(ch, Math.max(aBottom, o.bottom) + 10);
        const hStart = Math.max(0, Math.min(aLeft, o.left) - 10);
        const hEnd = Math.min(cw, Math.max(aRight, o.right) + 10);

        if (Math.abs(aLeft - o.left) <= SNAP_THRESHOLD) apply(true, o.left, vStart, vEnd, false);
        if (Math.abs(aLeft - o.right) <= SNAP_THRESHOLD) apply(true, o.right, vStart, vEnd, false);
        if (Math.abs(aRight - o.right) <= SNAP_THRESHOLD) apply(true, o.right, vStart, vEnd, false);
        if (Math.abs(aRight - o.left) <= SNAP_THRESHOLD) apply(true, o.left, vStart, vEnd, false);
        if (Math.abs(aCenterX - o.centerX) <= SNAP_THRESHOLD) apply(true, o.centerX, vStart, vEnd, true);

        if (Math.abs(aTop - o.top) <= SNAP_THRESHOLD) apply(false, o.top, hStart, hEnd, false);
        if (Math.abs(aTop - o.bottom) <= SNAP_THRESHOLD) apply(false, o.bottom, hStart, hEnd, false);
        if (Math.abs(aBottom - o.bottom) <= SNAP_THRESHOLD) apply(false, o.bottom, hStart, hEnd, false);
        if (Math.abs(aBottom - o.top) <= SNAP_THRESHOLD) apply(false, o.top, hStart, hEnd, false);
        if (Math.abs(aCenterY - o.centerY) <= SNAP_THRESHOLD) apply(false, o.centerY, hStart, hEnd, true);
      }

      // Hide unused divs
      for (let i = idx; i < pool.length; i++) {
        const s = pool[i].style;
        if (s.display !== 'none') s.display = 'none';
      }
    };

    update();
    const unsub = useAlignmentGuidesStore.subscribe(update);
    return () => {
      unsub();
      for (const div of pool) div.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1000 }}
    />
  );
}

// Memoize the AlignmentGuides component to prevent unnecessary re-renders
export const MemoizedAlignmentGuides = memo(AlignmentGuides);

// Pre-compute snap points outside the hook for better performance
interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
}

// Hook to calculate snap positions for an element - optimized version
export function useAlignmentSnap(
  activeElementId?: string,
  containerSize = { width: 1024, height: 768 }
) {
  const elements = useStore((s) => s.slides[s.currentSlide]?.elements);

  // Cache other elements data
  const otherElementsRef = useRef<Array<{
    left: number; right: number; centerX: number;
    top: number; bottom: number; centerY: number;
  }>>([]);

  // Update cache when elements change
  useEffect(() => {
    const list = elements ?? [];

    otherElementsRef.current = list
      .filter((element: SlideElement) => element.id !== activeElementId)
      .map((element: SlideElement) => ({
        left: element.position.x,
        right: element.position.x + element.size.width,
        centerX: element.position.x + element.size.width / 2,
        top: element.position.y,
        bottom: element.position.y + element.size.height,
        centerY: element.position.y + element.size.height / 2,
      }));
  }, [elements, activeElementId]);
  
  // Memoized snap calculation function with useCallback
  const calculateSnapPosition = useCallback((
    currentPosition: { x: number; y: number },
    elementSize: { width: number; height: number }
  ): SnapResult => {
    if (!activeElementId) {
      return { x: currentPosition.x, y: currentPosition.y, snappedX: false, snappedY: false };
    }

    let snappedX = currentPosition.x;
    let snappedY = currentPosition.y;
    let didSnapX = false;
    let didSnapY = false;

    const halfWidth = elementSize.width / 2;
    const halfHeight = elementSize.height / 2;
    const left = currentPosition.x;
    const right = currentPosition.x + elementSize.width;
    const centerX = currentPosition.x + halfWidth;
    const top = currentPosition.y;
    const bottom = currentPosition.y + elementSize.height;
    const centerY = currentPosition.y + halfHeight;

    // Container snap points
    const cw = containerSize.width;
    const ch = containerSize.height;
    const cwHalf = cw / 2;
    const chHalf = ch / 2;

    // Container X snapping - prioritize closest snap
    if (!didSnapX && Math.abs(left) <= SNAP_THRESHOLD) {
      snappedX = 0;
      didSnapX = true;
    }
    if (!didSnapX && Math.abs(right - cw) <= SNAP_THRESHOLD) {
      snappedX = cw - elementSize.width;
      didSnapX = true;
    }
    if (!didSnapX && Math.abs(centerX - cwHalf) <= SNAP_THRESHOLD) {
      snappedX = cwHalf - halfWidth;
      didSnapX = true;
    }

    // Container Y snapping
    if (!didSnapY && Math.abs(top) <= SNAP_THRESHOLD) {
      snappedY = 0;
      didSnapY = true;
    }
    if (!didSnapY && Math.abs(bottom - ch) <= SNAP_THRESHOLD) {
      snappedY = ch - elementSize.height;
      didSnapY = true;
    }
    if (!didSnapY && Math.abs(centerY - chHalf) <= SNAP_THRESHOLD) {
      snappedY = chHalf - halfHeight;
      didSnapY = true;
    }

    // Element-to-element snapping - use cached data
    const others = otherElementsRef.current;
    for (let i = 0; i < others.length && (!didSnapX || !didSnapY); i++) {
      const other = others[i];
      
      // X snapping
      if (!didSnapX) {
        if (Math.abs(left - other.left) <= SNAP_THRESHOLD) {
          snappedX = other.left;
          didSnapX = true;
        } else if (Math.abs(left - other.right) <= SNAP_THRESHOLD) {
          snappedX = other.right;
          didSnapX = true;
        } else if (Math.abs(right - other.right) <= SNAP_THRESHOLD) {
          snappedX = other.right - elementSize.width;
          didSnapX = true;
        } else if (Math.abs(right - other.left) <= SNAP_THRESHOLD) {
          snappedX = other.left - elementSize.width;
          didSnapX = true;
        } else if (Math.abs(centerX - other.centerX) <= SNAP_THRESHOLD) {
          snappedX = other.centerX - halfWidth;
          didSnapX = true;
        }
      }
      
      // Y snapping
      if (!didSnapY) {
        if (Math.abs(top - other.top) <= SNAP_THRESHOLD) {
          snappedY = other.top;
          didSnapY = true;
        } else if (Math.abs(top - other.bottom) <= SNAP_THRESHOLD) {
          snappedY = other.bottom;
          didSnapY = true;
        } else if (Math.abs(bottom - other.bottom) <= SNAP_THRESHOLD) {
          snappedY = other.bottom - elementSize.height;
          didSnapY = true;
        } else if (Math.abs(bottom - other.top) <= SNAP_THRESHOLD) {
          snappedY = other.top - elementSize.height;
          didSnapY = true;
        } else if (Math.abs(centerY - other.centerY) <= SNAP_THRESHOLD) {
          snappedY = other.centerY - halfHeight;
          didSnapY = true;
        }
      }
    }

    return { x: snappedX, y: snappedY, snappedX: didSnapX, snappedY: didSnapY };
  }, [activeElementId, containerSize.width, containerSize.height]);

  return { calculateSnapPosition };
}