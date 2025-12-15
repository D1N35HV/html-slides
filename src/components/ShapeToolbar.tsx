import React, { useState } from 'react';
import { useStore } from '../store';
import { useLayoutStore } from '../store/layoutStore';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { 
  Palette,
  SlidersHorizontal,
  Square,
  Circle,
  Triangle,
  Star,
  Heart,
  Hexagon,
  Pentagon,
  Diamond,
  ArrowRight,
  Cloud,
  MessageSquare
} from 'lucide-react';
import { ShapeType, SHAPE_NAMES } from './ShapeElement';

interface ShapeToolbarProps {
  elementId: string;
}

export const ShapeToolbar: React.FC<ShapeToolbarProps> = ({ elementId }) => {
  const { slides, currentSlide, updateShapeElement } = useStore();
  const [showFillColorPicker, setShowFillColorPicker] = useState(false);
  const [showBorderColorPicker, setShowBorderColorPicker] = useState(false);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [showShapeSelector, setShowShapeSelector] = useState(false);
  
  const element = slides[currentSlide]?.elements.find(el => el.id === elementId);
  
  if (!element || element.type !== 'shape') return null;

  const shapeElement = element as any;
  const fillColor = shapeElement.fillColor ?? '#3B82F6';
  const borderColor = shapeElement.borderColor ?? '#1E40AF';
  const borderWidth = shapeElement.borderWidth ?? 2;
  const opacity = shapeElement.opacity ?? 1;
  const shapeType = shapeElement.shapeType ?? 'rectangle';

  const handleFillColorChange = (color: string) => {
    updateShapeElement(elementId, { fillColor: color });
  };

  const handleBorderColorChange = (color: string) => {
    updateShapeElement(elementId, { borderColor: color });
  };

  const handleBorderWidthChange = (width: number) => {
    updateShapeElement(elementId, { borderWidth: width });
  };

  const handleOpacityChange = (value: number) => {
    updateShapeElement(elementId, { opacity: value });
  };

  const handleShapeTypeChange = (type: ShapeType) => {
    updateShapeElement(elementId, { shapeType: type });
    setShowShapeSelector(false);
  };

  const presetColors = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#000000', '#6B7280', '#FFFFFF'
  ];

  const shapeOptions: { type: ShapeType; icon: React.ReactNode }[] = [
    { type: 'rectangle', icon: <Square className="w-5 h-5" /> },
    { type: 'circle', icon: <Circle className="w-5 h-5" /> },
    { type: 'triangle', icon: <Triangle className="w-5 h-5" /> },
    { type: 'star', icon: <Star className="w-5 h-5" /> },
    { type: 'heart', icon: <Heart className="w-5 h-5" /> },
    { type: 'hexagon', icon: <Hexagon className="w-5 h-5" /> },
    { type: 'pentagon', icon: <Pentagon className="w-5 h-5" /> },
    { type: 'diamond', icon: <Diamond className="w-5 h-5" /> },
    { type: 'arrow', icon: <ArrowRight className="w-5 h-5" /> },
    { type: 'cloud', icon: <Cloud className="w-5 h-5" /> },
    { type: 'callout', icon: <MessageSquare className="w-5 h-5" /> },
  ];

  return (
    <div 
      className="shape-toolbar fixed top-[72px] z-50 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-2"
      style={{
        left: 'calc(320px + (100vw - 320px) / 2)',
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Shape Type Selector */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-1 text-sm ${showShapeSelector ? 'bg-gray-100' : ''}`}
          onClick={() => setShowShapeSelector(!showShapeSelector)}
          title="Change Shape"
        >
          <Square className="w-4 h-4" />
          <span>{SHAPE_NAMES[shapeType]}</span>
        </button>
        
        {showShapeSelector && (
          <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="grid grid-cols-4 gap-2">
              {shapeOptions.map(({ type, icon }) => (
                <button
                  key={type}
                  className={`p-2 rounded hover:bg-gray-100 flex flex-col items-center gap-1 ${shapeType === type ? 'bg-purple-100 text-purple-700' : ''}`}
                  onClick={() => handleShapeTypeChange(type)}
                  title={SHAPE_NAMES[type]}
                >
                  {icon}
                  <span className="text-xs">{SHAPE_NAMES[type]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Fill Color */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${showFillColorPicker ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setShowFillColorPicker(!showFillColorPicker);
            setShowBorderColorPicker(false);
            setShowOpacitySlider(false);
          }}
          title="Fill Color"
        >
          <div className="flex flex-col items-center">
            <Palette className="w-4 h-4" />
            <div className="w-4 h-1 mt-0.5 rounded" style={{ backgroundColor: fillColor }}></div>
          </div>
          <span className="text-sm">Fill</span>
        </button>
        
        {showFillColorPicker && (
          <div 
            className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-56"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-medium text-gray-700 mb-2">Fill Color</h4>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presetColors.map(color => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded border-2 hover:scale-110 transition-all ${fillColor === color ? 'border-purple-500' : 'border-gray-200'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleFillColorChange(color)}
                />
              ))}
            </div>
            <HexColorPicker color={fillColor} onChange={handleFillColorChange} style={{ width: '100%', height: '120px' }} />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">#</span>
              <HexColorInput 
                color={fillColor} 
                onChange={handleFillColorChange}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded uppercase"
              />
            </div>
          </div>
        )}
      </div>

      {/* Border Color */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${showBorderColorPicker ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setShowBorderColorPicker(!showBorderColorPicker);
            setShowFillColorPicker(false);
            setShowOpacitySlider(false);
          }}
          title="Border Color"
        >
          <div className="flex flex-col items-center">
            <Square className="w-4 h-4" />
            <div className="w-4 h-1 mt-0.5 rounded" style={{ backgroundColor: borderColor }}></div>
          </div>
          <span className="text-sm">Border</span>
        </button>
        
        {showBorderColorPicker && (
          <div 
            className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-56"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-medium text-gray-700 mb-2">Border Color</h4>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presetColors.map(color => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded border-2 hover:scale-110 transition-all ${borderColor === color ? 'border-purple-500' : 'border-gray-200'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleBorderColorChange(color)}
                />
              ))}
            </div>
            <HexColorPicker color={borderColor} onChange={handleBorderColorChange} style={{ width: '100%', height: '120px' }} />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">#</span>
              <HexColorInput 
                color={borderColor} 
                onChange={handleBorderColorChange}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded uppercase"
              />
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">Border Width</span>
                <span className="text-sm font-medium">{borderWidth}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={borderWidth}
                onChange={(e) => handleBorderWidthChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
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
            setShowFillColorPicker(false);
            setShowBorderColorPicker(false);
          }}
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
    </div>
  );
};
