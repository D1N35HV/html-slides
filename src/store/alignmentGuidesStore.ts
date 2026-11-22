import { create } from 'zustand';
import type { Position, Size } from './sliceTypes';

interface AlignmentGuidesStore {
  activeElementId: string | null;
  activePosition: Position | null;
  activeSize: Size | null;
  isActive: boolean;
  setActive: (elementId: string, position: Position, size: Size) => void;
  clear: () => void;
}

// Intentionally separate from the main store so high-frequency updates during
// drag/resize don't cascade into unrelated subscribers (slide tree, editors,
// toolbars). Consumers should use selectors to read only what they need.
export const useAlignmentGuidesStore = create<AlignmentGuidesStore>((set, get) => ({
  activeElementId: null,
  activePosition: null,
  activeSize: null,
  isActive: false,
  setActive: (elementId, position, size) => {
    const s = get();
    if (
      s.activeElementId === elementId &&
      s.activePosition?.x === position.x &&
      s.activePosition?.y === position.y &&
      s.activeSize?.width === size.width &&
      s.activeSize?.height === size.height
    ) {
      return;
    }
    set({
      activeElementId: elementId,
      activePosition: position,
      activeSize: size,
      isActive: true,
    });
  },
  clear: () => {
    if (!get().isActive) return;
    set({
      activeElementId: null,
      activePosition: null,
      activeSize: null,
      isActive: false,
    });
  },
}));
