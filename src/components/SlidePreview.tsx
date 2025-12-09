import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ResizableDraggableElement } from './ResizableDraggableElement';
import { CKEditorElement } from './CKEditorElement';
import { ImageElement } from './ImageElement';
import { VideoElement } from './VideoElement';
import { ShapeElement } from './ShapeElement';
import { AlignmentGuides, MemoizedAlignmentGuides } from './AlignmentGuides';
import { ImageToolbar } from './ImageToolbar';
import { ShapeToolbar } from './ShapeToolbar';
import { SlideToolbar } from './SlideToolbar';
import { useStore } from '../store/index';
import { useRevealScale } from '../utils/scaling';
import { resolveMediaUrl } from '../lib/utils';
import type { SlideElement } from '../store/sliceTypes';

function renderElement(element: SlideElement, mode: 'edit' | 'present') {
  switch (element.type) {
    case 'text':
    case 'heading':
      return (
        <CKEditorElement
          key={element.id}
          elementId={element.id}
          content={element.content}
          type={element.type}
          mode={mode}
          backgroundColor={element.backgroundColor}
        />
      );
    case 'image':
      return (
        <ImageElement
          key={element.id}
          elementId={element.id}
          imageUrl={element.imageUrl}
          mode={mode}
          opacity={element.opacity}
          flipX={element.flipX}
          flipY={element.flipY}
          objectFit={element.objectFit}
        />
      );
    case 'video':
      return (
        <VideoElement
          key={element.id}
          elementId={element.id}
          videoUrl={element.videoUrl}
        />
      );
    case 'shape':
      return (
        <ShapeElement
          key={element.id}
          elementId={element.id}
          shapeType={element.shapeType}
          fillColor={element.fillColor}
          borderColor={element.borderColor}
          borderWidth={element.borderWidth}
          cornerRadius={element.cornerRadius}
          opacity={element.opacity}
        />
      );
    default:
      return null;
  }
}

interface SlidePreviewProps {
  mode?: 'edit' | 'present';
}

