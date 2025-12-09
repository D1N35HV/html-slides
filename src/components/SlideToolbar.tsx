import React, { useState } from 'react';
import { useStore } from '../store';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { 
  Palette,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Zap,
  RotateCcw,
  Clock
} from 'lucide-react';

interface SlideToolbarProps {
  slideIndex: number;
}

export const SlideToolbar: React.FC<SlideToolbarProps> = ({ slideIndex }) => {
  const { slides, updateSlide, applyTransitionToAll } = useStore();
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showTransitionPicker, setShowTransitionPicker] = useState(false);
  
  const slide = slides[slideIndex];
  
  if (!slide) return null;

  const backgroundColor = slide.backgroundColor ?? '#ffffff';
  const transition = slide.transition ?? 'slide';
  const transitionSpeed = slide.transitionSpeed ?? 'default';

  const handleBgColorChange = (color: string) => {
    updateSlide(slideIndex, { backgroundColor: color });
  };

  const handleTransitionChange = (trans: string) => {
    updateSlide(slideIndex, { transition: trans as any });
  };

  const handleTransitionSpeedChange = (speed: string) => {
    updateSlide(slideIndex, { transitionSpeed: speed as any });
  };

  const handleApplyToAll = () => {
    applyTransitionToAll(transition as any, transitionSpeed as any);
  };

  const presetColors = [
    '#FFFFFF', '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA',
    '#1a1a2e', '#16213e', '#0f3460', '#1e3a5f', '#2d4059',
    '#FFF3CD', '#D4EDDA', '#D1ECF1', '#CCE5FF', '#F8D7DA',
    '#FFEAA7', '#DFE6E9', '#FAB1A0', '#74B9FF', '#A29BFE'
  ];

  const transitionOptions = [
    { value: 'none', label: 'None', icon: <RotateCcw className="w-4 h-4" /> },
    { value: 'slide', label: 'Slide', icon: <ArrowRight className="w-4 h-4" /> },
    { value: 'fade', label: 'Fade', icon: <Sparkles className="w-4 h-4" /> },
    { value: 'convex', label: 'Convex', icon: <Zap className="w-4 h-4" /> },
    { value: 'concave', label: 'Concave', icon: <Zap className="w-4 h-4 rotate-180" /> },
    { value: 'zoom', label: 'Zoom', icon: <ImageIcon className="w-4 h-4" /> },
  ];

  const speedOptions = [
    { value: 'slow', label: 'Slow' },
    { value: 'default', label: 'Normal' },
    { value: 'fast', label: 'Fast' },
  ];

  return (
    <div 
      className="slide-toolbar fixed top-[72px] z-50 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-2"
      style={{
        left: 'calc(320px + (100vw - 320px) / 2)',
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Slide Info */}
      <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded text-sm">
        <span className="text-gray-600">Slide</span>
        <span className="font-medium">{slideIndex + 1}</span>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Background Color */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${showBgColorPicker ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setShowBgColorPicker(!showBgColorPicker);
            setShowTransitionPicker(false);
          }}
          title="Background Color"
        >
          <div className="flex flex-col items-center">
            <Palette className="w-4 h-4" />
            <div className="w-4 h-1 mt-0.5 rounded border border-gray-300" style={{ backgroundColor: backgroundColor }}></div>
          </div>
          <span className="text-sm">Background</span>
        </button>
        
        {showBgColorPicker && (
          <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-64">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Slide Background</h4>
            
            {/* Preset Colors */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presetColors.map(color => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded border-2 hover:scale-110 transition-all ${backgroundColor === color ? 'border-purple-500' : 'border-gray-200'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleBgColorChange(color)}
                />
              ))}
            </div>
            
            {/* Color Picker */}
            <HexColorPicker color={backgroundColor} onChange={handleBgColorChange} style={{ width: '100%', height: '120px' }} />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">#</span>
              <HexColorInput 
                color={backgroundColor} 
                onChange={handleBgColorChange}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded uppercase"
              />
            </div>
            
            {/* Transparent option */}
            <button
              className="w-full mt-2 px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-2"
              onClick={() => handleBgColorChange('transparent')}
            >
              <span className="w-4 h-4 border border-gray-300 rounded bg-white relative overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-br from-white via-white to-gray-300"></span>
              </span>
              Transparent
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Transition Effect */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${showTransitionPicker ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setShowTransitionPicker(!showTransitionPicker);
            setShowBgColorPicker(false);
          }}
          title="Slide Transition"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Transition</span>
          <span className="text-xs text-gray-500 ml-1 capitalize">{transition}</span>
        </button>
        
        {showTransitionPicker && (
          <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 z-50 w-64">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Slide Transition</h4>
            
            {/* Transition Types */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {transitionOptions.map(opt => (
                <button
                  key={opt.value}
                  className={`p-2 rounded border flex flex-col items-center gap-1 transition-all ${
                    transition === opt.value 
                      ? 'bg-purple-100 border-purple-500 text-purple-700' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => handleTransitionChange(opt.value)}
                >
                  {opt.icon}
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
            
            {/* Transition Speed */}
            <div className="border-t border-gray-200 pt-3">
              <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Speed
              </h5>
              <div className="flex gap-2">
                {speedOptions.map(opt => (
                  <button
                    key={opt.value}
                    className={`flex-1 px-3 py-1.5 rounded text-sm transition-all ${
                      transitionSpeed === opt.value 
                        ? 'bg-purple-100 text-purple-700 font-medium' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    onClick={() => handleTransitionSpeedChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Apply to All Button */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <button
                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                onClick={handleApplyToAll}
              >
                <Sparkles className="w-4 h-4" />
                Apply to All Slides
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
