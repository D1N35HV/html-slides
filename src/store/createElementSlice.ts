import { StateCreator } from 'zustand';
import { ElementActions, Store, SlideElement } from './sliceTypes';
import { debounce } from '../utils/debounce';
import collaborationService from '../services/CollaborationService';

export const createElementSlice: StateCreator<
  Store,
  [],
  [],
  ElementActions
> = (set, get) => {
  // Helper function to save state and trigger history save
  const setWithHistory = (updater: (state: Store) => Partial<Store>) => {
    set(updater);
    // Save to history after the state update
    setTimeout(() => {
      get().saveToHistory();
    }, 0);
  };

  // Debounced version for operations that happen frequently (like dragging)
  const setWithDebouncedHistory = (updater: (state: Store) => Partial<Store>) => {
    set(updater);
    debouncedHistorySave();
  };

  // Debounce history saving for frequent operations (500ms delay)
  const debouncedHistorySave = debounce(() => {
    get().saveToHistory();
  }, 500);

  return { 
    updateElementPosition: (elementId, position) => {
      setWithDebouncedHistory((state) => ({
        slides: state.slides.map((slide, i) => 
          i === state.currentSlide
            ? {
                ...slide,
                elements: (slide.elements || []).map(element =>
                  element.id === elementId
                    ? { ...element, position }
                    : element
                )
              }
            : slide
        )
      }));
      // Real-time patch emit
      const slides = get().slides;
      const currentSlide = get().currentSlide;
      const slide = slides[currentSlide];
      if (slide) {
        collaborationService.sendElementPatch(slide.id, elementId, { position });
      }
    },

    updateElementSize: (elementId, size) => {
      setWithDebouncedHistory((state) => ({
        slides: state.slides.map((slide, i) => 
          i === state.currentSlide
            ? {
                ...slide,
                elements: (slide.elements || []).map(element =>
                  element.id === elementId
                    ? { ...element, size }
                    : element
                )
              }
            : slide
        )
      }));
      const slides = get().slides;
      const currentSlide = get().currentSlide;
      const slide = slides[currentSlide];
      if (slide) {
        collaborationService.sendElementPatch(slide.id, elementId, { size });
      }
    },

    updateElementRotation: (elementId, rotation) => {
      setWithDebouncedHistory((state) => ({
        slides: state.slides.map((slide, i) => 
          i === state.currentSlide
            ? {
                ...slide,
                elements: (slide.elements || []).map(element =>
                  element.id === elementId
                    ? { ...element, rotation }
                    : element
                )
              }
            : slide
        )
      }));
      const slides = get().slides;
      const currentSlide = get().currentSlide;
      const slide = slides[currentSlide];
      if (slide) {
        collaborationService.sendElementPatch(slide.id, elementId, { rotation });
      }
    },

  updateElementContent: (elementId, content, additionalProps = {}) => {
    setWithDebouncedHistory((state) => ({
      slides: state.slides.map((slide, i) => 
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).map(element =>
                element.id === elementId
                  ? { ...element, content, ...additionalProps }
                  : element
              )
            }
          : slide
      )
    }));
    // Real-time patch emit
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      collaborationService.sendElementPatch(slide.id, elementId, { content, ...additionalProps });
    }
  },

  updateTextElement: (elementId, updates) => {
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) =>
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).map(element =>
                element.id === elementId && element.type === 'text'
                  ? { ...element, ...updates }
                  : element
              )
            }
          : slide
      )
    }));
    // Real-time patch emit
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      collaborationService.sendElementPatch(slide.id, elementId, updates);
    }
  },

  updateHeadingElement: (elementId, updates) => {
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) =>
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).map(element =>
                element.id === elementId && element.type === 'heading'
                  ? { ...element, ...updates }
                  : element
              )
            }
          : slide
      )
    }));
    // Real-time patch emit
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      collaborationService.sendElementPatch(slide.id, elementId, updates);
    }
  },

  updateImageElement: (elementId, updates) => {
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) =>
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).map(element =>
                element.id === elementId && element.type === 'image'
                  ? { ...element, ...updates }
                  : element
              )
            }
          : slide
      )
    }));
    // Real-time patch emit
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      collaborationService.sendElementPatch(slide.id, elementId, updates);
    }
  },

  updateVideoElement: (elementId, updates) => {
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) =>
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).map(element =>
                element.id === elementId && element.type === 'video'
                  ? { ...element, ...updates }
                  : element
              )
            }
          : slide
      )
    }));
    // Real-time patch emit
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      collaborationService.sendElementPatch(slide.id, elementId, updates);
    }
  },

  updateShapeElement: (elementId, updates) => {
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) =>
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).map(element =>
                element.id === elementId && element.type === 'shape'
                  ? { ...element, ...updates }
                  : element
              )
            }
          : slide
      )
    }));
    // Real-time patch emit
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      collaborationService.sendElementPatch(slide.id, elementId, updates);
    }
  },

  addElement: (slideIndex, element) => {
    let elementId = '';
    let newElement: SlideElement;
    setWithHistory((state) => {
      const slide = state.slides[slideIndex];
      const existingElements = slide?.elements || [];
      
      // Calculate a position that doesn't overlap with existing elements
      let newX = element.position?.x || 50;
      let newY = element.position?.y || 50;
      
      // Check for overlapping elements and adjust position if needed
      const hasOverlap = (x: number, y: number) => 
        existingElements.some(el => 
          Math.abs((el.position?.x || 0) - x) < 100 && 
          Math.abs((el.position?.y || 0) - y) < 100
        );
      
      while (hasOverlap(newX, newY)) {
        newX += 50;
        newY += 50;
        // Wrap around if we go too far right or down
        if (newX > 600) {
          newX = 50;
          newY += 100;
        }
        if (newY > 500) {
          newY = 50;
        }
      }
      
      elementId = `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      newElement = {
        ...element,
        id: elementId,
        size: element.size || { width: 200, height: 100 },
        position: { x: newX, y: newY },
        zIndex: element.zIndex || 1
      } as SlideElement;
      
      return {
        slides: state.slides.map((slide, i) =>
          i === slideIndex
            ? {
                ...slide,
                elements: [...(slide.elements || []), newElement]
              }
            : slide
        )
      };
    });
    
    // Send collaboration patch to sync with other users
    // Use setTimeout to ensure state has been updated
    setTimeout(() => {
      const slides = get().slides;
      const slide = slides[slideIndex];
      if (slide && newElement) {
        collaborationService.sendSlidePatch(slide.id, { 
          elements: slide.elements 
        });
      }
    }, 0);
    
    return elementId;
  },

  removeElement: (elementId) => {
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) => 
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).filter(element => element.id !== elementId)
            }
          : slide
      )
    }));
    
    // Send collaboration patch to sync element removal with other users
    setTimeout(() => {
      const slides = get().slides;
      const currentSlide = get().currentSlide;
      const slide = slides[currentSlide];
      if (slide) {
        collaborationService.sendSlidePatch(slide.id, { 
          elements: slide.elements || []
        });
      }
    }, 0);
  },

  updateElementZIndex: (elementId, zIndex) => {
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) => 
        i === state.currentSlide
          ? {
              ...slide,
              elements: (slide.elements || []).map(element =>
                element.id === elementId
                  ? { ...element, zIndex }
                  : element
              )
            }
          : slide
      )
    }));
    // Real-time patch emit
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      collaborationService.sendElementPatch(slide.id, elementId, { zIndex });
    }
  },

  setSelectedElement: (elementId) =>
    set((state) => ({ 
      selectedElementId: elementId,
      selectedElementIds: elementId ? [elementId] : []
    })),

  setSelectedElements: (elementIds) =>
    set(() => ({
      selectedElementIds: [...new Set(elementIds)],
      selectedElementId: elementIds.length === 1 ? elementIds[0] : null
    })),

  toggleElementSelection: (elementId) =>
    set((state) => {
      const exists = state.selectedElementIds.includes(elementId);
      const selectedElementIds = exists
        ? state.selectedElementIds.filter(id => id !== elementId)
        : [...state.selectedElementIds, elementId];
      return {
        selectedElementIds,
        selectedElementId: selectedElementIds.length === 1 ? selectedElementIds[0] : null
      };
    }),

  clearSelection: () => set({ selectedElementId: null, selectedElementIds: [] }),

  removeSelectedElements: () => {
    const selectedElementIds = get().selectedElementIds;
    setWithHistory((state) => ({
      slides: state.slides.map((slide, i) =>
        i === state.currentSlide ? ({
          ...slide,
          elements: (slide.elements || []).filter(el => !state.selectedElementIds.includes(el.id))
        }) : slide
      ),
      selectedElementId: null,
      selectedElementIds: []
    }));
    
    // Send collaboration patch to sync element removal with other users
    setTimeout(() => {
      const slides = get().slides;
      const currentSlide = get().currentSlide;
      const slide = slides[currentSlide];
      if (slide) {
        collaborationService.sendSlidePatch(slide.id, { 
          elements: slide.elements || []
        });
      }
    }, 0);
  },

  updateMultipleElementPositions: (elementIds, delta, absolutePositions) => {
    setWithDebouncedHistory((state) => ({
      slides: state.slides.map((slide, i) =>
        i === state.currentSlide ? ({
          ...slide,
          elements: (slide.elements || []).map(el => {
            if (!elementIds.includes(el.id)) return el;
            if (absolutePositions && absolutePositions[el.id]) {
              return { ...el, position: absolutePositions[el.id] };
            }
            return { ...el, position: { x: el.position.x + delta.dx, y: el.position.y + delta.dy } };
          })
        }) : slide
      )
    }));
    // Real-time patch emit for each element
    const slides = get().slides;
    const currentSlide = get().currentSlide;
    const slide = slides[currentSlide];
    if (slide) {
      elementIds.forEach(elementId => {
        const element = slide.elements?.find(el => el.id === elementId);
        if (element) {
          const newPosition = absolutePositions && absolutePositions[elementId] 
            ? absolutePositions[elementId]
            : { x: element.position.x + delta.dx, y: element.position.y + delta.dy };
          collaborationService.sendElementPatch(slide.id, elementId, { position: newPosition });
        }
      });
    }
  },

  setEditingElement: (elementId) =>
    set({ editingElementId: elementId }),

  setGlobalDragState: (isDragging, hasMoved = false) =>
    set({ globalDragState: { isDragging, hasMoved } }),

  // Optimized: only update if values actually changed to prevent unnecessary re-renders
  setAlignmentGuides: (elementId, position, size) =>
    set((state) => {
      const current = state.alignmentGuides;
      // Skip update if nothing changed (reference equality check for performance)
      if (
        current.activeElementId === elementId &&
        current.activePosition?.x === position?.x &&
        current.activePosition?.y === position?.y &&
        current.activeSize?.width === size?.width &&
        current.activeSize?.height === size?.height
      ) {
        return state; // Return same state to prevent re-render
      }
      return {
        alignmentGuides: {
          activeElementId: elementId,
          activePosition: position || null,
          activeSize: size || null,
          isActive: elementId !== null,
        }
      };
    }),

  clearAlignmentGuides: () =>
    set((state) => {
      // Skip if already cleared
      if (!state.alignmentGuides.isActive) {
        return state;
      }
      return {
        alignmentGuides: {
          activeElementId: null,
          activePosition: null,
          activeSize: null,
          isActive: false,
        }
      };
    }),
  };
};