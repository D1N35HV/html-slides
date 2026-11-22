export interface SlideElement {
  id: string;
  type: 'text' | 'heading' | 'image' | 'video' | 'shape';
  content: string;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  zIndex?: number;
  rotation?: number;
  // Optional properties for different element types
  imageUrl?: string;
  videoUrl?: string;
  shapeType?: 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram' | 'line' | 'line-arrow-right' | 'line-arrow-double';
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  opacity?: number;
}

export interface Slide {
  id: string;
  elements: SlideElement[];
  backgroundColor?: string;
  backgroundImage?: string;
  transition?: 'none' | 'slide' | 'fade' | 'convex' | 'concave' | 'zoom';
  transitionSpeed?: 'slow' | 'default' | 'fast';
}