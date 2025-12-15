import React, { useState } from 'react';
import { useStore } from '../store';
import { 
  Crop, 
  FlipHorizontal, 
  FlipVertical, 
  Edit3, 
  SlidersHorizontal,
  RotateCcw,
  Maximize2,
  Image as ImageIcon
} from 'lucide-react';

interface ImageToolbarProps {
  elementId: string;
}

export const ImageToolbar: React.FC<ImageToolbarProps> = ({ elementId }) => {
  const { slides, currentSlide, updateImageElement } = useStore();
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  
  const element = slides[currentSlide]?.elements.find(el => el.id === elementId);
  
  if (!element || element.type !== 'image') return null;

  const imageElement = element as any;
  const opacity = imageElement.opacity ?? 1;
  const flipX = imageElement.flipX ?? false;
  const flipY = imageElement.flipY ?? false;
  const objectFit = imageElement.objectFit ?? 'cover';

  const handleFlipHorizontal = () => {
    updateImageElement(elementId, { flipX: !flipX });
  };

  const handleFlipVertical = () => {
    updateImageElement(elementId, { flipY: !flipY });
  };

  const handleOpacityChange = (value: number) => {
    updateImageElement(elementId, { opacity: value });
  };

  const handleObjectFitChange = (fit: 'fill' | 'cover' | 'contain' | 'scale-down' | 'none') => {
    updateImageElement(elementId, { objectFit: fit });
  };

  const handleResetTransforms = () => {
    updateImageElement(elementId, { 
      flipX: false, 
      flipY: false, 
      opacity: 1,
      objectFit: 'cover'
    });
  };

  return (
    <div 
      className="image-toolbar fixed top-[72px] z-50 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-2"
      style={{
        left: 'calc(320px + (100vw - 320px) / 2)',
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Crop - placeholder for future functionality */}
      <button 
        className="p-1.5 hover:bg-gray-100 rounded flex items-center gap-1 text-sm"
        title="Crop Image (Coming Soon)"
        disabled
      >
        <Crop className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400">Crop</span>
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
            className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 w-48 z-50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Opacity</span>
              <span className="text-sm font-medium">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity * 100}
              onChange={(e) => handleOpacityChange(parseInt(e.target.value) / 100)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
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
