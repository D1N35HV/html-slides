import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/index';
import { Slide, SlideElement } from '../store/sliceTypes';
import { useThumbnailStore } from '../store/useThumbnailStore';
import collaborationService from '../services/CollaborationService';
import { resolveMediaUrl } from '../lib/utils';

interface SlideStripProps {
  className?: string;
}

export const SlideStrip: React.FC<SlideStripProps> = ({ className = '' }) => {
  const { slides, currentSlide, setCurrentSlide, addSlide, removeSlide } = useStore();
  const [draggedSlide, setDraggedSlide] = useState<number | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { thumbnails, setThumbnail } = useThumbnailStore();

  // Listen for thumbnail updates from server
  useEffect(() => {
    collaborationService.onThumbnailUpdate(({ slideId, thumbnailUrl }) => {
      setThumbnail(slideId, thumbnailUrl);
    });
  }, [setThumbnail]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(null);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu]);

  // Auto-scroll to current slide
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const slideElements = container.querySelectorAll('[data-slide-index]');
      const currentSlideElement = slideElements[currentSlide];

      if (currentSlideElement) {
        currentSlideElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [currentSlide]);

  const handleSlideClick = (index: number) => {
    setCurrentSlide(index);
  };

  const handleSlideRightClick = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    setShowContextMenu({
      index,
      x: event.clientX,
      y: event.clientY
    });
  };

  const handleDuplicateSlide = (index: number) => {
    const slideToClone = slides[index];
    const newSlide: Slide = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      elements: slideToClone.elements.map(element => ({
        ...element,
        id: `${element.id}-copy-${Date.now()}`
      }))
    };

    // Use addSlide instead of manual array manipulation
    addSlide();
    setShowContextMenu(null);
  };

  const handleDeleteSlide = (index: number) => {
    if (slides.length > 1) {
      removeSlide(index);
    }
    setShowContextMenu(null);
  };

  const renderSlidePreview = (slide: Slide, index: number) => {
    const isActive = index === currentSlide;

    return (
      <div
        key={slide.id}
        data-slide-index={index}
        className={`
          flex-shrink-0 relative cursor-pointer group transition-all duration-200
          ${isActive ? 'border-2 border-blue-500 shadow-lg' : 'hover:shadow-md'}
        `}
        onClick={() => handleSlideClick(index)}
        onContextMenu={(e) => handleSlideRightClick(e, index)}
      >
        <div className="w-20 h-14 bg-white border border-gray-300 rounded shadow-sm overflow-hidden relative">
          {/* Slide preview background */}
          <div
            className="w-full h-full relative"
            style={{
              backgroundColor: slide.backgroundColor || '#ffffff'
            }}
          >
            {/* Use server-rendered thumbnail if available */}
            {thumbnails[slide.id] ? (
              <img
                src={resolveMediaUrl(thumbnails[slide.id])}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              /* Fallback: Render simplified preview of slide elements */
              <>
                {slide.elements.slice(0, 3).map((element, elIndex) => (
                  <div
                    key={element.id}
                    className="absolute"
                    style={{
                      left: `${(element.position.x / 1920) * 100}%`,
                      top: `${(element.position.y / 1080) * 100}%`,
                      width: `${Math.min((element.size.width / 1920) * 100, 30)}%`,
                      height: `${Math.min((element.size.height / 1080) * 100, 25)}%`,
                      zIndex: element.zIndex || 1
                    }}
                  >
                    {(element.type === 'text' || element.type === 'heading') ? (
                      <div className="w-full h-full bg-blue-200 rounded-sm opacity-70" />
                    ) : element.type === 'image' ? (
                      <div className="w-full h-full bg-green-200 rounded-sm opacity-70" />
                    ) : element.type === 'shape' ? (
                      <div className="w-full h-full bg-purple-200 rounded-sm opacity-70" />
                    ) : element.type === 'video' ? (
                      <div className="w-full h-full bg-red-200 rounded-sm opacity-70" />
                    ) : (
                      <div className="w-full h-full bg-gray-200 rounded-sm opacity-70" />
                    )}
                  </div>
                ))}

                {/* Show "+" indicator if there are more elements */}
                {slide.elements.length > 3 && (
                  <div className="absolute bottom-1 right-1 w-3 h-3 bg-gray-400 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">+</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Active slide indicator */}
          {isActive && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 rounded" />
      </div>
    );
  };

  return (
    <div className={`bg-white relative ${className}`}>
      {/* Main slide strip container */}
      <div className="h-16 flex items-center px-4 gap-3">
        {/* Slides container with horizontal scrollbar */}
        <div
          ref={scrollContainerRef}
          className="overflow-x-auto overflow-y-hidden slide-scroller max-w-full scrollbar-hide"
          style={{
            flex: '1 1 0%',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
          onWheel={(e) => {
            e.preventDefault();
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollLeft += e.deltaY;
            }
          }}
        >
          <div className="flex items-center gap-3 pb-1" style={{ width: 'max-content' }}>
            {slides.map((slide, index) => renderSlidePreview(slide, index))}
          </div>
        </div>

        {/* Add new slide button - outside scroller */}
        <button
          onClick={() => addSlide()}
          className="flex-shrink-0 w-20 h-14 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center transition-all duration-200 group"
          title="Add new slide"
        >
          <div className="text-gray-400 group-hover:text-blue-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>
      </div>

      {/* Navigation bar below thumbnails */}
      <div className="h-8 bg-gray-50 border-t border-gray-200 flex items-center justify-between px-4">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Previous slide"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Next slide"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Slide counter */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-medium">{currentSlide + 1}</span>
          <span>/</span>
          <span>{slides.length}</span>
        </div>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-32"
          style={{
            left: showContextMenu.x,
            top: showContextMenu.y
          }}
        >
          <button
            onClick={() => handleDuplicateSlide(showContextMenu.index)}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </button>

          {slides.length > 1 && (
            <button
              onClick={() => handleDeleteSlide(showContextMenu.index)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SlideStrip;
