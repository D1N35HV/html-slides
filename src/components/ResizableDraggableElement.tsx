import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { useStore } from '../store/index';
import { useShallow } from 'zustand/react/shallow';
import { useAlignmentGuidesStore } from '../store/alignmentGuidesStore';
import { ContextMenu } from './ContextMenu';
import { SelectionBox } from './SelectionBox';
import { isLineShape } from './ShapeElement';
import { useRevealScale, adjustDeltaForScale, getRevealContainer, getRevealScale } from '../utils/scaling';
import { useAlignmentSnap } from './AlignmentGuides';
import { useCropModeStore } from '../store/useCropModeStore';

interface ResizableDraggableElementProps {
  elementId: string;
  children: React.ReactNode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation?: number;
  zIndex?: number;
  isEditable?: boolean;
}

export function ResizableDraggableElement({
  elementId,
  children,
  position,
  size,
  rotation = 0,
  zIndex,
  isEditable = true
}: ResizableDraggableElementProps) {
  const updateElementPosition = useStore((s) => s.updateElementPosition);
  const updateElementSize = useStore((s) => s.updateElementSize);
  const updateElementRotation = useStore((s) => s.updateElementRotation);
  const setSelectedElement = useStore((s) => s.setSelectedElement);
  const setSelectedElements = useStore((s) => s.setSelectedElements);
  const toggleElementSelection = useStore((s) => s.toggleElementSelection);
  const updateMultipleElementPositions = useStore((s) => s.updateMultipleElementPositions);
  const setGlobalDragState = useStore((s) => s.setGlobalDragState);
  const editingElementId = useStore((s) => s.editingElementId);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const selectedElementIds = useStore(useShallow((s) => s.selectedElementIds));
  const setAlignmentGuides = useAlignmentGuidesStore((s) => s.setActive);
  const clearAlignmentGuides = useAlignmentGuidesStore((s) => s.clear);
  const { cropModeElementId } = useCropModeStore();

  const isCropMode = cropModeElementId === elementId;
  const hideHandles = isCropMode;

  // Detect line shapes so SelectionBox can collapse to E/W-only resize.
  const lineMode = useStore((s) => {
    const el = s.slides[s.currentSlide]?.elements.find((e) => e.id === elementId);
    if (!el || el.type !== 'shape') return false;
    return isLineShape((el as { shapeType?: any }).shapeType);
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [isRotating, setIsRotating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const nodeRef = useRef<HTMLDivElement>(null);

  // Get the current scale factor for smooth scaling-aware interactions
  const scale = useRevealScale();

  // Get the alignment snap hook
  const { calculateSnapPosition } = useAlignmentSnap(elementId);

  // Ensure size and position are always valid
  const validSize = size || { width: 200, height: 100 };
  const validPosition = position || { x: 50, y: 50 };
  const validRotation = rotation || 0;



  // Ensure component is properly mounted before enabling interactions
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const initialGroupPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  // DOM nodes of OTHER group members (not the dragged element) plus their
  // starting positions. Populated at pointerdown so we can update their
  // transforms imperatively during drag without re-querying the DOM.
  const groupNodesRef = useRef<Array<{ node: HTMLElement; startX: number; startY: number }>>([]);

  // RAF handle (shared with the pointer-move path).
  const rafRef = useRef<number | null>(null);

  // Drag state lives in a ref so pointermove never triggers React renders.
  // The element's position is updated directly on the DOM node via
  // node.style.transform; React only gets involved on pointerup, when we
  // commit the final position to the store.
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPosX: number;
    startPosY: number;
    scale: number;
    lastDx: number;
    lastDy: number;
    moved: boolean;
    rafPending: boolean;
  } | null>(null);

  // Keep validPosition readable from the layout-effect closure without
  // re-binding pointer handlers on every render.
  const validPositionRef = useRef(validPosition);
  validPositionRef.current = validPosition;

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Keep the DOM node's transform in sync with the committed position from
  // the store. While a drag is in progress we leave the DOM transform alone
  // — the pointer-move handler owns it. Once the drag ends and the store
  // commits the new position, this effect re-applies the committed value.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    if (dragStateRef.current) return;
    node.style.transform = `translate(${validPosition.x}px, ${validPosition.y}px)`;
  }, [validPosition.x, validPosition.y]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditable || isResizing || isRotating || !isMounted || editingElementId || isCropMode) return;
    if (e.button !== 0) return; // primary button only

    const target = e.target as Element;
    // Don't hijack interactions started on resize/rotate handles. Handles are
    // identified by data-attributes (see SelectionBox) — the handle's own
    // onMouseDown starts a document-level resize/rotate loop, and we must not
    // start a drag in parallel (which would fight for the element transform).
    if (
      target.closest?.('[data-resize-handle]') ||
      target.closest?.('[data-rotation-handle]')
    ) {
      return;
    }

    e.stopPropagation();

    // Do NOT call setPointerCapture yet. Chromium retargets click/dblclick
    // events to the capturing element, which would break the CKEditor
    // double-click-to-edit flow on inner content. We capture later, inside
    // pointermove, once the drag threshold has been exceeded — by then we
    // know this is actually a drag and not a click.

    // Read scale fresh from DOM at drag start so we never use a stale value.
    const container = getRevealContainer();
    const freshScale = container ? getRevealScale(container) : scale;

    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: validPosition.x,
      startPosY: validPosition.y,
      scale: freshScale || 1,
      lastDx: 0,
      lastDy: 0,
      moved: false,
      rafPending: false,
    };

    // Cache initial positions for group move (read once, avoid re-reading per frame).
    if (selectedElementIds && selectedElementIds.includes(elementId) && selectedElementIds.length > 1) {
      const store = (useStore as any).getState();
      const slide = store.slides[store.currentSlide];
      const positions: Record<string, { x: number; y: number }> = {};
      const nodes: Array<{ node: HTMLElement; startX: number; startY: number }> = [];
      slide.elements
        .filter((el: any) => selectedElementIds.includes(el.id))
        .forEach((el: any) => {
          positions[el.id] = { ...el.position };
          if (el.id !== elementId) {
            const node = document.querySelector(
              `[data-element-id="${el.id}"]`
            ) as HTMLElement | null;
            if (node) nodes.push({ node, startX: el.position.x, startY: el.position.y });
          }
        });
      initialGroupPositionsRef.current = positions;
      groupNodesRef.current = nodes;
    } else {
      initialGroupPositionsRef.current = { [elementId]: { ...validPosition } };
      groupNodesRef.current = [];
    }
  }, [isEditable, isResizing, isRotating, isMounted, editingElementId, isCropMode, scale, validPosition.x, validPosition.y, selectedElementIds, elementId]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;

    const deltaScreenX = e.clientX - ds.startClientX;
    const deltaScreenY = e.clientY - ds.startClientY;
    const dx = deltaScreenX / ds.scale;
    const dy = deltaScreenY / ds.scale;

    // Drag threshold: don't register as a drag until the pointer moves more
    // than ~3 screen pixels. Prevents accidental drags on click and lets the
    // click handler fire normally for short clicks.
    if (!ds.moved) {
      if (Math.abs(deltaScreenX) <= 3 && Math.abs(deltaScreenY) <= 3) return;
      ds.moved = true;
      setHasMoved(true);
      setIsDragging(true);
      setGlobalDragState(true, true);
      setAlignmentGuides(elementId, validPositionRef.current, validSize);

      // Capture the pointer now that this is confirmed to be a drag — deferred
      // from pointerdown so click/dblclick on short clicks fires on the real
      // target (e.g. the CKEditor inner div) instead of being retargeted here.
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }

    ds.lastDx = dx;
    ds.lastDy = dy;

    // Direct-to-DOM transform — zero React work per frame.
    const node = nodeRef.current;
    if (node) {
      node.style.transform = `translate(${ds.startPosX + dx}px, ${ds.startPosY + dy}px)`;
    }
    // Move the rest of the multi-selection group in lock-step.
    for (const g of groupNodesRef.current) {
      g.node.style.transform = `translate(${g.startX + dx}px, ${g.startY + dy}px)`;
    }

    // RAF-coalesce snap calc + guide publish (60Hz max).
    if (!ds.rafPending) {
      ds.rafPending = true;
      rafRef.current = requestAnimationFrame(() => {
        const s = dragStateRef.current;
        rafRef.current = null;
        if (!s) return;
        s.rafPending = false;
        const rawPos = { x: s.startPosX + s.lastDx, y: s.startPosY + s.lastDy };
        const snapped = calculateSnapPosition(rawPos, validSize);
        setAlignmentGuides(elementId, snapped, validSize);
      });
    }
  }, [calculateSnapPosition, validSize, elementId, setAlignmentGuides, setGlobalDragState]);

  const endDrag = useCallback((pointerId: number, hostEl: HTMLElement | null) => {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== pointerId) return;

    if (hostEl && hostEl.hasPointerCapture?.(pointerId)) {
      try { hostEl.releasePointerCapture(pointerId); } catch { /* noop */ }
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const moved = ds.moved;

    if (moved) {
      const rawPos = { x: ds.startPosX + ds.lastDx, y: ds.startPosY + ds.lastDy };
      const finalPos = calculateSnapPosition(rawPos, validSize);
      const isGroup = selectedElementIds && selectedElementIds.length > 1 && selectedElementIds.includes(elementId);
      if (isGroup) {
        const deltaX = finalPos.x - validPositionRef.current.x;
        const deltaY = finalPos.y - validPositionRef.current.y;
        updateMultipleElementPositions(selectedElementIds, { dx: deltaX, dy: deltaY });
      } else {
        updateElementPosition(elementId, finalPos);
      }
    }

    // Clear the ref FIRST so the layout effect, when it runs on the upcoming
    // re-render, takes over the transform again.
    dragStateRef.current = null;
    groupNodesRef.current = [];

    clearAlignmentGuides();

    // Hold isDragging/hasMoved briefly so an onClick that fires right after
    // pointerup doesn't treat a drag as a selection click.
    setTimeout(() => {
      setIsDragging(false);
      setGlobalDragState(true, moved);
      setTimeout(() => {
        setHasMoved(false);
        setGlobalDragState(false, false);
      }, 100);
    }, 200);
  }, [calculateSnapPosition, validSize, selectedElementIds, elementId, updateElementPosition, updateMultipleElementPositions, clearAlignmentGuides, setGlobalDragState]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e.pointerId, e.currentTarget);
  }, [endDrag]);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e.pointerId, e.currentTarget);
  }, [endDrag]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!isEditable) return;

    e.preventDefault();
    e.stopPropagation();

    // Get the absolute position relative to the viewport
    const rect = nodeRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenuPosition({
        x: e.clientX,
        y: e.clientY
      });
      setShowContextMenu(true);
    }
  }, [isEditable]);

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  const handleElementClick = useCallback((e: React.MouseEvent) => {
    // Always stop propagation to prevent slide click events
    e.stopPropagation();

    if (!isEditable || isDragging || hasMoved) return;

    // Ctrl/Cmd for toggle selection
    if (e.metaKey || e.ctrlKey) {
      toggleElementSelection(elementId);
    } else if (selectedElementIds.length > 1 && !selectedElementIds.includes(elementId)) {
      // Clicking outside current multi selection selects only this
      setSelectedElement(elementId);
    } else {
      setSelectedElement(elementId);
    }

    // Reset the hasMoved flag for future interactions
    setHasMoved(false);
  }, [isEditable, isDragging, hasMoved, elementId, setSelectedElement, toggleElementSelection, selectedElementIds]);

  const handleElementMouseDown = useCallback((e: React.MouseEvent) => {
    // Reset hasMoved state when starting a new interaction (not on resize handles or rotation handle)
    if (!e.target || (!(e.target as Element).classList.contains('resize-handle') && !(e.target as Element).classList.contains('rotation-handle'))) {
      setHasMoved(false);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    // --- Sample code: getCoordinates for robust anchor calculation ---
    function getCoordinates(size, angle) {
      let radians = (Math.PI / -180) * angle;
      let cos = Math.cos(radians);
      let sin = Math.sin(radians);
      let x1 = size.left;
      let y1 = size.top;
      let x2 = x1 + size.width;
      let y2 = y1;
      let x3 = x1 + size.width;
      let y3 = y1 + size.height;
      let x4 = x1;
      let y4 = y1 + size.height;
      let px = x1 + size.width / 2;
      let py = y1 + size.height / 2;
      let ax = parseInt(cos * (x1 - px) + sin * (y1 - py) + px);
      let ay = parseInt(cos * (y1 - py) - sin * (x1 - px) + py);
      let bx = parseInt(cos * (x2 - px) + sin * (y2 - py) + px);
      let by = parseInt(cos * (y2 - py) - sin * (x2 - px) + py);
      let cx = parseInt(cos * (x3 - px) + sin * (y3 - py) + px);
      let cy = parseInt(cos * (y3 - py) - sin * (x3 - px) + py);
      let dx = parseInt(cos * (x4 - px) + sin * (y4 - py) + px);
      let dy = parseInt(cos * (y4 - py) - sin * (x4 - px) + py);
      return { ax, ay, bx, by, cx, cy, dx, dy, px, py };
    }
    if (!isMounted || !isEditable) return;
    e.preventDefault();
    e.stopPropagation();

    const node = nodeRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRotation = validRotation;

    // --- ROTATION LOGIC (sample code strategy) ---
    if (direction === 'rotate') {
      setIsRotating(true);
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startAngle = Math.atan2(startY - centerY, startX - centerX) * (180 / Math.PI);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
        let newRotation = startRotation + (currentAngle - startAngle);

        // Snap to 15deg increments if shift is held
        if (moveEvent.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }

        updateElementRotation(elementId, newRotation);
      };

      const handleMouseUp = () => {
        setIsRotating(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return;
    }

    // --- RESIZE LOGIC (sample code strategy) ---
    setIsResizing(true);
    setResizeDirection(direction);

    // Show alignment guides when starting to resize
    setAlignmentGuides(elementId, validPosition, validSize);

    const startSize = { ...validSize };
    const startPosition = { ...validPosition };
    const aspectRatio = startSize.width / startSize.height;

    // Map handle direction to anchor position (sample code logic)
    function getAnchorKey(direction, rotation) {
      // Sample code uses fixToPos, which is mapped by handle and rotation
      // We'll use the same mapping as the sample
      const rot = ((rotation % 360) + 360) % 360;
      if (rot === 90) {
        switch (direction) {
          case 'se': return 'ax';
          case 'sw': return 'dx';
          case 'ne': return 'bx';
          case 'nw': return 'cx';
          case 'n': return 'ax';
          case 's': return 'bx';
          case 'e': return 'bx';
          case 'w': return 'ax';
          default: return 'ax';
        }
      } else if (rot === 270) {
        switch (direction) {
          case 'se': return 'cx';
          case 'sw': return 'bx';
          case 'ne': return 'dx';
          case 'nw': return 'ax';
          case 'n': return 'bx';
          case 's': return 'ax';
          case 'e': return 'ax';
          case 'w': return 'bx';
          default: return 'bx';
        }
      } else if (rot === 180) {
        switch (direction) {
          case 'se': return 'cx';
          case 'sw': return 'dx';
          case 'ne': return 'bx';
          case 'nw': return 'ax';
          case 'n': return 'ax';
          case 's': return 'dx';
          case 'e': return 'dx';
          case 'w': return 'bx';
          default: return 'cx';
        }
      } else {
        // Default mapping for 0 deg
        switch (direction) {
          case 'se': return 'ax';
          case 'sw': return 'bx';
          case 'ne': return 'dx';
          case 'nw': return 'cx';
          case 'n': return 'cx';
          case 'e': return 'ax';
          case 's': return 'ax';
          case 'w': return 'bx';
          default: return 'ax';
        }
      }
    }
    // Sample code: explicit mapping from handle to transform origin
    function getTransformOrigin(direction) {
      switch (direction) {
        case 'se':
        case 'e':
        case 's':
          return 'top left';
        case 'sw':
        case 'w':
          return 'top right';
        case 'ne':
          return 'bottom left';
        case 'nw':
        case 'n':
          return 'bottom right';
        default:
          return 'top left';
      }
    }

    // Use sample code logic for anchor calculation
    const anchorKey = getAnchorKey(direction, startRotation);
    const anchorCoordsRaw = getCoordinates({ left: startPosition.x, top: startPosition.y, width: startSize.width, height: startSize.height }, startRotation);
    // Map x/y from anchorKey
    const anchorYKey = anchorKey.replace('x', 'y');
    const anchorCoords = { x: anchorCoordsRaw[anchorKey], y: anchorCoordsRaw[anchorYKey] };

    // Set transform origin for the node (sample code logic)
    if (node) {
      node.style.transformOrigin = getTransformOrigin(direction);
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const { deltaX, deltaY } = adjustDeltaForScale(moveEvent.clientX - startX, moveEvent.clientY - startY, scale);

      // Rotation-aware resize logic (sample code)
      const rad = (startRotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const rotatedDeltaX = deltaX * cos + deltaY * sin;
      const rotatedDeltaY = -deltaX * sin + deltaY * cos;

      let newWidth = startSize.width;
      let newHeight = startSize.height;
      let newX = startPosition.x;
      let newY = startPosition.y;

      switch (direction) {
        case 'se':
          newWidth = startSize.width + rotatedDeltaX;
          newHeight = startSize.height + rotatedDeltaY;
          break;
        case 'sw':
          newWidth = startSize.width - rotatedDeltaX;
          newHeight = startSize.height + rotatedDeltaY;
          newX = startPosition.x + rotatedDeltaX;
          break;
        case 'ne':
          newWidth = startSize.width + rotatedDeltaX;
          newHeight = startSize.height - rotatedDeltaY;
          newY = startPosition.y + rotatedDeltaY;
          break;
        case 'nw':
          newWidth = startSize.width - rotatedDeltaX;
          newHeight = startSize.height - rotatedDeltaY;
          newX = startPosition.x + rotatedDeltaX;
          newY = startPosition.y + rotatedDeltaY;
          break;
        case 'n':
          newHeight = startSize.height - rotatedDeltaY;
          newY = startPosition.y + rotatedDeltaY;
          break;
        case 's':
          newHeight = startSize.height + rotatedDeltaY;
          break;
        case 'e':
          newWidth = startSize.width + rotatedDeltaX;
          break;
        case 'w':
          newWidth = startSize.width - rotatedDeltaX;
          newX = startPosition.x + rotatedDeltaX;
          break;
        default:
          break;
      }

      newWidth = Math.max(30, newWidth);
      newHeight = Math.max(30, newHeight);

      if (moveEvent.shiftKey) {
        if (direction === 'n' || direction === 's') {
          newWidth = newHeight * aspectRatio;
        } else if (direction === 'e' || direction === 'w') {
          newHeight = newWidth / aspectRatio;
        } else {
          if (Math.abs(newWidth - startSize.width) > Math.abs(newHeight - startSize.height)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
        }
      }

      // Use sample code logic for anchor calculation after resize
      const newAnchorKey = getAnchorKey(direction, startRotation);
      const newAnchorCoordsRaw = getCoordinates({ left: newX, top: newY, width: newWidth, height: newHeight }, startRotation);
      const newAnchorYKey = newAnchorKey.replace('x', 'y');
      const newAnchorCoords = { x: newAnchorCoordsRaw[newAnchorKey], y: newAnchorCoordsRaw[newAnchorYKey] };

      // Offset between old and new anchor
      const anchorDeltaX = anchorCoords.x - newAnchorCoords.x;
      const anchorDeltaY = anchorCoords.y - newAnchorCoords.y;

      // Adjust position so anchor stays fixed
      newX += anchorDeltaX;
      newY += anchorDeltaY;

      // Calculate snapped position for the new size and position
      const snappedPosition = calculateSnapPosition({ x: newX, y: newY }, { width: newWidth, height: newHeight });

      // Update alignment guides with new position and size
      setAlignmentGuides(elementId, snappedPosition, { width: newWidth, height: newHeight });

      updateElementSize(elementId, { width: newWidth, height: newHeight });
      updateElementPosition(elementId, snappedPosition);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection('');
      clearAlignmentGuides(); // Clear guides when resize stops
      if (node) node.style.transformOrigin = 'center center';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [elementId, validSize, validPosition, validRotation, updateElementSize, updateElementPosition, updateElementRotation, isMounted, isEditable, scale, setAlignmentGuides, clearAlignmentGuides, calculateSnapPosition]);



  const resizeHandles = [
    { direction: 'nw', className: 'top-0 left-0 cursor-nw-resize' },
    { direction: 'n', className: 'top-0 left-1/2 transform -translate-x-1/2 cursor-n-resize' },
    { direction: 'ne', className: 'top-0 right-0 cursor-ne-resize' },
    { direction: 'e', className: 'top-1/2 right-0 transform -translate-y-1/2 cursor-e-resize' },
    { direction: 'se', className: 'bottom-0 right-0 cursor-se-resize' },
    { direction: 's', className: 'bottom-0 left-1/2 transform -translate-x-1/2 cursor-s-resize' },
    { direction: 'sw', className: 'bottom-0 left-0 cursor-sw-resize' },
    { direction: 'w', className: 'top-1/2 left-0 transform -translate-y-1/2 cursor-w-resize' },
  ];

  // Rotation handle - positioned above the element
  const rotationHandle = {
    direction: 'rotate',
    className: 'cursor-grab active:cursor-grabbing',
    style: {
      top: `${-35 / scale}px`,
      left: '50%',
      transform: 'translateX(-50%)',
    }
  };

  return (
    <>
      <div
        ref={nodeRef}
        data-element-id={elementId}
        className="absolute"
        onContextMenu={handleContextMenu}
        onClick={handleElementClick}
        onMouseDown={handleElementMouseDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          width: validSize.width,
          height: validSize.height,
          // Transform (translate for position) is managed imperatively via a
          // layout effect + the pointer-move handler. Do not set transform
          // here — it would fight with the direct DOM mutation during drag.
          opacity: isMounted ? 1 : 0.5,
          transition: 'opacity 0.2s ease-in-out',
          pointerEvents: isEditable ? 'auto' : 'none',
          zIndex: zIndex || 1,
          // Disable native touch gestures (scroll/pinch) on the element so
          // pointer events get full control during drag on touch devices.
          touchAction: 'none',
          // Promote selected element to its own compositor layer so dragging
          // moves a cached bitmap instead of repainting per frame. Scoped to
          // the selected element to avoid N compositor layers on busy slides.
          willChange: (selectedElementId === elementId || selectedElementIds.includes(elementId)) ? 'transform' : 'auto',
        }}
      >
          <div className={`${isEditable ? 'group' : ''} relative h-full w-full ${(!isEditable || editingElementId) ? 'cursor-default' : 'cursor-move'}`}
            style={{
              width: '100%',
              height: '100%',
              transform: `rotate(${validRotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {/* Use the new SelectionBox component */}
            <SelectionBox
              isSelected={selectedElementId === elementId || selectedElementIds.includes(elementId)}
              isMultiSelected={selectedElementIds.length > 1 && selectedElementIds.includes(elementId)}
              isDragging={isDragging}
              scale={scale}
              rotation={rotation}
              onResizeStart={handleMouseDown}
              onRotateStart={(e) => handleMouseDown(e, 'rotate')}
              hideHandles={isCropMode}
              lineMode={lineMode}
            >
              {/* Content container */}
              <div
                className="h-full w-full content-area"
                style={{
                  pointerEvents: (isDragging || hasMoved) ? 'none' : 'auto',
                  position: 'relative',
                  zIndex: 10,
                  cursor: 'inherit'
                }}
              >
                {children}
              </div>
            </SelectionBox>
          </div>
        </div>

      {/* Context Menu */}
      {showContextMenu && (
        <ContextMenu
          elementId={elementId}
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onClose={handleCloseContextMenu}
        />
      )}
    </>
  );
}