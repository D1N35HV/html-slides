import React from 'react';

interface SelectionBoxProps {
  isSelected: boolean;
  isMultiSelected?: boolean;
  scale?: number;
  children: React.ReactNode;
  onResizeStart?: (e: React.MouseEvent, direction: string) => void;
  onRotateStart?: (e: React.MouseEvent) => void;
}

export function SelectionBox({ 
  isSelected, 
  isMultiSelected = false, 
  scale = 1, 
  children,
  onResizeStart,
  onRotateStart
}: SelectionBoxProps) {
  const handleSize = Math.max(8, 10 / scale);
  const borderWidth = Math.max(1, 2 / scale);
  
  // Corner handle positions and their resize directions
  const cornerHandles = [
    { position: 'top-left', className: '-top-1 -left-1', direction: 'nw', cursor: 'nw-resize' },
    { position: 'top-right', className: '-top-1 -right-1', direction: 'ne', cursor: 'ne-resize' },
    { position: 'bottom-left', className: '-bottom-1 -left-1', direction: 'sw', cursor: 'sw-resize' },
    { position: 'bottom-right', className: '-bottom-1 -right-1', direction: 'se', cursor: 'se-resize' }
  ];

  // Edge handle positions and their resize directions
  const edgeHandles = [
    { position: 'top', className: '-top-1 left-1/2 -translate-x-1/2', direction: 'n', cursor: 'n-resize' },
    { position: 'bottom', className: '-bottom-1 left-1/2 -translate-x-1/2', direction: 's', cursor: 's-resize' },
    { position: 'left', className: '-left-1 top-1/2 -translate-y-1/2', direction: 'w', cursor: 'w-resize' },
    { position: 'right', className: '-right-1 top-1/2 -translate-y-1/2', direction: 'e', cursor: 'e-resize' }
  ];

  return (
    <div className="relative w-full h-full">
      {children}
      
      {/* Selection border - uses negative inset to not affect content size */}
      {isSelected && (
        <div 
          className={`absolute pointer-events-none transition-all duration-200 ${
            isMultiSelected 
              ? 'border-purple-400' 
              : 'border-blue-400'
          }`}
          style={{
            top: `-${borderWidth}px`,
            left: `-${borderWidth}px`,
            right: `-${borderWidth}px`,
            bottom: `-${borderWidth}px`,
            borderWidth: `${borderWidth}px`,
            borderStyle: 'solid',
            borderRadius: '1px',
            boxSizing: 'border-box'
          }}
        />
      )}

      {/* Corner handles - small squares like in the screenshot */}
      {isSelected && cornerHandles.map(({ position, className, direction, cursor }) => (
        <div
          key={position}
          className={`absolute pointer-events-auto transition-all duration-200 ${className} ${
            isMultiSelected 
              ? 'bg-white border-purple-400' 
              : 'bg-white border-blue-400'
          } border-2 shadow-sm hover:shadow-md`}
          style={{
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            borderRadius: '1px',
            cursor
          }}
          onMouseDown={(e) => onResizeStart?.(e, direction)}
          data-resize-handle={direction}
        />
      ))}

      {/* Edge handles - smaller circles for mid-points */}
      {isSelected && edgeHandles.map(({ position, className, direction, cursor }) => (
        <div
          key={position}
          className={`absolute pointer-events-auto transition-all duration-200 ${className} ${
            isMultiSelected 
              ? 'bg-white border-purple-300' 
              : 'bg-white border-blue-300'
          } border shadow-sm hover:shadow-md`}
          style={{
            width: `${handleSize - 2}px`,
            height: `${handleSize - 2}px`,
            borderRadius: '50%',
            cursor
          }}
          onMouseDown={(e) => onResizeStart?.(e, direction)}
          data-resize-handle={direction}
        />
      ))}

      {/* Rotation handle - only for single selection, positioned at top */}
      {isSelected && !isMultiSelected && (
        <>
          {/* Rotation line - thin line connecting to rotation handle */}
          <div
            className="absolute pointer-events-none border-l border-blue-300 transition-all duration-200"
            style={{
              left: '50%',
              top: `${-25 / scale}px`,
              height: `${20 / scale}px`,
              width: '0px',
              transform: 'translateX(-50%)',
              borderWidth: `${Math.max(1, 1 / scale)}px`,
            }}
          />
          
          {/* Rotation handle - circular handle like in screenshot */}
          <div
            className="absolute pointer-events-auto bg-white border-2 border-blue-400 shadow-md hover:shadow-lg cursor-crosshair transition-all duration-200"
            style={{
              left: '50%',
              top: `${-30 / scale}px`,
              width: `${Math.max(10, 12 / scale)}px`,
              height: `${Math.max(10, 12 / scale)}px`,
              borderRadius: '50%',
              transform: 'translateX(-50%)',
            }}
            onMouseDown={(e) => onRotateStart?.(e)}
            data-rotation-handle="true"
            title="Drag to rotate"
          />
        </>
      )}
    </div>
  );
}