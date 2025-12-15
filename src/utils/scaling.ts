import { useState, useEffect } from 'react';

/**
 * Utility functions for handling slide scaling in drag and resize operations
 */

/**
 * Gets the current scale factor of the reveal.js presentation
 * @param revealContainer - The reveal.js container element
 * @returns The scale factor (1.0 = no scaling)
 */
export function getRevealScale(revealContainer: HTMLElement): number {
  const slidesElement = revealContainer.querySelector('.slides') as HTMLElement;
  if (!slidesElement) return 1;

  const transform = window.getComputedStyle(slidesElement).transform;
  if (transform === 'none') return 1;

  // Parse transform matrix to extract scale
  const matrix = transform.match(/matrix.*\((.+)\)/);
  if (!matrix) return 1;

  const values = matrix[1].split(', ');
  // For 2D transform matrix(a, b, c, d, tx, ty), scale is the 'a' value
  return parseFloat(values[0]) || 1;
}

/**
 * Gets the reveal.js container from the DOM
 * @returns The reveal container element or null if not found
 */
export function getRevealContainer(): HTMLElement | null {
  return document.querySelector('.reveal') as HTMLElement;
}

/**
 * Adjusts mouse delta values based on the current slide scale
 * @param deltaX - Raw mouse delta X
 * @param deltaY - Raw mouse delta Y
 * @param scale - Current slide scale factor
 * @returns Adjusted delta values
 */
export function adjustDeltaForScale(deltaX: number, deltaY: number, scale: number): { deltaX: number; deltaY: number } {
  return {
    deltaX: deltaX / scale,
    deltaY: deltaY / scale
  };
}

/**
 * Gets the effective bounds for dragging considering scale
 * @param parentElement - The parent container element
 * @param scale - Current slide scale factor
 * @returns Adjusted bounds object
 */
export function getScaledBounds(parentElement: HTMLElement, scale: number): { left: number; top: number; right: number; bottom: number } {
  const rect = parentElement.getBoundingClientRect();
  return {
    left: 0,
    top: 0,
    right: rect.width / scale,
    bottom: rect.height / scale
  };
}

/**
 * Converts screen coordinates to slide coordinates
 * @param screenX - Screen X coordinate
 * @param screenY - Screen Y coordinate
 * @param slideContainer - The slide container element
 * @param scale - Current slide scale factor
 * @returns Slide coordinates
 */
export function screenToSlideCoordinates(
  screenX: number, 
  screenY: number, 
  slideContainer: HTMLElement, 
  scale: number
): { x: number; y: number } {
  const rect = slideContainer.getBoundingClientRect();
  return {
    x: (screenX - rect.left) / scale,
    y: (screenY - rect.top) / scale
  };
}

/**
 * Hook to get the current reveal.js scale factor
 * Updates automatically when the window resizes
 */
export function useRevealScale(): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const container = getRevealContainer();
      if (container) {
        const newScale = getRevealScale(container);
        setScale(newScale);
      }
    };

    // Update scale on mount
    updateScale();

    // Update scale on window resize
    window.addEventListener('resize', updateScale);
    
    // Also listen for reveal.js resize events if available
    const container = getRevealContainer();
    if (container) {
      container.addEventListener('resize', updateScale);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      if (container) {
        container.removeEventListener('resize', updateScale);
      }
    };
  }, []);

  return scale;
}
