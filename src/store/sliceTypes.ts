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
  verticalAlign?: 'top' | 'middle' | 'bottom';
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
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
  verticalAlign?: 'top' | 'middle' | 'bottom';
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
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
  // Crop properties (percentages 0-100)
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  // Original element dimensions before cropping (for display calculations)
  originalWidth?: number;
  originalHeight?: number;
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

export type BorderStyle = 'none' | 'solid' | 'dashed' | 'long-dashed' | 'dotted';

// Shape element interface
export interface ShapeElement extends BaseSlideElement {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram' | 'line' | 'line-arrow-right' | 'line-arrow-double';
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  cornerRadius?: number;
  rotation?: number;
  opacity?: number;
  gradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    stops: Array<{ position: number; color: string }>;
  };
}

// Chart element interface
export type ChartType = 'bar' | 'line' | 'pie' | 'area';
export type ChartLegendPosition = 'top' | 'right' | 'bottom';

export interface ChartSeries {
  id: string;
  label: string;
  // null = explicit gap (line breaks, bar skipped). See parseChartCell.
  values: Array<number | null>;
  // undefined = derive from document-color palette (see chartPalette.ts).
  color?: string;
}

export interface ChartData {
  categories: string[];
  series: ChartSeries[];
}

export interface ChartElement extends BaseSlideElement {
  type: 'chart';
  chartType: ChartType;
  data: ChartData;
  // Pie/donut: which series's values are sliced. Undefined = first series.
  primarySeriesId?: string;
  // Bar/area only.
  stacked?: boolean;
  // Pie only.
  donut?: boolean;
  // Style overrides; undefined = derived from slide.
  showLegend?: boolean;
  legendPosition?: ChartLegendPosition;
  showAxis?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  title?: string;
  textColor?: string;
}

// Multiple choice element interface
export interface MultipleChoiceElement extends BaseSlideElement {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correctOptionIndex: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
}

// True/False element interface
export interface TrueFalseElement extends BaseSlideElement {
  type: 'true_false';
  question: string;
  correctAnswer: boolean;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
}

// Union type for all slide elements
export type SlideElement = TextElement | HeadingElement | ImageElement | VideoElement | ShapeElement | ChartElement | MultipleChoiceElement | TrueFalseElement;

// Utility types for element creation
export type CreateTextElement = Omit<TextElement, 'id'>;
export type CreateHeadingElement = Omit<HeadingElement, 'id'>;
export type CreateImageElement = Omit<ImageElement, 'id'>;
export type CreateVideoElement = Omit<VideoElement, 'id'>;
export type CreateShapeElement = Omit<ShapeElement, 'id'>;
export type CreateChartElement = Omit<ChartElement, 'id'>;
export type CreateMultipleChoiceElement = Omit<MultipleChoiceElement, 'id'>;
export type CreateTrueFalseElement = Omit<TrueFalseElement, 'id'>;

// Type guard functions
export const isTextElement = (element: SlideElement): element is TextElement => element.type === 'text';
export const isHeadingElement = (element: SlideElement): element is HeadingElement => element.type === 'heading';
export const isImageElement = (element: SlideElement): element is ImageElement => element.type === 'image';
export const isVideoElement = (element: SlideElement): element is VideoElement => element.type === 'video';
export const isShapeElement = (element: SlideElement): element is ShapeElement => element.type === 'shape';
export const isChartElement = (element: SlideElement): element is ChartElement => element.type === 'chart';
export const isMultipleChoiceElement = (element: SlideElement): element is MultipleChoiceElement => element.type === 'multiple_choice';
export const isTrueFalseElement = (element: SlideElement): element is TrueFalseElement => element.type === 'true_false';

export interface Slide {
  id: string;
  elements: SlideElement[];
  backgroundColor?: string;
  backgroundImage?: string;
  thumbnailUrl?: string;
  thumbnailExpired?: boolean;
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
  updateChartElement: (elementId: string, updates: Partial<Omit<ChartElement, 'id' | 'type'>>) => void;
  updateMultipleChoiceElement: (elementId: string, updates: Partial<Omit<MultipleChoiceElement, 'id' | 'type'>>) => void;
  updateTrueFalseElement: (elementId: string, updates: Partial<Omit<TrueFalseElement, 'id' | 'type'>>) => void;
  addElement: (slideIndex: number, element: Omit<SlideElement, 'id'>) => string;
  removeElement: (elementId: string) => void;
  updateElementZIndex: (elementId: string, zIndex: number) => void;
  duplicateElement: (elementId: string) => string | null;
  bringForward: (elementId: string) => void;
  sendBackward: (elementId: string) => void;
  setSelectedElement: (elementId: string | null) => void;
  setSelectedElements: (elementIds: string[]) => void; // Replace current selection
  toggleElementSelection: (elementId: string) => void; // Ctrl-click toggle
  clearSelection: () => void;
  removeSelectedElements: () => void; // Delete all currently selected
  updateMultipleElementPositions: (elementIds: string[], delta: { dx: number; dy: number }, absolutePositions?: Record<string, Position>) => void; // Batch move
  setEditingElement: (elementId: string | null) => void;
  setGlobalDragState: (isDragging: boolean, hasMoved?: boolean) => void;
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