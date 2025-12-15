import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/index.ts';

interface ContextMenuProps {
  elementId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ elementId, x, y, onClose }: ContextMenuProps) {
  const { removeElement, removeSelectedElements, updateElementZIndex, setSelectedElement, selectedElementIds, clearSelection } = useStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleDelete = () => {
    if (selectedElementIds && selectedElementIds.length > 1 && selectedElementIds.includes(elementId)) {
      removeSelectedElements();
      clearSelection();
    } else {
      removeElement(elementId);
      setSelectedElement(null);
    }
    onClose();
  };

  const handleBringToFront = () => {
    // Get the highest z-index among all elements and add 1
    const { slides, currentSlide } = useStore.getState();
    const slide = slides[currentSlide];
    const maxZIndex = Math.max(
      ...(slide?.elements?.map(el => el.zIndex || 1) || [1])
    );
    const newZIndex = maxZIndex + 1;
    updateElementZIndex(elementId, newZIndex);
  };

  const handleSendToBack = () => {
    // Get the lowest z-index among all elements and subtract 1
    const { slides, currentSlide } = useStore.getState();
    const slide = slides[currentSlide];
    const minZIndex = Math.min(
      ...(slide?.elements?.map(el => el.zIndex || 1) || [1])
    );
    const newZIndex = Math.max(1, minZIndex - 1);
    updateElementZIndex(elementId, newZIndex);
  };

  // Adjust menu position to keep it within viewport
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-[10000] min-w-[160px]"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
    >
      {/* Layer Order Options */}
      <button
        onClick={handleBringToFront}
        className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
        Bring to Front
      </button>

      <button
        onClick={handleSendToBack}
        className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
        Send to Back
      </button>

      {/* Separator */}
      <div className="my-1 border-t border-gray-100"></div>

      {/* Delete Option */}
      <button
        onClick={handleDelete}
        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
  {selectedElementIds && selectedElementIds.length > 1 && selectedElementIds.includes(elementId) ? `Delete ${selectedElementIds.length} Elements` : 'Delete Element'}
      </button>
    </div>
  );

  return createPortal(menuContent, document.body);
}
