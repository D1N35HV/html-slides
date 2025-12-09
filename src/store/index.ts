import { create } from 'zustand';
import { createSlideSlice } from './createSlideSlice';
import { createElementSlice } from './createElementSlice';
import { createHistorySlice } from './createHistorySlice';
import type { Store } from './sliceTypes';
import collaborationService from '../services/CollaborationService';

let isRemotePatch = false;

export const useStore = create<Store>()((set, get, api) => {
  const store = {
    // Order: slide state first so element actions have immediate access
    ...createSlideSlice(set, get, api),
    ...createElementSlice(set, get, api),
    ...createHistorySlice(set, get, api),
    setRemotePatch(flag: boolean) {
      isRemotePatch = flag;
    },
    getRemotePatch() {
      return isRemotePatch;
    }
  };

  // Initialize history with the initial state only if slides exist
  setTimeout(() => {
    const currentState = get();
    if (currentState.slides && currentState.slides.length > 0) {
      currentState.saveToHistory();
    }
  }, 100);

  // Real-time patch listener
  collaborationService.onRemotePatch((patch) => {
    store.setRemotePatch(true);
    const slides = get().slides;
    if ('elementId' in patch) {
      // Element patch - update specific element properties
      const slideIdx = slides.findIndex(s => s.id === patch.slideId);
      if (slideIdx !== -1) {
        set((state) => ({
          slides: state.slides.map((slide, i) =>
            i === slideIdx
              ? {
                ...slide,
                elements: (slide.elements || []).map(element =>
                  element.id === patch.elementId
                    ? { ...element, ...patch.changes }
                    : element
                )
              }
              : slide
          )
        }));
      }
    } else {
      // Slide patch - update slide properties (including elements array for add/remove)
      const slideIdx = slides.findIndex(s => s.id === patch.slideId);
      if (slideIdx !== -1) {
        set((state) => ({
          slides: state.slides.map((slide, i) =>
            i === slideIdx
              ? { ...slide, ...patch.changes }
              : slide
          )
        }));
      }
    }
    setTimeout(() => store.setRemotePatch(false), 0);
  });

  // On initial_state, set slides from server
  collaborationService.onInitialState((data: { slides: any[]; version: number }) => {
    set((state) => ({
      slides: data.slides,
      currentSlide: 0,
      selectedElementId: null,
      selectedElementIds: [],
      editingElementId: null
    }));
  });

  // Listen for PPT conversion streaming events (for progress logging only)
  // Slides are kept in the template sidebar, not added to the deck
  collaborationService.onPPTProgress((event) => {
    if (event.type === 'slide') {
      console.log(`[Store] Streaming slide ${(event.slideIndex ?? 0) + 1}/${event.totalSlides ?? '?'} received`);
    } else if (event.type === 'init') {
      console.log(`[Store] PPT conversion started: ${event.totalSlides} slides`);
    } else if (event.type === 'complete') {
      console.log('[Store] PPT conversion complete');
    } else if (event.type === 'error') {
      console.error('[Store] PPT conversion error:', event.error);
    }
  });

  return store;
});

// Ensure setSlides exists at runtime (defensive for HMR edge cases)
const state: any = (useStore as any).getState();
if (typeof state.setSlides !== 'function') {
  (useStore as any).setState({
    setSlides: (slides: any[], currentIndex = 0) => {
      const safeSlides = (slides && slides.length > 0)
        ? slides
        : [{ id: `slide-${Date.now()}`, elements: [] }];
      (useStore as any).setState({
        slides: safeSlides,
        currentSlide: Math.min(currentIndex, Math.max(0, safeSlides.length - 1)),
        selectedElementId: null,
        selectedElementIds: [],
        editingElementId: null
      });
    }
  });
}