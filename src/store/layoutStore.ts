import { create } from 'zustand';

export type PositionPanelTab = 'arrange' | 'layers';

interface LayoutState {
  isEditorMinimized: boolean;
  toggleEditorMinimized: () => void;
  activeSidebarPanel: string;
  setActiveSidebarPanel: (panel: string) => void;
  positionPanelTab: PositionPanelTab;
  setPositionPanelTab: (tab: PositionPanelTab) => void;
  editorCallbacks: {
    onFontFamilyChange?: (font: string) => void;
    onFontColorChange?: (color: string) => void;
    onBgColorChange?: (color: string) => void;
    onElementBgColorChange?: (color: string) => void;
  };
  setEditorCallbacks: (callbacks: Partial<LayoutState['editorCallbacks']>) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isEditorMinimized: false,
  toggleEditorMinimized: () => set((state) => ({
    isEditorMinimized: !state.isEditorMinimized
  })),
  activeSidebarPanel: 'elements',
  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),
  positionPanelTab: 'layers',
  setPositionPanelTab: (positionPanelTab) => set({ positionPanelTab }),
  editorCallbacks: {},
  setEditorCallbacks: (callbacks) => set((state) => ({
    editorCallbacks: { ...state.editorCallbacks, ...callbacks }
  })),
}));