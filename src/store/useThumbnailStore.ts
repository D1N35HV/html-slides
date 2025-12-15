import { create } from 'zustand';

interface ThumbnailState {
    thumbnails: Record<string, string>; // slideId -> thumbnailUrl
    setThumbnail: (slideId: string, url: string) => void;
    setThumbnails: (thumbnails: Record<string, string>) => void;
    getThumbnail: (slideId: string) => string | undefined;
    clearThumbnails: () => void;
}

export const useThumbnailStore = create<ThumbnailState>((set, get) => ({
    thumbnails: {},

    setThumbnail: (slideId, url) =>
        set((state) => ({
            thumbnails: { ...state.thumbnails, [slideId]: url }
        })),

    setThumbnails: (thumbnails) =>
        set({ thumbnails }),

    getThumbnail: (slideId) => get().thumbnails[slideId],

    clearThumbnails: () => set({ thumbnails: {} })
}));

export default useThumbnailStore;
