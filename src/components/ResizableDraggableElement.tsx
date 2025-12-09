import React, { useState, useRef, useCallback, useEffect } from 'react';
import Draggable from 'react-draggable';
import { useStore } from '../store/index.ts';
import { ContextMenu } from './ContextMenu.tsx';
import { SelectionBox } from './SelectionBox.tsx';
import { useRevealScale, adjustDeltaForScale } from '../utils/scaling.ts';
import { useAlignmentSnap } from './AlignmentGuides.tsx';

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
  const { updateElementPosition, updateElementSize, updateElementRotation, setSelectedElement, selectedElementId, selectedElementIds, toggleElementSelection, setSelectedElements, updateMultipleElementPositions, editingElementId, setGlobalDragState, setAlignmentGuides, clearAlignmentGuides } = useStore();
  
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

  // Dragging via react-draggable: its scale prop already normalizes movement, so use data.x/y directly.
  const initialGroupPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  
  // RAF-based position update for smooth 60fps dragging
  const rafRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handleDrag = useCallback((e: any, data: { x: number; y: number, deltaX?: number; deltaY?: number }) => {
    if (!isResizing && !isRotating && isMounted && isEditable && !editingElementId) {
      setHasMoved(true);
      
      // Calculate snapped position immediately for responsive feel
      const snappedPosition = calculateSnapPosition({ x: data.x, y: data.y }, validSize);
      
      // Store pending position
      pendingPositionRef.current = snappedPosition;
      
      // Throttle state updates to ~60fps using RAF
      const now = performance.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
      
      // Update guides immediately for visual feedback (they're lightweight)
      setAlignmentGuides(elementId, snappedPosition, validSize);
      
      // Throttle position updates to prevent excessive re-renders
      if (timeSinceLastUpdate >= 16) { // ~60fps
        lastUpdateTimeRef.current = now;
        
        // If multiple selected, move all by delta
        const isGroup = selectedElementIds && selectedElementIds.length > 1 && selectedElementIds.includes(elementId);
        if (isGroup) {
          const dx = snappedPosition.x - validPosition.x;
          const dy = snappedPosition.y - validPosition.y;
          updateMultipleElementPositions(selectedElementIds, { dx, dy });
        } else {
          updateElementPosition(elementId, snappedPosition);
        }
      } else if (!rafRef.current) {
        // Schedule update for next frame if not already scheduled
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const pos = pendingPositionRef.current;
          if (pos) {
            lastUpdateTimeRef.current = performance.now();
            const isGroup = selectedElementIds && selectedElementIds.length > 1 && selectedElementIds.includes(elementId);
            if (isGroup) {
              const dx = pos.x - validPosition.x;
              const dy = pos.y - validPosition.y;
              updateMultipleElementPositions(selectedElementIds, { dx, dy });
            } else {
              updateElementPosition(elementId, pos);
            }
          }
        });
      }
    }
  }, [elementId, isResizing, isRotating, isMounted, isEditable, editingElementId, updateElementPosition, updateMultipleElementPositions, selectedElementIds, setAlignmentGuides, calculateSnapPosition, validSize, validPosition]);

  const handleDragStart = useCallback((e: any, data: { x: number; y: number }) => {
    setHasMoved(false);
    lastUpdateTimeRef.current = 0; // Reset throttle on drag start
    // Only set global drag state to true if position actually changed
    const positionChanged = data.x !== validPosition.x || data.y !== validPosition.y;
    if( positionChanged ) {
      setIsDragging(true);
      setGlobalDragState(true, positionChanged);
    }
    // Show alignment guides when starting to drag
    setAlignmentGuides(elementId, validPosition, validSize);
    
    // Cache initial positions for group move
    if (selectedElementIds && selectedElementIds.includes(elementId) && selectedElementIds.length > 1) {
      const store = (useStore as any).getState();
      const slide = store.slides[store.currentSlide];
      initialGroupPositionsRef.current = Object.fromEntries(slide.elements.filter(el => selectedElementIds.includes(el.id)).map(el => [el.id, { ...el.position }]));
    } else {
      initialGroupPositionsRef.current = { [elementId]: { ...validPosition } };
    }
  }, [setGlobalDragState, validPosition.x, validPosition.y, setAlignmentGuides, elementId, validSize, selectedElementIds]);

  const handleDragStop = useCallback(() => {
    // Clear alignment guides when drag stops
    clearAlignmentGuides();
    
    // Keep track that we just finished dragging for a short period
    setTimeout(() => {
      setIsDragging(false);
      setGlobalDragState(false, hasMoved);
      // Reset hasMoved after a longer delay to ensure click events don't trigger
      setTimeout(() => {
        setHasMoved(false);
        setGlobalDragState(false, false);
      }, 100);
    }, 200); // Increased delay to prevent click events from firing immediately after drag
  }, [setGlobalDragState, hasMoved, clearAlignmentGuides]);

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
          case 'n':  return 'ax';
          case 's':  return 'bx';
          case 'e':  return 'bx';
          case 'w':  return 'ax';
          default:   return 'ax';
        }
      } else if (rot === 270) {
        switch (direction) {
          case 'se': return 'cx';
          case 'sw': return 'bx';
          case 'ne': return 'dx';
          case 'nw': return 'ax';
          case 'n':  return 'bx';
          case 's':  return 'ax';
          case 'e':  return 'ax';
          case 'w':  return 'bx';
          default:   return 'bx';
        }
      } else if (rot === 180) {
        switch (direction) {
          case 'se': return 'cx';
          case 'sw': return 'dx';
          case 'ne': return 'bx';
          case 'nw': return 'ax';
          case 'n':  return 'ax';
          case 's':  return 'dx';
          case 'e':  return 'dx';
          case 'w':  return 'bx';
          default:   return 'cx';
        }
      } else {
        // Default mapping for 0 deg
        switch (direction) {
          case 'se': return 'ax';
          case 'sw': return 'bx';
          case 'ne': return 'dx';
          case 'nw': return 'cx';
          case 'n':  return 'cx';
          case 'e':  return 'ax';
          case 's':  return 'ax';
          case 'w':  return 'bx';
          default:   return 'ax';
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
    <Draggable
      nodeRef={nodeRef}
      key={elementId}
      position={validPosition}
      onStart={handleDragStart}
      onDrag={handleDrag as any}
      onStop={handleDragStop}
      disabled={!isEditable || isResizing || isRotating || !isMounted || !!editingElementId}
      enableUserSelectHack={false}
      scale={scale}
    >
      <div 
        ref={nodeRef}
        className="absolute"
        onContextMenu={handleContextMenu}
        onClick={handleElementClick}
        onMouseDown={handleElementMouseDown}
        style={{ 
          width: validSize.width, 
          height: validSize.height,
          // Remove transform here!
          // ...other styles...
          opacity: isMounted ? 1 : 0.5,
          transition: 'opacity 0.2s ease-in-out',
          pointerEvents: isEditable ? 'auto' : 'none',
          zIndex: zIndex || 1
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
            scale={scale}
            onResizeStart={handleMouseDown}
            onRotateStart={(e) => handleMouseDown(e, 'rotate')}
          >
            {/* Content container */}
            <div 
              className="h-full w-full overflow-hidden content-area"
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
    </Draggable>
    
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