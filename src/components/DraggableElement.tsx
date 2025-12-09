import React, { useRef, useCallback } from 'react';
import Draggable from 'react-draggable';
import { useStore } from '../store/index.ts';
import { useRevealScale } from '../utils/scaling.ts';

interface DraggableElementProps {
  elementId: string;
  children: React.ReactNode;
  position: { x: number; y: number };
}

export function DraggableElement({ elementId, children, position }: DraggableElementProps) {
  const { updateElementPosition, editingElementId } = useStore();
  const scale = useRevealScale();
  const nodeRef = useRef<HTMLDivElement>(null);

  // React-draggable already compensates for scale when the scale prop is provided.
  // So we just use the provided x/y without additional manual scaling.
  const handleDrag = useCallback((_e: any, data: { x: number; y: number }) => {
    if (editingElementId) return;
    updateElementPosition(elementId, { x: data.x, y: data.y });
  }, [editingElementId, updateElementPosition, elementId]);

  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
  onDrag={handleDrag as any}
      disabled={!!editingElementId}
      scale={scale}
    >
      <div ref={nodeRef} className={`absolute ${editingElementId ? 'cursor-default' : 'cursor-move'}`}>
        <div className="group relative">
          {children}
        </div>
      </div>
    </Draggable>
  );
}