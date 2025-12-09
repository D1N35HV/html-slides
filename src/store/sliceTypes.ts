export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

// Base interface for all slide elements
interface BaseSlideElement {
  id: string;
  position: Position;
  size: Size;
  zIndex?: number;
  rotation?: number; // Rotation in degrees
}

// Text element interface
export interface TextElement extends BaseSlideElement {
  type: 'text';
  content: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | 'lighter' | 'bolder';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  backgroundColor?: string;
  padding?: number;
  lineHeight?: number;
}

// Heading element interface
export interface HeadingElement extends BaseSlideElement {
  type: 'heading';
  content: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | 'lighter' | 'bolder';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  backgroundColor?: string;
  padding?: number;
}

// Image element interface
export interface ImageElement extends BaseSlideElement {
  type: 'image';
  imageUrl: string;
  alt?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  borderRadius?: number;
  opacity?: number;
  filter?: string;
  flipX?: boolean;
  flipY?: boolean;
}

// Video element interface
export interface VideoElement extends BaseSlideElement {
  type: 'video';
  videoUrl: string;
  autoplay?: boolean;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string;
  borderRadius?: number;
}

// Shape element interface
export interface ShapeElement extends BaseSlideElement {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram';
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  rotation?: number;
  opacity?: number;
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    direction?: number;
  };
}

// Union type for all slide elements
export type SlideElement = TextElement | HeadingElement | ImageElement | VideoElement | ShapeElement;

// Utility types for element creation
export type CreateTextElement = Omit<TextElement, 'id'>;
export type CreateHeadingElement = Omit<HeadingElement, 'id'>;
export type CreateImageElement = Omit<ImageElement, 'id'>;
export type CreateVideoElement = Omit<VideoElement, 'id'>;
export type CreateShapeElement = Omit<ShapeElement, 'id'>;

// Type guard functions
export const isTextElement = (element: SlideElement): element is TextElement => element.type === 'text';
export const isHeadingElement = (element: SlideElement): element is HeadingElement => element.type === 'heading';
export const isImageElement = (element: SlideElement): element is ImageElement => element.type === 'image';
export const isVideoElement = (element: SlideElement): element is VideoElement => element.type === 'video';
export const isShapeElement = (element: SlideElement): element is ShapeElement => element.type === 'shape';

export interface Slide {
  id: string;
  elements: SlideElement[];
  backgroundColor?: string;
  backgroundImage?: string;
  transition?: 'none' | 'slide' | 'fade' | 'convex' | 'concave' | 'zoom';
  transitionSpeed?: 'slow' | 'default' | 'fast';
}

export interface SlideState {
  slides: Slide[];
  currentSlide: number;
  selectedElementId: string | null;
  // Multiple selection support
  selectedElementIds: string[]; // All currently selected element IDs (includes selectedElementId when single selection)
  editingElementId: string | null;
  globalDragState: {
    isDragging: boolean;
    hasMoved: boolean;
  };
  // Alignment guides state
  alignmentGuides: {
    activeElementId: string | null;
    activePosition: Position | null;
    activeSize: Size | null;
    isActive: boolean;
  };
}

export interface SlideActions {
  addSlide: () => void;
  removeSlide: (index: number) => void;
  setCurrentSlide: (index: number) => void;
  setSlides: (slides: Slide[], currentIndex?: number) => void;
  updateSlide: (slideIndex: number, updates: Partial<Omit<Slide, 'id' | 'elements'>>) => void;
  applyTransitionToAll: (transition: Slide['transition'], transitionSpeed?: Slide['transitionSpeed']) => void;
}

export interface ElementActions {
  updateElementPosition: (elementId: string, position: Position) => void;
  updateElementSize: (elementId: string, size: Size) => void;
  updateElementRotation: (elementId: string, rotation: number) => void;
  updateElementContent: (elementId: string, content: string, additionalProps?: any) => void;
  updateTextElement: (elementId: string, updates: Partial<Omit<TextElement, 'id' | 'type'>>) => void;
  updateHeadingElement: (elementId: string, updates: Partial<Omit<HeadingElement, 'id' | 'type'>>) => void;
  updateImageElement: (elementId: string, updates: Partial<Omit<ImageElement, 'id' | 'type'>>) => void;
  updateVideoElement: (elementId: string, updates: Partial<Omit<VideoElement, 'id' | 'type'>>) => void;
  updateShapeElement: (elementId: string, updates: Partial<Omit<ShapeElement, 'id' | 'type'>>) => void;
  addElement: (slideIndex: number, element: Omit<SlideElement, 'id'>) => string;
  removeElement: (elementId: string) => void;
  updateElementZIndex: (elementId: string, zIndex: number) => void;
  setSelectedElement: (elementId: string | null) => void;
  setSelectedElements: (elementIds: string[]) => void; // Replace current selection
  toggleElementSelection: (elementId: string) => void; // Ctrl-click toggle
  clearSelection: () => void;
  removeSelectedElements: () => void; // Delete all currently selected
  updateMultipleElementPositions: (elementIds: string[], delta: { dx: number; dy: number }, absolutePositions?: Record<string, Position>) => void; // Batch move
  setEditingElement: (elementId: string | null) => void;
  setGlobalDragState: (isDragging: boolean, hasMoved?: boolean) => void;
  // Alignment guides actions
  setAlignmentGuides: (elementId: string | null, position?: Position, size?: Size) => void;
  clearAlignmentGuides: () => void;
}

export interface HistoryState {
  history: Slide[][];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
}

export interface HistoryActions {
  saveToHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

export type Store = SlideState & SlideActions & ElementActions & HistoryState & HistoryActions & {
  setRemotePatch: (flag: boolean) => void;
  getRemotePatch: () => boolean;
};