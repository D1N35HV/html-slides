import React, { useMemo, useRef, useEffect, memo, useCallback } from 'react';
import { useStore } from '../store/index';
import type { SlideElement } from '../store/sliceTypes';

interface AlignmentGuidesProps {
  activeElementId?: string;
  activePosition?: { x: number; y: number };
  activeSize?: { width: number; height: number };
  containerSize?: { width: number; height: number };
}

interface Guide {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  alignmentType: 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle';
  elementId?: string;
}

const SNAP_THRESHOLD = 8; // pixels - slightly tighter for snappier feel
const GUIDE_COLOR = '#FF6B6B'; // Red color like PowerPoint
const GUIDE_CENTER_COLOR = '#007AFF'; // Blue for center guides

export function AlignmentGuides({ 
  activeElementId, 
  activePosition, 
  activeSize,
  containerSize = { width: 1024, height: 768 }
}: AlignmentGuidesProps) {
  const { slides, currentSlide } = useStore();
  
  const currentSlideData = slides[currentSlide];
  const elements = currentSlideData?.elements || [];
  
  // Cache elements data to avoid recalculation
  const otherElementsData = useMemo(() => {
    if (!activeElementId) return [];
    return elements
      .filter((element: SlideElement) => element.id !== activeElementId)
      .map((element: SlideElement) => ({
        id: element.id,
        left: element.position.x,
        right: element.position.x + element.size.width,
        top: element.position.y,
        bottom: element.position.y + element.size.height,
        centerX: element.position.x + element.size.width / 2,
        centerY: element.position.y + element.size.height / 2,
      }));
  }, [elements, activeElementId]);
  
  const guides = useMemo(() => {
    if (!activeElementId || !activePosition || !activeSize) {
      return [];
    }

    const guides: Guide[] = [];
    const activeElement = {
      left: activePosition.x,
      right: activePosition.x + activeSize.width,
      top: activePosition.y,
      bottom: activePosition.y + activeSize.height,
      centerX: activePosition.x + activeSize.width / 2,
      centerY: activePosition.y + activeSize.height / 2,
    };

    // Container snap points - check all at once for efficiency
    const containerWidth = containerSize.width;
    const containerHeight = containerSize.height;
    const halfWidth = containerWidth / 2;
    const halfHeight = containerHeight / 2;

    // Vertical container guides (more efficient single-pass check)
    if (Math.abs(activeElement.left) <= SNAP_THRESHOLD) {
      guides.push({ type: 'vertical', position: 0, start: 0, end: containerHeight, alignmentType: 'left' });
    }
    if (Math.abs(activeElement.right - containerWidth) <= SNAP_THRESHOLD) {
      guides.push({ type: 'vertical', position: containerWidth, start: 0, end: containerHeight, alignmentType: 'right' });
    }
    if (Math.abs(activeElement.centerX - halfWidth) <= SNAP_THRESHOLD) {
      guides.push({ type: 'vertical', position: halfWidth, start: 0, end: containerHeight, alignmentType: 'center' });
    }

    // Horizontal container guides
    if (Math.abs(activeElement.top) <= SNAP_THRESHOLD) {
      guides.push({ type: 'horizontal', position: 0, start: 0, end: containerWidth, alignmentType: 'top' });
    }
    if (Math.abs(activeElement.bottom - containerHeight) <= SNAP_THRESHOLD) {
      guides.push({ type: 'horizontal', position: containerHeight, start: 0, end: containerWidth, alignmentType: 'bottom' });
    }
    if (Math.abs(activeElement.centerY - halfHeight) <= SNAP_THRESHOLD) {
      guides.push({ type: 'horizontal', position: halfHeight, start: 0, end: containerWidth, alignmentType: 'middle' });
    }

    // Element-to-element alignment - optimized loop
    for (let i = 0; i < otherElementsData.length; i++) {
      const other = otherElementsData[i];
      
      // Vertical alignments - left edge
      if (Math.abs(activeElement.left - other.left) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical', position: other.left,
          start: Math.max(0, Math.min(activeElement.top, other.top) - 10),
          end: Math.min(containerHeight, Math.max(activeElement.bottom, other.bottom) + 10),
          alignmentType: 'left', elementId: other.id,
        });
      }
      if (Math.abs(activeElement.left - other.right) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical', position: other.right,
          start: Math.max(0, Math.min(activeElement.top, other.top) - 10),
          end: Math.min(containerHeight, Math.max(activeElement.bottom, other.bottom) + 10),
          alignmentType: 'left', elementId: other.id,
        });
      }
      
      // Vertical alignments - right edge
      if (Math.abs(activeElement.right - other.right) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical', position: other.right,
          start: Math.max(0, Math.min(activeElement.top, other.top) - 10),
          end: Math.min(containerHeight, Math.max(activeElement.bottom, other.bottom) + 10),
          alignmentType: 'right', elementId: other.id,
        });
      }
      if (Math.abs(activeElement.right - other.left) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical', position: other.left,
          start: Math.max(0, Math.min(activeElement.top, other.top) - 10),
          end: Math.min(containerHeight, Math.max(activeElement.bottom, other.bottom) + 10),
          alignmentType: 'right', elementId: other.id,
        });
      }
      
      // Vertical alignments - center
      if (Math.abs(activeElement.centerX - other.centerX) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'vertical', position: other.centerX,
          start: Math.max(0, Math.min(activeElement.top, other.top) - 10),
          end: Math.min(containerHeight, Math.max(activeElement.bottom, other.bottom) + 10),
          alignmentType: 'center', elementId: other.id,
        });
      }

      // Horizontal alignments - top edge
      if (Math.abs(activeElement.top - other.top) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal', position: other.top,
          start: Math.max(0, Math.min(activeElement.left, other.left) - 10),
          end: Math.min(containerWidth, Math.max(activeElement.right, other.right) + 10),
          alignmentType: 'top', elementId: other.id,
        });
      }
      if (Math.abs(activeElement.top - other.bottom) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal', position: other.bottom,
          start: Math.max(0, Math.min(activeElement.left, other.left) - 10),
          end: Math.min(containerWidth, Math.max(activeElement.right, other.right) + 10),
          alignmentType: 'top', elementId: other.id,
        });
      }
      
      // Horizontal alignments - bottom edge
      if (Math.abs(activeElement.bottom - other.bottom) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal', position: other.bottom,
          start: Math.max(0, Math.min(activeElement.left, other.left) - 10),
          end: Math.min(containerWidth, Math.max(activeElement.right, other.right) + 10),
          alignmentType: 'bottom', elementId: other.id,
        });
      }
      if (Math.abs(activeElement.bottom - other.top) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal', position: other.top,
          start: Math.max(0, Math.min(activeElement.left, other.left) - 10),
          end: Math.min(containerWidth, Math.max(activeElement.right, other.right) + 10),
          alignmentType: 'bottom', elementId: other.id,
        });
      }
      
      // Horizontal alignments - center
      if (Math.abs(activeElement.centerY - other.centerY) <= SNAP_THRESHOLD) {
        guides.push({
          type: 'horizontal', position: other.centerY,
          start: Math.max(0, Math.min(activeElement.left, other.left) - 10),
          end: Math.min(containerWidth, Math.max(activeElement.right, other.right) + 10),
          alignmentType: 'middle', elementId: other.id,
        });
      }
    }

    return guides;
  }, [activeElementId, activePosition?.x, activePosition?.y, activeSize?.width, activeSize?.height, otherElementsData, containerSize.width, containerSize.height]);

  if (guides.length === 0) {
    return null;
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none" 
      style={{ zIndex: 1000, willChange: 'contents' }}
    >
      {guides.map((guide, index) => {
        const isCenter = guide.alignmentType === 'center' || guide.alignmentType === 'middle';
        const color = isCenter ? GUIDE_CENTER_COLOR : GUIDE_COLOR;
        
        return (
          <div
            key={`${guide.type}-${guide.position}-${index}`}
            className="absolute"
            style={{
              backgroundColor: color,
              willChange: 'transform',
              transform: 'translateZ(0)', // GPU acceleration
              ...(guide.type === 'vertical'
                ? {
                    left: guide.position,
                    top: guide.start,
                    width: 1,
                    height: guide.end - guide.start,
                  }
                : {
                    left: guide.start,
                    top: guide.position,
                    width: guide.end - guide.start,
                    height: 1,
                  }),
            }}
          />
        );
      })}
    </div>
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
  const { slides, currentSlide } = useStore();
  
  // Cache other elements data
  const otherElementsRef = useRef<Array<{
    left: number; right: number; centerX: number;
    top: number; bottom: number; centerY: number;
  }>>([]);
  
  // Update cache when elements change
  useEffect(() => {
    const currentSlideData = slides[currentSlide];
    const elements = currentSlideData?.elements || [];
    
    otherElementsRef.current = elements
      .filter((element: SlideElement) => element.id !== activeElementId)
      .map((element: SlideElement) => ({
        left: element.position.x,
        right: element.position.x + element.size.width,
        centerX: element.position.x + element.size.width / 2,
        top: element.position.y,
        bottom: element.position.y + element.size.height,
        centerY: element.position.y + element.size.height / 2,
      }));
  }, [slides, currentSlide, activeElementId]);
  
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