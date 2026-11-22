import React from 'react';
import { useStore } from '../store/index';
import type { BorderStyle } from '../store/sliceTypes';

export type ShapeType = 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram' | 'line' | 'line-arrow-right' | 'line-arrow-double';

// Single source of truth for "is this a stroke-style line shape (not a closed
// polygon)". Lines render with markers, resize on the X-axis only, and ignore
// fill color.
export const LINE_SHAPE_TYPES: ReadonlySet<ShapeType> = new Set<ShapeType>([
  'line',
  'line-arrow-right',
  'line-arrow-double',
]);

export function isLineShape(type: ShapeType | undefined): boolean {
  return type !== undefined && LINE_SHAPE_TYPES.has(type);
}

interface ShapeElementProps {
  elementId: string;
  shapeType?: ShapeType;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  cornerRadius?: number;
  opacity?: number;
  gradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    stops: Array<{ position: number; color: string }>;
  };
}

/**
 * Convert a BorderStyle into an SVG stroke-dasharray value.
 * Returns undefined for solid strokes so the attribute is omitted.
 */
export function strokeDasharrayFor(style: BorderStyle | undefined, width: number): string | undefined {
  switch (style) {
    case 'long-dashed': return `${Math.max(6, width * 4)} ${Math.max(3, width * 2)}`;
    case 'dashed':      return `${Math.max(3, width * 2)} ${Math.max(2, width * 1.5)}`;
    case 'dotted':      return `0 ${Math.max(2, width * 2)}`;
    default:            return undefined;
  }
}

// Shape path definitions - reusable for both element and preview
export const SHAPE_PATHS: Record<ShapeType, { type: 'ellipse' | 'polygon' | 'path' | 'rect'; data: string; viewBox?: string }> = {
  rectangle: { type: 'rect', data: '0,0,100,100', viewBox: '0 0 100 100' },
  circle: { type: 'ellipse', data: '50,50,50,50', viewBox: '0 0 100 100' },
  triangle: { type: 'polygon', data: '50,0 100,100 0,100', viewBox: '0 0 100 100' },
  arrow: { type: 'polygon', data: '0,35 65,35 65,15 100,50 65,85 65,65 0,65', viewBox: '0 0 100 100' },
  diamond: { type: 'polygon', data: '50,0 100,50 50,100 0,50', viewBox: '0 0 100 100' },
  pentagon: { type: 'polygon', data: '50,0 100,40 80,100 20,100 0,40', viewBox: '0 0 100 100' },
  hexagon: { type: 'polygon', data: '25,0 75,0 100,50 75,100 25,100 0,50', viewBox: '0 0 100 100' },
  star: { type: 'polygon', data: '50,0 61,38 100,38 70,63 81,100 50,75 19,100 30,63 0,38 39,38', viewBox: '0 0 100 100' },
  heart: { type: 'path', data: 'M50,24 C50,24 20,0 8,21 C0,35 5,53 20,65 L50,100 L80,65 C95,53 100,35 92,21 C80,0 50,24 50,24 Z', viewBox: '0 0 100 100' },
  cloud: { type: 'path', data: 'M22,95 C6,95 0,78 3,60 C3,43 14,31 26,31 C28,14 39,0 52,0 C67,0 78,17 80,34 C91,34 100,52 97,72 C94,90 83,100 72,100 L22,95 Z', viewBox: '0 0 100 100' },
  callout: { type: 'path', data: 'M0,0 L100,0 L100,70 L32,70 L12,100 L24,70 L0,70 Z', viewBox: '0 0 100 100' },
  parallelogram: { type: 'polygon', data: '19,0 100,0 81,100 0,100', viewBox: '0 0 100 100' },
  // Lines render via a dedicated branch in ShapeRenderer (markers + percentage
  // coords); these placeholders only exist to satisfy Record<ShapeType, …>.
  line: { type: 'path', data: 'M0,50 L100,50', viewBox: '0 0 100 100' },
  'line-arrow-right': { type: 'path', data: 'M0,50 L100,50', viewBox: '0 0 100 100' },
  'line-arrow-double': { type: 'path', data: 'M0,50 L100,50', viewBox: '0 0 100 100' },
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
  parallelogram: 'Parallelogram',
  line: 'Line',
  'line-arrow-right': 'Arrow line',
  'line-arrow-double': 'Double arrow line',
};

