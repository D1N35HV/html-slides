import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { useCropModeStore } from '../store/useCropModeStore';
import {
  Crop,
  FlipHorizontal,
  FlipVertical,
  Edit3,
  SlidersHorizontal,
  RotateCcw,
  Maximize2,
  Image as ImageIcon,
  X,
  Check
} from 'lucide-react';
import { resolveMediaUrl } from '../lib/utils';

interface ImageToolbarProps {
  elementId: string;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({ elementId }) => {
  const element = useStore((s) => s.slides[s.currentSlide]?.elements.find(el => el.id === elementId));
  const { cropModeElementId, setCropModeElementId } = useCropModeStore();
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);

  const isCropMode = cropModeElementId === elementId;

  if (!element || element.type !== 'image') return null;

  // Apply an image update to every image in the current multi-selection.
  // Falls back to the primary element when nothing else is selected.
  const applyToAllSelectedImages = (updates: Record<string, any>) => {
    const store: any = useStore.getState();
    const slide = store.slides[store.currentSlide];
    const selectedIds: string[] = store.selectedElementIds || [];
    const imageIds = selectedIds.filter((id) => {
      const el = slide?.elements?.find((e: any) => e.id === id);
      return el?.type === 'image';
    });
    const targetIds = imageIds.length > 0 ? imageIds : [elementId];
    targetIds.forEach((id) => store.updateImageElement(id, updates));
  };

  const imageElement = element as any;
  const opacity = imageElement.opacity ?? 1;
  const flipX = imageElement.flipX ?? false;
  const flipY = imageElement.flipY ?? false;
  const objectFit = imageElement.objectFit ?? 'cover';
  const cropX = imageElement.cropX ?? 0;
  const cropY = imageElement.cropY ?? 0;
  const cropWidth = imageElement.cropWidth ?? 100;
  const cropHeight = imageElement.cropHeight ?? 100;

  const hasCrop = cropX !== 0 || cropY !== 0 || cropWidth !== 100 || cropHeight !== 100;

  const handleFlipHorizontal = () => {
    applyToAllSelectedImages({ flipX: !flipX });
  };

  const handleFlipVertical = () => {
    applyToAllSelectedImages({ flipY: !flipY });
  };

  const handleOpacityChange = (value: number) => {
    applyToAllSelectedImages({ opacity: value });
  };

  const handleObjectFitChange = (fit: 'fill' | 'cover' | 'contain' | 'scale-down' | 'none') => {
    applyToAllSelectedImages({ objectFit: fit });
  };

  const handleResetTransforms = () => {
    applyToAllSelectedImages({
      flipX: false,
      flipY: false,
      opacity: 1,
      objectFit: 'cover',
      cropX: 0,
      cropY: 0,
      cropWidth: 100,
      cropHeight: 100
    });
  };

  const handleStartCrop = () => {
    setCropModeElementId(elementId);
  };

  // If in crop mode, render crop toolbar instead
  if (isCropMode) {
    return (
      <div
        className="image-toolbar fixed top-[72px] z-50 bg-purple-600 text-white rounded-lg shadow-lg border border-purple-700 flex items-center gap-3 px-4 py-2"
        style={{
          left: 'calc(320px + (100vw - 320px) / 2)',
          transform: 'translateX(-50%)'
        }}
      >
        <Crop className="w-4 h-4" />
        <span className="font-medium">Crop Mode</span>
        <span className="text-purple-200 text-sm">Drag handles to adjust • Enter to apply • Esc to cancel</span>
      </div>
    );
  }

  return (
    <div
      className="image-toolbar fixed top-[72px] z-50 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-2"
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
      {/* Crop */}
      <button
        className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-1 text-sm ${hasCrop ? 'bg-purple-100 text-purple-700' : ''}`}
        title="Crop Image"
        onClick={handleStartCrop}
        disabled={!imageElement.imageUrl}
      >
        <Crop className={`w-4 h-4 ${!imageElement.imageUrl ? 'text-gray-400' : ''}`} />
        <span className={!imageElement.imageUrl ? 'text-gray-400' : ''}>Crop</span>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Transparency/Opacity */}
      <div className="relative">
        <button
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-1 text-sm ${showOpacitySlider ? 'bg-gray-100' : ''}`}
          onClick={() => setShowOpacitySlider(!showOpacitySlider)}
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

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Edit/Fit Options */}
      <div className="flex items-center gap-1">
        <button
          className={`p-1.5 rounded text-sm ${objectFit === 'cover' ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}
          onClick={() => handleObjectFitChange('cover')}
          title="Cover - Fill container"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          className={`p-1.5 rounded text-sm ${objectFit === 'contain' ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}
          onClick={() => handleObjectFitChange('contain')}
          title="Contain - Fit inside"
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          className={`p-1.5 rounded text-sm ${objectFit === 'fill' ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}
          onClick={() => handleObjectFitChange('fill')}
          title="Fill - Stretch to fit"
        >
          <Edit3 className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Flip Options */}
      <div className="flex items-center gap-1">
        <button
          className={`p-1.5 rounded ${flipX ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}
          onClick={handleFlipHorizontal}
          title="Flip Horizontal"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>
        <button
          className={`p-1.5 rounded ${flipY ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-100'}`}
          onClick={handleFlipVertical}
          title="Flip Vertical"
        >
          <FlipVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Reset */}
      <button
        className="p-1.5 hover:bg-gray-100 rounded flex items-center gap-1 text-sm"
        onClick={handleResetTransforms}
        title="Reset to Default"
      >
        <RotateCcw className="w-4 h-4" />
        <span>Reset</span>
      </button>
    </div>
  );
};