export function SlidePreview({ mode = 'edit' }: SlidePreviewProps) {
  const { slides, currentSlide, setSelectedElement, setSelectedElements, clearSelection, selectedElementIds, selectedElementId, alignmentGuides } = useStore();
  const selectionRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragSelectingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [showSlideToolbar, setShowSlideToolbar] = useState(false);

  // Get the current reveal scale for accurate selection box positioning
  const scale = useRevealScale();

  // Get selected element type for toolbar display
  const selectedElement = selectedElementId
    ? slides[currentSlide]?.elements.find(el => el.id === selectedElementId)
    : null;

  // Helper to get latest element state by id
  const getElementById = (slide, id) => {
    return slide.elements.find(el => el.id === id);
  };

  // Force re-render when elements change to ensure proper event binding
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [slides.length, slides.map(s => s.elements?.length).join(',')]);

  // Additional effect to ensure reveal.js sync when component updates
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      console.log('SlidePreview updated - slides count:', slides.length);
    }, 50);
    return () => clearTimeout(timer);
  }, [slides.length, renderKey]);

  const handleSlideClick = (e: React.MouseEvent) => {
    // Only deselect if clicking on the slide background and show slide toolbar
    if (e.target === e.currentTarget) {
      clearSelection();
      setShowSlideToolbar(true);
    }
  };

  // Hide slide toolbar when an element is selected
  useEffect(() => {
    if (selectedElementId) {
      setShowSlideToolbar(false);
    }
  }, [selectedElementId]);

  const getCurrentSlideElements = () => {
    const slide = slides[currentSlide];
    return slide?.elements || [];
  };

  const elementsWithinBox = (box) => {
    const elements = getCurrentSlideElements();
    return elements.filter(el => {
      const { x, y } = el.position;
      const { width, height } = el.size;
      return x >= box.x && y >= box.y && (x + width) <= (box.x + box.w) && (y + height) <= (box.y + box.h);
    }).map(el => el.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // left only
    if (e.target !== e.currentTarget) return; // start only on empty space

    // Show slide toolbar when clicking on empty space
    clearSelection();
    setShowSlideToolbar(true);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Convert screen coordinates to slide coordinates using scale
    const startX = (e.clientX - rect.left) / scale;
    const startY = (e.clientY - rect.top) / scale;
    dragSelectingRef.current = true;
    dragStartRef.current = { x: startX, y: startY };
    setSelectionBox({ x: startX, y: startY, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragSelectingRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // Convert screen coordinates to slide coordinates using scale
    const currX = (e.clientX - rect.left) / scale;
    const currY = (e.clientY - rect.top) / scale;
    const start = dragStartRef.current;
    const box = {
      x: Math.min(start.x, currX),
      y: Math.min(start.y, currY),
      w: Math.abs(currX - start.x),
      h: Math.abs(currY - start.y),
    };
    setSelectionBox(box);
    const ids = elementsWithinBox(box);
    setSelectedElements(ids);
  };

  const handleMouseUp = () => {
    if (dragSelectingRef.current) {
      dragSelectingRef.current = false;
      setSelectionBox(prev => {
        if (prev && prev.w < 5 && prev.h < 5) {
          return null; // tiny click - already cleared earlier
        }
        return prev;
      });
      setTimeout(() => setSelectionBox(null), 150);
    }
  };

  // Delete key to remove selected elements
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementIds.length > 0) {
        const store: any = (useStore as any).getState();
        store.removeSelectedElements();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedElementIds]);

  return (
    <>
      {/* Element-specific toolbars */}
      {mode === 'edit' && selectedElement && selectedElement.type === 'image' && createPortal(
        <ImageToolbar elementId={selectedElement.id} />,
        document.body
      )}
      {mode === 'edit' && selectedElement && selectedElement.type === 'shape' && createPortal(
        <ShapeToolbar elementId={selectedElement.id} />,
        document.body
      )}
      {mode === 'edit' && showSlideToolbar && !selectedElementId && createPortal(
        <SlideToolbar slideIndex={currentSlide} />,
        document.body
      )}

      {slides.length === 0 ? (
        <section
          className="data-markdown h-full w-full relative"
          data-background-color="#ffffff"
        >
          <div className="w-full h-full flex items-center justify-center">
            <p className="text-gray-500">No slide content</p>
          </div>
        </section>
      ) : (
        slides.map((slide, slideIndex) => {
          const isCurrentSlide = slideIndex === currentSlide;

          return (
            <section
              key={`${slide.id}-${renderKey}`}
              className="data-markdown h-full w-full relative flex items-center justify-center"
              data-transition={slide.transition || 'slide'}
              data-transition-speed={slide.transitionSpeed || 'default'}
              style={{
                overflow: 'visible',
                backgroundColor: slide.backgroundColor || '#ffffff',
                backgroundImage: slide.backgroundImage ? `url(${resolveMediaUrl(slide.backgroundImage)})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Only render content for the current slide */}
              {isCurrentSlide && (
                <div className="relative h-full w-full" onClick={handleSlideClick} style={{ overflow: 'visible' }}>
                  <div
                    className="relative h-full w-full"
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {slide?.elements?.map((element) => {
                      // Get the latest element state from the store
                      const latestElement = getElementById(slide, element.id) || element;
                      const elementSize = latestElement.size || { width: 500, height: 200 };
                      const elementPosition = latestElement.position || { x: 50, y: 50 };
                      const editable = mode === 'edit';
                      return (
                        <ResizableDraggableElement
                          key={latestElement.id}
                          elementId={latestElement.id}
                          position={elementPosition}
                          size={elementSize}
                          rotation={latestElement.rotation}
                          zIndex={latestElement.zIndex}
                          isEditable={editable}
                        >
                          {renderElement(latestElement, mode)}
                        </ResizableDraggableElement>
                      );
                    })}
                    {(!slide?.elements || slide.elements.length === 0) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-gray-400">
                          <p className="text-lg mb-2">Empty Slide {slideIndex + 1}</p>
                          <p className="text-sm">Use the right sidebar to add text, images, videos or other elements</p>
                        </div>
                      </div>
                    )}
                    {selectionBox && (
                      <div
                        className="absolute border-2 border-blue-400 bg-blue-200/20 pointer-events-none"
                        style={{
                          left: selectionBox.x,
                          top: selectionBox.y,
                          width: selectionBox.w,
                          height: selectionBox.h,
                        }}
                      />
                    )}
                    {mode === 'edit' && alignmentGuides.isActive && (
                      <MemoizedAlignmentGuides
                        activeElementId={alignmentGuides.activeElementId || undefined}
                        activePosition={alignmentGuides.activePosition || undefined}
                        activeSize={alignmentGuides.activeSize || undefined}
                        containerSize={{ width: 1024, height: 768 }}
                      />
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })
      )}
    </>
  );
}