// ─────────────────────────────────────────────────────────────────
// Line renderer
//
// Lines need a different SVG strategy than the polygonal shapes. The polygon
// path uses a viewBox of 0 0 100 100 + preserveAspectRatio="none" so the path
// stretches to fill the bounding box — fine for closed shapes, but it would
// shear an arrowhead into a flat sliver when the box is, say, 300×24.
//
// Instead we drop the viewBox, position the line in percentage user-space (so
// the geometry uses the rendered SVG's pixel dimensions directly), and put the
// arrowhead in a `<marker>` with markerUnits="userSpaceOnUse". The marker
// renders at the line endpoint in true pixels, oriented along the path —
// orthogonal regardless of the box ratio.
// ─────────────────────────────────────────────────────────────────
interface LineShapeRendererProps {
  shapeType: ShapeType;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  strokeLinecap?: React.SVGAttributes<SVGLineElement>['strokeLinecap'];
  className?: string;
}

function LineShapeRenderer({
  shapeType,
  stroke,
  strokeWidth,
  strokeDasharray,
  strokeLinecap,
  className,
}: LineShapeRendererProps) {
  const hasRightArrow = shapeType === 'line-arrow-right' || shapeType === 'line-arrow-double';
  const hasLeftArrow = shapeType === 'line-arrow-double';

  // Each LineShapeRenderer instance needs unique marker IDs — multiple lines on
  // the same slide would otherwise share defs and re-color each other.
  const uid = React.useId();
  const endId = `arrow-end-${uid}`;
  const startId = `arrow-start-${uid}`;

  // Arrowhead size scales with stroke for visual harmony, with a sensible floor
  // so a 1px stroke still has a visible arrow.
  const head = Math.max(8, strokeWidth * 3.2);
  const tip = head;
  const half = head / 2;

  // Lines default to a 0-height bounding box (visual cleanliness — no selection
  // rectangle wrapping the line). The stroke itself draws outside that box via
  // overflow:visible, so without a dedicated hit zone the user has nothing to
  // click on between the two endpoint handles. A transparent 20px-tall band,
  // vertically centered on the line, restores click-to-select / drag-to-move.
  const hitBandHeight = Math.max(20, strokeWidth + 16);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `-${hitBandHeight / 2}px`,
          height: `${hitBandHeight}px`,
          cursor: 'move',
        }}
      />
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        className={className}
        style={{ overflow: 'visible', position: 'relative', pointerEvents: 'none' }}
      >
        <defs>
        {hasRightArrow && (
          <marker
            id={endId}
            markerUnits="userSpaceOnUse"
            markerWidth={tip}
            markerHeight={head}
            refX={tip}
            refY={half}
            orient="auto-start-reverse"
          >
            <path d={`M0,0 L${tip},${half} L0,${head} z`} fill={stroke} />
          </marker>
        )}
        {hasLeftArrow && (
          <marker
            id={startId}
            markerUnits="userSpaceOnUse"
            markerWidth={tip}
            markerHeight={head}
            refX={tip}
            refY={half}
            orient="auto-start-reverse"
          >
            <path d={`M0,0 L${tip},${half} L0,${head} z`} fill={stroke} />
          </marker>
        )}
      </defs>
      {/*
        x1/x2 are percentage strings, valid on <line> when there's no viewBox.
        Markers are drawn so the tip of the arrowhead coincides with the path
        endpoint (refX = full marker width), so the arrow body overlaps the
        tail of the line — a standard "arrow at end of line" look. With
        overflow:visible on the SVG, the corners of large arrowheads aren't
        clipped at the bounding-box edge.
      */}
      <line
        x1="0"
        y1="50%"
        x2="100%"
        y2="50%"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeLinecap={strokeLinecap}
        markerStart={hasLeftArrow ? `url(#${startId})` : undefined}
        markerEnd={hasRightArrow ? `url(#${endId})` : undefined}
      />
      </svg>
    </div>
  );
}

// Reusable shape renderer component for both editor and preview
interface ShapeRendererProps {
  shapeType: ShapeType;
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderStyle?: BorderStyle;
  cornerRadius?: number;
  className?: string;
  preserveAspectRatio?: string;
}

