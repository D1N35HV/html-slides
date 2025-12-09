import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/index.ts';

interface EditableElementProps {
  elementId: string;
  content: string;
  type: 'text' | 'heading';
}

export function EditableElement({ elementId, content, type }: EditableElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { updateTextElement, updateHeadingElement } = useStore();
  const elementRef = useRef<HTMLDivElement>(null);

  // Helper function to update content based on element type
  const updateElementContent = (elementId: string, content: string) => {
    if (type === 'text') {
      updateTextElement(elementId, { content });
    } else if (type === 'heading') {
      updateHeadingElement(elementId, { content });
    }
  };

  useEffect(() => {
    if (isEditing && elementRef.current) {
      elementRef.current.focus();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (elementRef.current) {
      updateElementContent(elementId, elementRef.current.innerText);
    }
  };

  return (
    <div
      ref={elementRef}
      contentEditable={isEditing}
      onDoubleClick={handleDoubleClick}
      onBlur={handleBlur}
      className={`outline-none select-text min-w-[100px] min-h-[20px] ${
        type === 'heading' ? 'text-2xl font-bold text-gray-900' : 'text-base text-gray-800'
      } ${
        isEditing 
          ? 'border-2 border-blue-500 p-2 bg-white shadow-sm rounded' 
          : 'hover:bg-gray-50 p-1 rounded border border-transparent hover:border-gray-200'
      }`}
      suppressContentEditableWarning
    >
      {content}
    </div>
  );
}