import React, { useState } from 'react';
import { useStore } from '../store';
import { useLayoutStore } from '../store/layoutStore';
import {
  Palette,
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  Zap,
  RotateCcw,
  Clock
} from 'lucide-react';

interface SlideToolbarProps {
  slideIndex: number;
}

export const SlideToolbar: React.FC<SlideToolbarProps> = ({ slideIndex }) => {
  const slides = useStore((s) => s.slides);
  const updateSlide = useStore((s) => s.updateSlide);
  const applyTransitionToAll = useStore((s) => s.applyTransitionToAll);
  const { activeSidebarPanel, setActiveSidebarPanel } = useLayoutStore();
  const [showTransitionPicker, setShowTransitionPicker] = useState(false);

  const slide = slides[slideIndex];

  if (!slide) return null;

  const backgroundColor = slide.backgroundColor ?? '#ffffff';
  const bgPanelActive = activeSidebarPanel === 'slideBgColor';
  const transition = slide.transition ?? 'slide';
  const transitionSpeed = slide.transitionSpeed ?? 'default';

  const handleTransitionChange = (trans: string) => {
    updateSlide(slideIndex, { transition: trans as any });
  };

  const handleTransitionSpeedChange = (speed: string) => {
    updateSlide(slideIndex, { transitionSpeed: speed as any });
  };

  const handleApplyToAll = () => {
    applyTransitionToAll(transition as any, transitionSpeed as any);
  };

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

      {/* Background Color — opens the shared picker in the left sidebar */}
      <button
        className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${bgPanelActive ? 'bg-gray-100' : ''}`}
        onClick={() => {
          setActiveSidebarPanel('slideBgColor');
          setShowTransitionPicker(false);
        }}
        title="Background Color"
      >
        <div className="flex flex-col items-center">
          <Palette className="w-4 h-4" />
          <div
            className="w-4 h-1 mt-0.5 rounded border border-gray-300"
            style={{ background: backgroundColor }}
          />
        </div>
        <span className="text-sm">Background</span>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Transition Effect */}
      <div className="relative">
        <button 
          className={`p-1.5 hover:bg-gray-100 rounded flex items-center gap-2 ${showTransitionPicker ? 'bg-gray-100' : ''}`}
          onClick={() => {
            setShowTransitionPicker(!showTransitionPicker);
          }}
          title="Slide Transition"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Transition</span>
          <span className="text-xs text-gray-500 ml-1 capitalize">{transition}</span>
        </button>
        
        {showTransitionPicker && (
          <div
            className="absolute top-full left-0 mt-2 z-50"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="lp-root tb-popover" style={{ width: 280 }}>
              <div>
                <div className="tb-label" style={{ marginBottom: 10 }}>Transition</div>
                <div className="tb-grid tb-grid-3">
                  {transitionOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className="tb-tile"
                      aria-pressed={transition === opt.value}
                      onClick={() => handleTransitionChange(opt.value)}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="tb-label" style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Clock className="w-3 h-3" />
                  <span>Speed</span>
                </div>
                <div className="tb-chips">
                  {speedOptions.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className="tb-chip"
                      aria-pressed={transitionSpeed === opt.value}
                      onClick={() => handleTransitionSpeedChange(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="tb-primary"
                onClick={handleApplyToAll}
                style={{ width: '100%' }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Apply to all slides
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
