import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useLayoutStore } from '../store/layoutStore';
import {
  Palette,
  SlidersHorizontal,
  Square,
  Minus
} from 'lucide-react';
import { SHAPE_NAMES, type ShapeType } from './ShapeElement';
import { StrokePopover } from './ui/StrokePopover';
import type { BorderStyle } from '../store/sliceTypes';

interface ShapeToolbarProps {
  elementId: string;
}

export const ShapeToolbar: React.FC<ShapeToolbarProps> = ({ elementId }) => {
  const element = useStore((s) => s.slides[s.currentSlide]?.elements.find(el => el.id === elementId));
  const { activeSidebarPanel, setActiveSidebarPanel } = useLayoutStore();
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [showStroke, setShowStroke] = useState(false);
  const strokeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showStroke) return;
    const onDown = (e: MouseEvent) => {
      if (!strokeRef.current?.contains(e.target as Node)) setShowStroke(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showStroke]);

  if (!element || element.type !== 'shape') return null;

  const fillPanelActive = activeSidebarPanel === 'shapeFillColor';
  const borderPanelActive = activeSidebarPanel === 'shapeBorderColor';

  // Apply a shape update to every shape in the current multi-selection.
  // Falls back to the primary element when nothing else is selected.
  const applyToAllSelectedShapes = (updates: Record<string, any>) => {
    const store: any = useStore.getState();
    const slide = store.slides[store.currentSlide];
    const selectedIds: string[] = store.selectedElementIds || [];
    const shapeIds = selectedIds.filter((id) => {
      const el = slide?.elements?.find((e: any) => e.id === id);
      return el?.type === 'shape';
    });
    const targetIds = shapeIds.length > 0 ? shapeIds : [elementId];
    targetIds.forEach((id) => store.updateShapeElement(id, updates));
  };

  const shapeElement = element as any;
  const fillColor = shapeElement.fillColor ?? '#3B82F6';
  const borderColor = shapeElement.borderColor ?? '#1E40AF';
  const borderWidth = shapeElement.borderWidth ?? 2;
  const borderStyle: BorderStyle = shapeElement.borderStyle ?? 'solid';
  const opacity = shapeElement.opacity ?? 1;
  const shapeType: ShapeType = shapeElement.shapeType ?? 'rectangle';

  const handleOpacityChange = (value: number) => {
    applyToAllSelectedShapes({ opacity: value });
  };

  const handleStrokeStyle = (next: BorderStyle) => {
    applyToAllSelectedShapes({ borderStyle: next });
  };

  const handleStrokeWeight = (next: number) => {
    applyToAllSelectedShapes({ borderWidth: next });
  };

  const shapeSelectorActive = activeSidebarPanel === 'shapeSelector';

  return (
    <div
      className="shape-toolbar fixed top-[72px] z-50 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-2"
      style={{
        left: 'calc(320px + (100vw - 320px) / 2)',
        transform: 'translateX(-50%)'
      }}
      // Keep interactions contained to the toolbar so they can't bubble to
      // slide-level handlers and clear the multi-selection. preventDefault on
      // mousedown also avoids native focus changes that would blur the canvas.
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Shape Type Selector — opens the sidebar's Change-shape panel */}
      <button
        className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-1 text-sm ${shapeSelectorActive ? 'bg-gray-100' : ''}`}
        onClick={() => {
          setActiveSidebarPanel('shapeSelector');
          setShowOpacitySlider(false);
          setShowStroke(false);
        }}
        aria-pressed={shapeSelectorActive}
        title="Change shape"
      >
        <Square className="w-4 h-4" />
        <span>{SHAPE_NAMES[shapeType]}</span>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Fill Color */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${fillPanelActive ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setActiveSidebarPanel('shapeFillColor');
            setShowOpacitySlider(false);
          }}
          title="Fill Color"
        >
          <div className="flex flex-col items-center">
            <Palette className="w-4 h-4" />
            <div className="w-4 h-1 mt-0.5 rounded" style={{ background: fillColor }}></div>
          </div>
          <span className="text-sm">Fill</span>
        </button>
      </div>

      {/* Border Color */}
      <div className="relative">
        <button
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${borderPanelActive ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setActiveSidebarPanel('shapeBorderColor');
            setShowOpacitySlider(false);
            setShowStroke(false);
          }}
          title="Border Color"
        >
          <div className="flex flex-col items-center">
            <Square className="w-4 h-4" />
            <div className="w-4 h-1 mt-0.5 rounded" style={{ background: borderColor }}></div>
          </div>
          <span className="text-sm">Border</span>
        </button>
      </div>

      {/* Stroke style + weight — own popover, not sidebar */}
      <div className="relative" ref={strokeRef}>
        <button
          type="button"
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 text-sm ${showStroke ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setShowStroke((v) => !v);
            setShowOpacitySlider(false);
          }}
          title="Stroke"
          aria-haspopup="dialog"
          aria-expanded={showStroke}
        >
          <Minus className="w-4 h-4" />
          <span>Stroke</span>
          <span className="text-xs text-gray-500 ml-1">{borderStyle === 'none' ? '—' : `${borderWidth}px`}</span>
        </button>

        {showStroke && (
          <div
            className="absolute top-full left-0 mt-2 z-50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <StrokePopover
              style={borderStyle}
              weight={borderWidth}
              onStyleChange={handleStrokeStyle}
              onWeightChange={handleStrokeWeight}
              onClose={() => setShowStroke(false)}
            />
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Transparency/Opacity */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-1 text-sm ${showOpacitySlider ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setShowOpacitySlider(!showOpacitySlider);
          }}
          title="Transparency"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Opacity</span>
          <span className="text-xs text-gray-500 ml-1">{Math.round(opacity * 100)}%</span>
        </button>
        
        {showOpacitySlider && (
          <div
            className="absolute top-full left-0 mt-2 z-50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="lp-root tb-popover tb-slider-row" style={{ width: 220 }}>
              <div className="tb-slider-head">
                <span className="tb-label">Opacity</span>
                <span className="tb-slider-value">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10) / 100)}
                className="tb-slider"
                aria-label="Opacity"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
