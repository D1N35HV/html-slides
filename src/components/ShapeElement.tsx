import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/index';

export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram';

interface ShapeElementProps {
  elementId: string;
  shapeType?: ShapeType;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  opacity?: number;
}

// Shape path definitions - reusable for both element and preview
export const SHAPE_PATHS: Record<ShapeType, { type: 'ellipse' | 'polygon' | 'path' | 'rect'; data: string; viewBox?: string }> = {
  rectangle: { type: 'rect', data: '2,2,96,96', viewBox: '0 0 100 100' },
  circle: { type: 'ellipse', data: '50,50,48,48', viewBox: '0 0 100 100' },
  triangle: { type: 'polygon', data: '50,2 98,98 2,98', viewBox: '0 0 100 100' },
  arrow: { type: 'polygon', data: '2,35 65,35 65,15 98,50 65,85 65,65 2,65', viewBox: '0 0 100 100' },
  diamond: { type: 'polygon', data: '50,2 98,50 50,98 2,50', viewBox: '0 0 100 100' },
  pentagon: { type: 'polygon', data: '50,2 95,38 77,92 23,92 5,38', viewBox: '0 0 100 100' },
  hexagon: { type: 'polygon', data: '25,2 75,2 98,50 75,98 25,98 2,50', viewBox: '0 0 100 100' },
  star: { type: 'polygon', data: '50,2 61,35 98,35 69,57 80,90 50,68 20,90 31,57 2,35 39,35', viewBox: '0 0 100 100' },
  heart: { type: 'path', data: 'M50,20 C50,20 20,0 8,18 C0,30 5,45 20,55 L50,85 L80,55 C95,45 100,30 92,18 C80,0 50,20 50,20 Z', viewBox: '0 0 100 100' },
  cloud: { type: 'path', data: 'M25,65 C10,65 5,55 8,45 C8,35 18,28 28,28 C30,18 40,10 52,10 C65,10 75,20 77,30 C87,30 95,40 92,52 C90,62 80,68 70,68 L25,65 Z', viewBox: '0 0 100 100' },
  callout: { type: 'path', data: 'M8,8 L92,8 L92,55 L35,55 L18,75 L28,55 L8,55 Z', viewBox: '0 0 100 100' },
  parallelogram: { type: 'polygon', data: '20,2 98,2 80,98 2,98', viewBox: '0 0 100 100' }
};

// Shape display names for UI
export const SHAPE_NAMES: Record<ShapeType, string> = {
  rectangle: 'Rectangle',
  circle: 'Circle',
  triangle: 'Triangle',
  arrow: 'Arrow',
  diamond: 'Diamond',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  star: 'Star',
  heart: 'Heart',
  cloud: 'Cloud',
  callout: 'Callout',
  parallelogram: 'Parallelogram'
};

// Reusable shape renderer component for both editor and preview
interface ShapeRendererProps {
  shapeType: ShapeType;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  cornerRadius?: number;
  className?: string;
  preserveAspectRatio?: string;
}

export function ShapeRenderer({
  shapeType,
  fillColor,
  borderColor,
  borderWidth,
  cornerRadius = 0,
  className = 'w-full h-full',
  preserveAspectRatio = 'none'
}: ShapeRendererProps) {
  const shapeDef = SHAPE_PATHS[shapeType] || SHAPE_PATHS.rectangle;
  
  // Use vector-effect to maintain consistent stroke width during scaling
  const style: React.CSSProperties = {
    fill: fillColor,
    stroke: borderColor,
    strokeWidth: borderWidth,
    vectorEffect: 'non-scaling-stroke' as any // This keeps border consistent during resize
  };

  const renderShapeContent = () => {
    switch (shapeDef.type) {
      case 'ellipse': {
        const [cx, cy, rx, ry] = shapeDef.data.split(',').map(Number);
        return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} style={style} />;
      }
      case 'polygon':
        return <polygon points={shapeDef.data} style={style} />;
      case 'path':
        return <path d={shapeDef.data} style={style} />;
      case 'rect': {
        const [x, y, width, height] = shapeDef.data.split(',').map(Number);
        return <rect x={x} y={y} width={width} height={height} rx={cornerRadius} ry={cornerRadius} style={style} />;
      }
      default:
        return null;
    }
  };

  return (
    <svg 
      viewBox={shapeDef.viewBox || '0 0 100 100'} 
      className={className} 
      preserveAspectRatio={preserveAspectRatio}
      style={{ overflow: 'visible' }} // Allow stroke to render outside bounds
    >
      {renderShapeContent()}
    </svg>
  );
}

// Shape preview component for sidebar
interface ShapePreviewProps {
  shapeType: ShapeType;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  size?: number;
  onClick?: () => void;
  isSelected?: boolean;
}

export function ShapePreview({
  shapeType,
  fillColor = '#3B82F6',
  borderColor = '#1E40AF',
  borderWidth = 2,
  size = 48,
  onClick,
  isSelected = false
}: ShapePreviewProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
        isSelected 
          ? 'border-purple-500 bg-purple-50 shadow-md' 
          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
      }`}
      title={SHAPE_NAMES[shapeType]}
    >
      <div style={{ width: size, height: size }}>
        <ShapeRenderer
          shapeType={shapeType}
          fillColor={fillColor}
          borderColor={borderColor}
          borderWidth={borderWidth}
          preserveAspectRatio="xMidYMid meet"
        />
      </div>
      <span className="text-xs text-gray-600 mt-1 truncate w-full text-center">
        {SHAPE_NAMES[shapeType]}
      </span>
    </button>
  );
}

export function ShapeElement({ 
  elementId, 
  shapeType = 'rectangle',
  fillColor,
  borderColor,
  borderWidth,
  cornerRadius,
  opacity
}: ShapeElementProps) {
  const { setSelectedElement } = useStore();

  // Use nullish coalescing to handle undefined values from props
  const actualFillColor = fillColor ?? '#3b82f6';
  const actualBorderColor = borderColor ?? '#1d4ed8';
  const actualBorderWidth = borderWidth ?? 2;
  const actualCornerRadius = cornerRadius ?? 0;
  const actualOpacity = opacity ?? 1;

  const handleShapeClick = () => {
    setSelectedElement(elementId);
  };

  return (
    <div 
      className="w-full h-full cursor-pointer"
      onClick={handleShapeClick}
      style={{ opacity: actualOpacity }}
    >
      <ShapeRenderer
        shapeType={shapeType}
        fillColor={actualFillColor}
        borderColor={actualBorderColor}
        borderWidth={actualBorderWidth}
        cornerRadius={actualCornerRadius}
      />
    </div>
  );
}