export function ShapeRenderer({
  shapeType,
  fillColor,
  borderColor,
  borderWidth,
  borderStyle,
  cornerRadius = 0,
  className = 'w-full h-full',
  preserveAspectRatio = 'none',
  gradient,
}: ShapeRendererProps & { gradient?: ShapeElementProps['gradient'] }) {
  const shapeDef = SHAPE_PATHS[shapeType] || SHAPE_PATHS.rectangle;
  const gradientId = gradient ? `grad-${shapeType}-${Math.random().toString(36).slice(2, 7)}` : null;

  // Resolve effective fill — gradient or solid
  const effectiveFill = gradientId ? `url(#${gradientId})` : (fillColor || '#3b82f6');

  const isLine = isLineShape(shapeType);
  // Lines have no enclosed area, so a "none" stroke would render nothing.
  // Treat the border color/width as the line itself; ignore borderStyle: 'none'.
  const noStroke = !isLine && borderStyle === 'none';
  const dashArray = strokeDasharrayFor(borderStyle, borderWidth);

  // Use vector-effect to maintain consistent stroke width during scaling
  const style: React.CSSProperties = {
    fill: isLine ? 'none' : effectiveFill,
    stroke: noStroke ? 'none' : (isLine ? (borderColor || fillColor || '#1a1d2b') : borderColor),
    strokeWidth: noStroke ? 0 : Math.max(borderWidth, isLine ? 1 : 0),
    strokeDasharray: dashArray,
    strokeLinecap: borderStyle === 'dotted' ? 'round' : (isLine ? 'round' : undefined),
    vectorEffect: 'non-scaling-stroke' as any,
  };

  // Lines (with or without arrowheads) are drawn in a dedicated branch so the
  // arrowhead geometry stays orthogonal regardless of the bounding box ratio.
  if (isLine) {
    return (
      <LineShapeRenderer
        shapeType={shapeType}
        stroke={borderColor || fillColor || '#1a1d2b'}
        strokeWidth={Math.max(1, borderWidth)}
        strokeDasharray={dashArray}
        strokeLinecap={borderStyle === 'dotted' ? 'round' : undefined}
        className={className}
      />
    );
  }

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

  // Build SVG linearGradient when gradient data is present
  const renderGradientDef = () => {
    if (!gradient || !gradientId) return null;
    const angle = gradient.angle ?? 0;
    // Convert CSS angle (deg from top) to SVG x1/y1/x2/y2 coordinates
    const rad = ((angle - 90) * Math.PI) / 180;
    const x1 = Math.round((0.5 - 0.5 * Math.cos(rad)) * 100);
    const y1 = Math.round((0.5 - 0.5 * Math.sin(rad)) * 100);
    const x2 = Math.round((0.5 + 0.5 * Math.cos(rad)) * 100);
    const y2 = Math.round((0.5 + 0.5 * Math.sin(rad)) * 100);
    const sorted = [...gradient.stops].sort((a, b) => a.position - b.position);
    return (
      <defs>
        <linearGradient id={gradientId} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
          {sorted.map((s, i) => (
            <stop key={i} offset={`${s.position}%`} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
    );
  };

  return (
    <svg
      viewBox={shapeDef.viewBox || '0 0 100 100'}
      className={className}
      preserveAspectRatio={preserveAspectRatio}
      style={{ overflow: 'visible' }}
    >
      {renderGradientDef()}
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
  borderStyle,
  cornerRadius,
  opacity,
  gradient,
}: ShapeElementProps) {
  const setSelectedElement = useStore((s) => s.setSelectedElement);

  const actualFillColor = fillColor ?? '#3b82f6';
  const actualBorderColor = borderColor ?? '#1d4ed8';
  const actualBorderWidth = borderWidth ?? 2;
  const actualCornerRadius = cornerRadius ?? 0;
  const actualOpacity = opacity ?? 1;
  const actualBorderStyle: BorderStyle = borderStyle ?? 'solid';

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
        borderStyle={actualBorderStyle}
        cornerRadius={actualCornerRadius}
        gradient={gradient}
      />
    </div>
  );
}
