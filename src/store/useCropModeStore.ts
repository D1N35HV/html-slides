import { create } from 'zustand';

interface CropModeState {
    cropModeElementId: string | null;
    setCropModeElementId: (id: string | null) => void;
}

export const useCropModeStore = create<CropModeState>((set) => ({
    cropModeElementId: null,
    setCropModeElementId: (id) => set({ cropModeElementId: id })
}));
