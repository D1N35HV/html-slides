import React from 'react';
import { useStore } from '../store/index';
import { useLayoutStore } from '../store/layoutStore';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export function Sidebar() {
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const addSlide = useStore((s) => s.addSlide);
  const removeSlide = useStore((s) => s.removeSlide);
  const { isEditorMinimized } = useLayoutStore();

  if (isEditorMinimized) {
    return null;
  }

  return (
    <div className="w-60 border-r border-gray-200 bg-white flex flex-col">
      {/* Slide Navigation Header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-900">Slides</h3>
          <div className="flex gap-1">
            <button
              onClick={addSlide}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 hover:text-gray-900"
              title="Add Slide"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => removeSlide(currentSlide)}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Remove Slide"
              disabled={slides.length <= 1}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide Thumbnails */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className={`
                relative p-2 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-sm
                ${
                  index === currentSlide
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }
              `}
            >
              {/* Slide Number */}
              <div className="absolute top-1 left-1 bg-gray-600 text-white text-xs px-1 py-0.5 rounded">
                {index + 1}
              </div>

              {/* Slide Preview */}
              <div className="min-h-[50px] mt-3">
                {slide.elements && slide.elements.length > 0 ? (
                  <div className="space-y-1">
                    {slide.elements.slice(0, 3).map((element) => (
                      <div
                        key={element.id}
                        className="text-xs text-gray-600 truncate bg-gray-50 px-1.5 py-0.5 rounded"
                      >
                        {element.type === 'heading' ? (
                          <span
                            className="font-semibold"
                            dangerouslySetInnerHTML={{
                              __html: (element.content || '').replace(/<[^>]*>/g, '').substring(0, 50)
                            }}
                          />
                        ) : element.type === 'text' ? (
                          <span dangerouslySetInnerHTML={{
                            __html: (element.content || '').replace(/<[^>]*>/g, '').substring(0, 50)
                          }} />
                        ) : (
                          <span className="italic">{element.type}</span>
                        )}
                      </div>
                    ))}
                    {slide.elements.length > 3 && (
                      <div className="text-xs text-gray-400">
                        +{slide.elements.length - 3} more elements
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-3">
                    Empty slide
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
