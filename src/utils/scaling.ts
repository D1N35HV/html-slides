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
 * Hook to get the current reveal.js scale factor.
 *
 * Reveal applies its transform: scale() to `.slides` asynchronously after
 * layout, and often without firing a window resize (e.g. on slide change
 * or content change). Listening only to `window.resize` leaves `scale`
 * stale at its initial `1`, which causes react-draggable to under-translate
 * the element so it visibly trails the cursor. Observe `.slides` directly:
 *   - ResizeObserver: catches size changes from any cause.
 *   - MutationObserver on style: catches the inline transform update.
 */
export function useRevealScale(): number {
  const [scale, setScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const container = getRevealContainer();
    return container ? getRevealScale(container) : 1;
  });

  useEffect(() => {
    const updateScale = () => {
      const container = getRevealContainer();
      if (!container) return;
      const newScale = getRevealScale(container);
      setScale((prev) => (prev === newScale ? prev : newScale));
    };

    updateScale();
    window.addEventListener('resize', updateScale);

    const container = getRevealContainer();
    const slides = container?.querySelector('.slides');
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    if (slides instanceof HTMLElement) {
      ro = new ResizeObserver(updateScale);
      ro.observe(slides);
      mo = new MutationObserver(updateScale);
      mo.observe(slides, { attributes: true, attributeFilter: ['style'] });
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return scale;
}
