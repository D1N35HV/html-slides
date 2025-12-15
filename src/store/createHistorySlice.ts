import { StateCreator } from 'zustand';
import { Store, Slide, HistoryState, HistoryActions } from './sliceTypes';

export const createHistorySlice: StateCreator<
  Store,
  [],
  [],
  HistoryState & HistoryActions
> = (set, get) => ({
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  saveToHistory: () => {
    const state = get();
    const currentSlides = JSON.parse(JSON.stringify(state.slides)); // Deep clone
    
    // Don't save to history if slides array is empty or undefined
    if (!currentSlides || currentSlides.length === 0) {
      console.warn('[History] Skipping save to history - no slides to save');
      return;
    }
    
    set((state) => {
      // Remove any future history if we're not at the end
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      
      // Don't save duplicate states
      const lastState = newHistory[newHistory.length - 1];
      if (lastState && JSON.stringify(lastState) === JSON.stringify(currentSlides)) {
        return {}; // No changes needed
      }
      
      // Add current state to history
      newHistory.push(currentSlides);
      
      // Limit history size to prevent memory issues (keep last 50 states)
      const maxHistorySize = 50;
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return {
          history: newHistory,
          historyIndex: newHistory.length - 1,
          canUndo: newHistory.length > 1,
          canRedo: false,
        };
      } else {
        return {
          history: newHistory,
          historyIndex: newHistory.length - 1,
          canUndo: newHistory.length > 1,
          canRedo: false,
        };
      }
    });
  },

  undo: () => {
    const state = get();
    if (state.canUndo && state.historyIndex > 0) {
      const previousSlides = state.history[state.historyIndex - 1];
      
      // Validate that we have valid slides to restore
      if (!previousSlides || !Array.isArray(previousSlides) || previousSlides.length === 0) {
        console.warn('[History] Cannot undo - invalid or empty previous state');
        return;
      }
      
      console.log('[History] Undoing to state with', previousSlides.length, 'slides');
      
      set({
        slides: JSON.parse(JSON.stringify(previousSlides)), // Deep clone
        historyIndex: state.historyIndex - 1,
        canUndo: state.historyIndex - 1 > 0,
        canRedo: true,
        selectedElementId: null,
  selectedElementIds: [],
        editingElementId: null,
      });
    }
  },

  redo: () => {
    const state = get();
    if (state.canRedo && state.historyIndex < state.history.length - 1) {
      const nextSlides = state.history[state.historyIndex + 1];
      
      // Validate that we have valid slides to restore
      if (!nextSlides || !Array.isArray(nextSlides) || nextSlides.length === 0) {
        console.warn('[History] Cannot redo - invalid or empty next state');
        return;
      }
      
      console.log('[History] Redoing to state with', nextSlides.length, 'slides');
      
      set({
        slides: JSON.parse(JSON.stringify(nextSlides)), // Deep clone
        historyIndex: state.historyIndex + 1,
        canUndo: true,
        canRedo: state.historyIndex + 1 < state.history.length - 1,
        selectedElementId: null,
  selectedElementIds: [],
        editingElementId: null,
      });
    }
  },

  clearHistory: () => {
    set({
      history: [],
      historyIndex: -1,
      canUndo: false,
      canRedo: false,
    });
  },
});
