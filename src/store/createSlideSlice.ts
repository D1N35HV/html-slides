import { StateCreator } from 'zustand';
import { SlideState, SlideActions, Store } from './sliceTypes';
import collaborationService from '../services/CollaborationService';

export const createSlideSlice: StateCreator<
  Store,
  [],
  [],
  SlideState & SlideActions
> = (set, get) => ({
  slides: [{
    id: '1',
    elements: [
      {
        id: 'demo-heading',
        type: 'heading',
        content: '<h1>Welcome to Rich Text Editing!</h1>',
        level: 1,
        position: { x: 50, y: 50 },
        size: { width: 1700, height: 200 },
        zIndex: 1
      },
      {
        id: 'demo-text',
        type: 'text',
        content: '<p>Double-click any text to edit with the <strong>full-featured</strong> rich text editor. Try changing fonts, colors, adding lists, and more!</p>',
        position: { x: 400, y: 300 },
        size: { width: 800, height: 200 },
        zIndex: 2
      }
    ]
  }],
  currentSlide: 0,
  selectedElementId: null,
  selectedElementIds: [],
  editingElementId: null,
  globalDragState: {
    isDragging: false,
    hasMoved: false,
  },
  addSlide: () => {
    set((state) => {
      const source = state.slides[state.currentSlide];
      return {
        slides: [...state.slides, {
          id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          elements: [],
          ...(source?.backgroundColor ? { backgroundColor: source.backgroundColor } : {}),
        }],
        currentSlide: state.slides.length,
      };
    });
    // Save to history after adding slide
    setTimeout(() => {
      get().saveToHistory();
    }, 0);
  },
  removeSlide: (index) => {
    set((state) => ({
      slides: state.slides.filter((_, i) => i !== index),
      currentSlide: Math.max(0, state.currentSlide - 1),
    }));
    // Save to history after removing slide
    setTimeout(() => {
      get().saveToHistory();
    }, 0);
  },
  setCurrentSlide: (index) => set({ currentSlide: index }),
  setSlides: (slides, currentIndex = 0) => {
    set(() => {
      const safeSlides = (slides && slides.length > 0)
        ? slides
        : [{ id: `slide-${Date.now()}`, elements: [] }];
      return {
        slides: safeSlides,
        currentSlide: Math.min(currentIndex, Math.max(0, safeSlides.length - 1)),
        selectedElementId: null,
        selectedElementIds: [],
        editingElementId: null
      };
    });

    // Save to history after a short delay to ensure the state is properly set
    setTimeout(() => {
      const state = get();
      if (state.slides && state.slides.length > 0) {
        state.saveToHistory();
      }
    }, 100);
  },
  updateSlideBackground: (slideId, backgroundColor) => {
    set((state) => ({
      slides: state.slides.map(slide =>
        slide.id === slideId
          ? { ...slide, backgroundColor, thumbnailExpired: true } // Flag thumbnail for regeneration
          : slide
      )
    }));
    collaborationService.sendSlidePatch(slideId, { backgroundColor });
  },
  updateSlide: (slideIndex, updates) => {
    set((state) => ({
      slides: state.slides.map((slide, index) =>
        index === slideIndex
          ? { ...slide, ...updates, thumbnailExpired: true } // Flag thumbnail for regeneration
          : slide
      )
    }));
  },
  applyTransitionToAll: (transition, transitionSpeed) => {
    set((state) => ({
      slides: state.slides.map(slide => ({
        ...slide,
        transition,
        ...(transitionSpeed !== undefined && { transitionSpeed })
      }))
    }));
    // Save to history after applying to all
    setTimeout(() => {
      get().saveToHistory();
    }, 0);
  },
});