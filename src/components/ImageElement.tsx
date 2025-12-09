import React, { useState, useEffect } from 'react';
import { useStore } from '../store/index';
import { resolveMediaUrl } from '../lib/utils';

interface ImageElementProps {
  elementId: string;
  imageUrl?: string;
  mode?: 'edit' | 'present';
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
}

export function ImageElement({ elementId, imageUrl, mode = 'edit', opacity = 1, flipX = false, flipY = false, objectFit = 'cover' }: ImageElementProps) {
  const [currentImageUrl, setCurrentImageUrl] = useState(resolveMediaUrl(imageUrl) || '');
  const { setSelectedElement } = useStore();

  useEffect(() => {
    setCurrentImageUrl(resolveMediaUrl(imageUrl) || '');
  }, [imageUrl]);

  const transformStyle = `${flipX ? 'scaleX(-1)' : ''} ${flipY ? 'scaleY(-1)' : ''}`.trim() || 'none';

  return (
    <div 
      className={`w-full h-full relative overflow-hidden rounded-lg border-2 transition-all duration-200 ${mode==='edit' ? 'cursor-pointer group border-transparent hover:border-blue-200' : 'cursor-default border-transparent'}`}
      style={{ opacity }}
    >
      {currentImageUrl && currentImageUrl.trim() !== '' ? (
        <img
          src={currentImageUrl}
          alt="Slide content"
          className="w-full h-full"
          style={{ 
            objectFit: objectFit,
            transform: transformStyle
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            setCurrentImageUrl('');
          }}
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
          <div className="text-center">
            <div className="text-4xl text-gray-400 mb-2">🖼</div>
            <div className="text-sm text-gray-500 font-medium">Add Image</div>
            <div className="text-xs text-gray-400 mt-1">Click to select and add image URL</div>
          </div>
        </div>
      )}
      
      {mode === 'edit' && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded transition-opacity duration-200">
          {currentImageUrl && currentImageUrl.trim() !== '' ? 'Edit image' : 'Add image'}
        </div>
      )}
    </div>
  );
}
