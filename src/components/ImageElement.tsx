import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/index';
import { useCropModeStore } from '../store/useCropModeStore';
import { resolveMediaUrl } from '../lib/utils';
import { useRevealScale } from '../utils/scaling';
import { X, Check, RotateCcw } from 'lucide-react';

interface ImageElementProps {
  elementId: string;
  imageUrl?: string;
  mode?: 'edit' | 'present';
  opacity?: number;
  flipX?: boolean;
  flipY?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  originalWidth?: number;
  originalHeight?: number;
}

export function ImageElement({
  elementId,
  imageUrl,
  mode = 'edit',
  opacity = 1,
  flipX = false,
  flipY = false,
  objectFit = 'cover',
  cropX = 0,
  cropY = 0,
  cropWidth = 100,
  cropHeight = 100,
  originalWidth,
  originalHeight
}: ImageElementProps) {
  const [currentImageUrl, setCurrentImageUrl] = useState(resolveMediaUrl(imageUrl) || '');
  const updateImageElement = useStore((s) => s.updateImageElement);
  const updateElementSize = useStore((s) => s.updateElementSize);
  const updateElementPosition = useStore((s) => s.updateElementPosition);
  // Narrow selector: subscribe only to this image's element row.
  const element = useStore((s) => s.slides[s.currentSlide]?.elements.find(el => el.id === elementId));
  const { cropModeElementId, setCropModeElementId } = useCropModeStore();

  const scale = useRevealScale();

  const isCropMode = cropModeElementId === elementId;
  const elementSize = element?.size || { width: 300, height: 200 };
  const elementPosition = element?.position || { x: 0, y: 0 };

  // Check if crop is already applied
  const hasCrop = cropX !== 0 || cropY !== 0 || cropWidth !== 100 || cropHeight !== 100;

  // Image dimensions for crop mode - start with original or element size
  const [imgDimensions, setImgDimensions] = useState({
    width: hasCrop && originalWidth ? originalWidth : elementSize.width,
    height: hasCrop && originalHeight ? originalHeight : elementSize.height
  });

  // Image position state - where the full image sits relative to the container top-left
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  // Crop selection rectangle, in container-local coords. Purely local to the
  // crop session — the underlying element is only mutated on Apply, so dragging
  // the image or resizing the crop window never moves the element, never
  // touches other elements, and never triggers autosave/collab patches.
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isResizingCrop, setIsResizingCrop] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startImageOffset, setStartImageOffset] = useState({ x: 0, y: 0 });
  const [startCropRect, setStartCropRect] = useState({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    setCurrentImageUrl(resolveMediaUrl(imageUrl) || '');
  }, [imageUrl]);

  // Initialize when entering crop mode
  useEffect(() => {
    if (isCropMode) {
      // Check if there's an actual crop applied (crop values differ from defaults)
      const hasActiveCrop = cropX !== 0 || cropY !== 0 || cropWidth !== 100 || cropHeight !== 100;

      if (hasActiveCrop && originalWidth && originalWidth > 0 && originalHeight && originalHeight > 0) {
        // Re-entering crop mode with existing crop - show the full original image,
        // offset so the currently-cropped region lines up with the container origin.
        setImgDimensions({ width: originalWidth, height: originalHeight });
        setImageOffset({ x: -(cropX / 100) * originalWidth, y: -(cropY / 100) * originalHeight });
      } else {
        // Fresh crop - use current element size as the image dimensions
        setImgDimensions({ width: elementSize.width, height: elementSize.height });
        setImageOffset({ x: 0, y: 0 });
      }
      // Crop window starts matching the visible element area (container box).
      setCropRect({ x: 0, y: 0, width: elementSize.width, height: elementSize.height });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCropMode]);

  const transformStyle = `${flipX ? 'scaleX(-1)' : ''} ${flipY ? 'scaleY(-1)' : ''}`.trim() || 'none';

  // Image drag handlers — moves the image behind a fixed crop window, choosing
  // which part of the image the crop covers. Element is untouched until Apply.
  const handleImageMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartImageOffset({ ...imageOffset });
  };

  // Crop resize handlers — resizes the local crop rectangle only.
  const handleCropResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingCrop(true);
    setResizeHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartCropRect({ ...cropRect });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dx = (e.clientX - startPos.x) / scale;
    const dy = (e.clientY - startPos.y) / scale;

    // Image bounds in container-local coordinates.
    const imgLeft = imageOffset.x;
    const imgTop = imageOffset.y;
    const imgRight = imageOffset.x + imgDimensions.width;
    const imgBottom = imageOffset.y + imgDimensions.height;

    if (isDraggingImage) {
      // Move the image; the crop window stays put. Clamp so the crop rectangle
      // never extends past the image edges.
      let nx = startImageOffset.x + dx;
      let ny = startImageOffset.y + dy;
      nx = Math.min(cropRect.x, Math.max(cropRect.x + cropRect.width - imgDimensions.width, nx));
      ny = Math.min(cropRect.y, Math.max(cropRect.y + cropRect.height - imgDimensions.height, ny));
      setImageOffset({ x: nx, y: ny });
    } else if (isResizingCrop && resizeHandle) {
      const MIN = 30;
      let { x, y, width, height } = startCropRect;
      const right = x + width;
      const bottom = y + height;

      if (resizeHandle.includes('w')) {
        const nx = Math.max(imgLeft, Math.min(x + dx, right - MIN));
        x = nx;
        width = right - nx;
      } else if (resizeHandle.includes('e')) {
        const nr = Math.min(imgRight, Math.max(right + dx, x + MIN));
        width = nr - x;
      }

      if (resizeHandle.includes('n')) {
        const ny = Math.max(imgTop, Math.min(y + dy, bottom - MIN));
        y = ny;
        height = bottom - ny;
      } else if (resizeHandle.includes('s')) {
        const nb = Math.min(imgBottom, Math.max(bottom + dy, y + MIN));
        height = nb - y;
      }

      setCropRect({ x, y, width, height });
    }
  }, [isDraggingImage, isResizingCrop, resizeHandle, startPos, startImageOffset, startCropRect, scale, imageOffset, imgDimensions, cropRect]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingImage(false);
    setIsResizingCrop(false);
    setResizeHandle(null);
  }, []);

  useEffect(() => {
    if (isDraggingImage || isResizingCrop) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingImage, isResizingCrop, handleMouseMove, handleMouseUp]);

  const handleApplyCrop = useCallback(() => {
    const imgW = imgDimensions.width;
    const imgH = imgDimensions.height;
    const clamp = (v: number) => Math.max(0, Math.min(100, v));

    // Crop region expressed as a fraction of the full image.
    const newCropX = clamp(((cropRect.x - imageOffset.x) / imgW) * 100);
    const newCropY = clamp(((cropRect.y - imageOffset.y) / imgH) * 100);
    const newCropWidth = clamp((cropRect.width / imgW) * 100);
    const newCropHeight = clamp((cropRect.height / imgH) * 100);

    // Commit everything in one shot. Size becomes the crop window's size, and
    // the element shifts so the crop appears where the rectangle was drawn.
    updateElementSize(elementId, { width: cropRect.width, height: cropRect.height });
    updateImageElement(elementId, {
      cropX: newCropX,
      cropY: newCropY,
      cropWidth: newCropWidth,
      cropHeight: newCropHeight,
      originalWidth: imgW,
      originalHeight: imgH
    });
    updateElementPosition(elementId, {
      x: elementPosition.x + cropRect.x,
      y: elementPosition.y + cropRect.y
    });

    setCropModeElementId(null);
  }, [imageOffset, imgDimensions, cropRect, elementPosition, elementId, updateElementSize, updateImageElement, updateElementPosition, setCropModeElementId]);

  const handleCancelCrop = useCallback(() => {
    setCropModeElementId(null);
  }, [setCropModeElementId]);

  const handleResetCrop = useCallback(() => {
    // Reset element to original dimensions if available
    if (originalWidth && originalHeight && originalWidth > 0 && originalHeight > 0) {
      updateElementSize(elementId, { width: originalWidth, height: originalHeight });
    }
    // Clear all crop values - set originalWidth/Height to 0 to indicate no active crop
    updateImageElement(elementId, {
      cropX: 0, cropY: 0, cropWidth: 100, cropHeight: 100,
      originalWidth: 0, originalHeight: 0
    });
    setCropModeElementId(null);
  }, [elementId, originalWidth, originalHeight, updateElementSize, updateImageElement, setCropModeElementId]);

  useEffect(() => {
    if (!isCropMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); handleApplyCrop(); }
      else if (e.key === 'Escape') { e.preventDefault(); handleCancelCrop(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCropMode, handleApplyCrop, handleCancelCrop]);

  // =====================
  // CROP MODE UI
  // =====================
  if (isCropMode && currentImageUrl) {
    return (
      <div className="w-full h-full relative crop-mode-active" style={{ opacity: 1, overflow: 'visible' }}>
        {/* Full original image - overflows element bounds. Dragging it pans the
            image behind the fixed crop window. */}
        <div
          className="absolute cursor-move"
          style={{
            left: imageOffset.x,
            top: imageOffset.y,
            width: imgDimensions.width,
            height: imgDimensions.height,
            zIndex: 10
          }}
          onMouseDown={handleImageMouseDown}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <img
            src={currentImageUrl}
            alt=""
            className="cropped-image"
            style={{
              width: imgDimensions.width,
              height: imgDimensions.height,
              objectFit: 'fill',
              userSelect: 'none',
              pointerEvents: 'none'
            }}
          />
        </div>

        {/* Crop window border + darkened overlay outside it */}
        <div
          className="absolute border-2 border-dashed border-cyan-400 pointer-events-none z-20"
          style={{
            left: cropRect.x,
            top: cropRect.y,
            width: cropRect.width,
            height: cropRect.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)'
          }}
        />

        {/* Crop resize handles - positioned on the crop window edges */}
        {['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'].map(handle => {
          const isCorner = handle.length === 2;
          const size = isCorner ? 12 : 8;
          // Compute the handle center along each axis from the crop rectangle.
          const centerX = handle.includes('w')
            ? cropRect.x
            : handle.includes('e')
              ? cropRect.x + cropRect.width
              : cropRect.x + cropRect.width / 2;
          const centerY = handle.includes('n')
            ? cropRect.y
            : handle.includes('s')
              ? cropRect.y + cropRect.height
              : cropRect.y + cropRect.height / 2;
          const style: React.CSSProperties = {
            position: 'absolute',
            left: centerX - size / 2,
            top: centerY - size / 2,
            width: size,
            height: size,
            backgroundColor: 'white', border: '2px solid #06b6d4',
            borderRadius: isCorner ? 2 : 1, zIndex: 30, cursor: `${handle}-resize`
          };
          return (
            <div
              key={handle}
              style={style}
              onMouseDown={(e) => handleCropResizeMouseDown(e, handle)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          );
        })}

        {/* Action buttons */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-30" style={{ top: '100%', marginTop: 12 }}>
          <div className="bg-black/80 text-white text-xs px-2 py-1 rounded">
            Drag to move crop area • Resize handles to adjust size
          </div>
          <div className="flex gap-2">
            <button onClick={handleResetCrop} className="px-3 py-1.5 bg-gray-600 text-white rounded-lg shadow-lg text-xs font-medium hover:bg-gray-700 flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button onClick={handleCancelCrop} className="px-3 py-1.5 bg-white text-gray-700 rounded-lg shadow-lg text-xs font-medium hover:bg-gray-100 flex items-center gap-1">
              <X className="w-3 h-3" /> Cancel
            </button>
            <button onClick={handleApplyCrop} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg shadow-lg text-xs font-medium hover:bg-purple-700 flex items-center gap-1">
              <Check className="w-3 h-3" /> Apply
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // NORMAL DISPLAY MODE  
  // =====================
  return (
    <div
      className={`w-full h-full relative overflow-hidden rounded-lg border-2 transition-all duration-200 ${mode === 'edit' ? 'cursor-pointer group border-transparent hover:border-blue-200' : 'cursor-default border-transparent'}`}
      style={{ opacity }}
    >
      {currentImageUrl && currentImageUrl.trim() !== '' ? (
        hasCrop && originalWidth && originalHeight ? (
          <img
            src={currentImageUrl}
            alt="Slide content"
            className="cropped-image"
            style={{
              position: 'absolute',
              width: originalWidth,
              height: originalHeight,
              left: -(cropX / 100) * originalWidth,
              top: -(cropY / 100) * originalHeight,
              transform: transformStyle,
              transformOrigin: 'top left',
              maxWidth: 'none',
              maxHeight: 'none',
              objectFit: 'none'
            }}
            onError={() => setCurrentImageUrl('')}
          />
        ) : (
          <img
            src={currentImageUrl}
            alt="Slide content"
            className="w-full h-full"
            style={{ objectFit: objectFit, transform: transformStyle }}
            onError={() => setCurrentImageUrl('')}
          />
        )
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
          <div className="text-center">
            <div className="text-4xl text-gray-400 mb-2">🖼</div>
            <div className="text-sm text-gray-500 font-medium">Add Image</div>
            <div className="text-xs text-gray-400 mt-1">Click to select</div>
          </div>
        </div>
      )}

      {mode === 'edit' && !hasCrop && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded transition-opacity duration-200">
          {currentImageUrl ? 'Edit image' : 'Add image'}
        </div>
      )}
    </div>
  );
}
