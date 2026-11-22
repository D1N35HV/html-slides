import React from 'react';
import { useStore } from '../store/index.ts';
import { useLayoutStore } from '../store/layoutStore';

// Legacy placeholder component (not actively used). Displays current slide debug info.
export function Editor() {
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const { isEditorMinimized } = useLayoutStore();

  if (isEditorMinimized) return null;

  const slide = slides[currentSlide];

  return (
    <div className="w-1/2 border-r border-gray-200 bg-gray-50 p-4 overflow-auto text-xs font-mono">
      <h3 className="font-semibold mb-2">Slide Debug</h3>
      <pre className="whitespace-pre-wrap">{JSON.stringify(slide, null, 2)}</pre>
    </div>
  );
}
