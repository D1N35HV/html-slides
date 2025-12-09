import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useLayoutStore } from '../store/layoutStore';

export function EditorToggle() {
  const { isEditorMinimized, toggleEditorMinimized } = useLayoutStore();

  return (
    <button
      onClick={toggleEditorMinimized}
      className={
        `absolute top-1/2 -translate-y-1/2  bg-white  ${isEditorMinimized ? '' : 'left-[-5px]'}  border border-gray-300 py-2 rounded-md shadow-md hover:bg-gray-50 hover:shadow-lg z-20 transition-all duration-200`
      } 
      title={isEditorMinimized ? 'Show Sidebar' : 'Hide Sidebar'}
    >
      {isEditorMinimized ? (
        <ChevronRightIcon className="w-3 h-5 text-gray-600" />
      ) : (
        <ChevronLeftIcon className="w-3 h-5 text-gray-600" />
      )}
    </button>
  );
}
