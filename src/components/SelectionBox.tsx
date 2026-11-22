import React from 'react';

interface SelectionBoxProps {
  isSelected: boolean;
  isMultiSelected?: boolean;
  isDragging?: boolean;
  scale?: number;
  children: React.ReactNode;
  onResizeStart?: (e: React.MouseEvent, direction: string) => void;
  onRotateStart?: (e: React.MouseEvent) => void;
  hideHandles?: boolean;
  /** Element rotation in degrees, used to align resize cursors to the on-screen handle direction. */
  rotation?: number;
  /**
   * Restricts the resize handles to the horizontal axis only — corners and
   * N/S edges are hidden, only E and W remain. Rotation handle is unaffected.
   * Used by stroke-based shapes (line, arrow lines) that have no meaningful
   * vertical extent.
   */
  lineMode?: boolean;
}

// Resize-cursor directions in CSS rotation order (clockwise from East).
// Each entry is the suffix used in `${dir}-resize`. Eight 45° steps: at any
// element rotation we just shift the index forward by round(rotation/45).
const CURSOR_RING = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;

function cursorForDirection(direction: string, rotation: number): string {
  const baseIndex = CURSOR_RING.indexOf(direction as typeof CURSOR_RING[number]);
  if (baseIndex < 0) return `${direction}-resize`;
  const normalized = ((rotation % 360) + 360) % 360;
  const offset = Math.round(normalized / 45) % 8;
  const screen = CURSOR_RING[(baseIndex + offset) % 8];
  return `${screen}-resize`;
}

export function SelectionBox({
  isSelected,
  isMultiSelected = false,
  isDragging = false,
  scale = 1,
  children,
  onResizeStart,
  onRotateStart,
  hideHandles = false,
  rotation = 0,
  lineMode = false
}: SelectionBoxProps) {
  const handleSize = Math.max(8, 10 / scale);
  const borderWidth = Math.max(1, 2 / scale);

  // Each handle is centered on the bounding-box edge — half outside, half
  // inside — so the dot doesn't visually crowd the element's content. Offsets
  // are derived from the rendered handle size so they scale with the canvas
  // zoom (handleSize already accounts for it).
  const cornerOffset = handleSize / 2;
  const edgeSize = Math.max(0, handleSize - 2);
  const edgeOffset = edgeSize / 2;

  // Corner handle positions and their resize directions
  const cornerHandles: Array<{ position: string; style: React.CSSProperties; direction: string }> = [
    { position: 'top-left',     style: { top: -cornerOffset,    left: -cornerOffset },                                  direction: 'nw' },
    { position: 'top-right',    style: { top: -cornerOffset,    right: -cornerOffset },                                 direction: 'ne' },
    { position: 'bottom-left',  style: { bottom: -cornerOffset, left: -cornerOffset },                                  direction: 'sw' },
    { position: 'bottom-right', style: { bottom: -cornerOffset, right: -cornerOffset },                                 direction: 'se' }
  ];

  // Edge handle positions and their resize directions. In lineMode we only
  // expose E and W — N/S edges and all four corners are dropped because the
  // shape has no meaningful vertical extent to drag.
  const edgeHandles: Array<{ position: string; style: React.CSSProperties; direction: string }> = lineMode
    ? [
        { position: 'left',  style: { left: -edgeOffset, top: '50%', transform: 'translateY(-50%)' },  direction: 'w' },
        { position: 'right', style: { right: -edgeOffset, top: '50%', transform: 'translateY(-50%)' }, direction: 'e' }
      ]
    : [
        { position: 'top',    style: { top: -edgeOffset, left: '50%', transform: 'translateX(-50%)' },    direction: 'n' },
        { position: 'bottom', style: { bottom: -edgeOffset, left: '50%', transform: 'translateX(-50%)' }, direction: 's' },
        { position: 'left',   style: { left: -edgeOffset, top: '50%', transform: 'translateY(-50%)' },    direction: 'w' },
        { position: 'right',  style: { right: -edgeOffset, top: '50%', transform: 'translateY(-50%)' },   direction: 'e' }
      ];

  const showCornerHandles = !lineMode;

  return (
    <div className="relative w-full h-full">
      {children}

      {/* Hover/drag border - shown when not selected, no resize dots.
          Line shapes have zero vertical extent and would just draw a thin
          blue rule across the line itself, so we skip it. */}
      {!isSelected && !hideHandles && !lineMode && (
        <div
          className={`absolute pointer-events-none border-blue-400 transition-opacity duration-150 ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{
            top: `-${borderWidth}px`,
            left: `-${borderWidth}px`,
            right: `-${borderWidth}px`,
            bottom: `-${borderWidth}px`,
            borderWidth: `${borderWidth}px`,
            borderStyle: 'solid',
            borderRadius: '1px',
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* Selection border. Skipped in lineMode — a 0-height bounding box would
          collapse the rectangle into a doubled rule on top of the line, which
          reads as a thicker line, not a selection. The handles + rotation
          stick alone communicate selection clearly enough. */}
      {isSelected && !lineMode && (
        <div
          className={`absolute pointer-events-none transition-all duration-200 ${isMultiSelected
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
            boxSizing: 'border-box',
            opacity: hideHandles ? 0 : 1
          }}
        />
      )}

      {/* Resize and Rotation Handles - Hidden if hideHandles is true */}
      {!hideHandles && isSelected && (
        <>
          {/* Corner handles (skipped in lineMode — line shapes have no
              meaningful vertical extent, so a corner drag would just turn into
              a thin sliver). */}
          {showCornerHandles && cornerHandles.map(({ position, style, direction }) => (
            <div
              key={position}
              className={`absolute pointer-events-auto transition-all duration-200 ${isMultiSelected
                ? 'bg-white border-purple-400'
                : 'bg-white border-blue-400'
                } border-2 shadow-sm hover:shadow-md`}
              style={{
                ...style,
                width: `${handleSize}px`,
                height: `${handleSize}px`,
                borderRadius: '1px',
                cursor: cursorForDirection(direction, rotation)
              }}
              onMouseDown={(e) => onResizeStart?.(e, direction)}
              data-resize-handle={direction}
            />
          ))}

          {/* Edge handles */}
          {edgeHandles.map(({ position, style, direction }) => (
            <div
              key={position}
              className={`absolute pointer-events-auto transition-all duration-200 ${isMultiSelected
                ? 'bg-white border-purple-300'
                : 'bg-white border-blue-300'
                } border shadow-sm hover:shadow-md`}
              style={{
                ...style,
                width: `${edgeSize}px`,
                height: `${edgeSize}px`,
                borderRadius: '50%',
                cursor: cursorForDirection(direction, rotation)
              }}
              onMouseDown={(e) => onResizeStart?.(e, direction)}
              data-resize-handle={direction}
            />
          ))}

          {/* Rotation handle */}
          {!isMultiSelected && (
            <>
              {/* Rotation line */}
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

              {/* Rotation handle */}
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
        </>
      )}
    </div>
  );
}