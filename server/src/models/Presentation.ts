import mongoose, { Document, Schema } from 'mongoose';

// Position interface
export interface IPosition {
  x: number;
  y: number;
}

// Size interface
export interface ISize {
  width: number;
  height: number;
}

// Base element interface
export interface IBaseElement {
  id: string;
  type: 'text' | 'heading' | 'image' | 'video' | 'shape' | 'chart';
  position: IPosition;
  size: ISize;
  zIndex?: number;
  rotation?: number;
  lineHeight?: number; // Added to satisfy schema property
  createdAt?: Date;
  updatedAt?: Date;
}

// Text element interface
export interface ITextElement extends IBaseElement {
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
export interface IHeadingElement extends IBaseElement {
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
export interface IImageElement extends IBaseElement {
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
  // Original dimensions before cropping
  originalWidth?: number;
  originalHeight?: number;
}

// Video element interface
export interface IVideoElement extends IBaseElement {
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
export interface IShapeElement extends IBaseElement {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram';
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  opacity?: number;
  gradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    direction?: number;
  };
}

// Chart series — values arrays carry numbers and explicit nulls (gaps).
export interface IChartSeries {
  id: string;
  label: string;
  values: Array<number | null>;
  color?: string;
}

export interface IChartData {
  categories: string[];
  series: IChartSeries[];
}

// Chart element. Mirrors the client-side ChartElement schema. Series colors
// are persisted only when the user explicitly overrides; auto-derived colors
// stay computed at render time so deck-wide palette changes propagate.
export interface IChartElement extends IBaseElement {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'area';
  data: IChartData;
  primarySeriesId?: string;
  stacked?: boolean;
  donut?: boolean;
  showLegend?: boolean;
  legendPosition?: 'top' | 'right' | 'bottom';
  showAxis?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  title?: string;
  textColor?: string;
}

// Union type for all slide elements
export type ISlideElement = ITextElement | IHeadingElement | IImageElement | IVideoElement | IShapeElement | IChartElement;

// Slide interface
export interface ISlide {
  id: string;
  title?: string;
  elements: ISlideElement[];
  backgroundColor?: string;
  backgroundImage?: string;
  thumbnailUrl?: string;
  thumbnailExpired?: boolean;
  transition?: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Presentation interface
export interface IPresentation extends Document {
  title: string;
  description?: string;
  slides: ISlide[];
  theme?: string;
  isPublic: boolean;
  tags?: string[];
  createdBy: mongoose.Types.ObjectId;
  collaborators?: mongoose.Types.ObjectId[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastModified: Date;
}

// Schema definitions
const PositionSchema = new Schema<IPosition>({
  x: { type: Number, required: true },
  y: { type: Number, required: true }
}, { _id: false });

const SizeSchema = new Schema<ISize>({
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 }
}, { _id: false });

const GradientSchema = new Schema({
  type: { type: String, enum: ['linear', 'radial'], required: true },
  colors: [{ type: String, required: true }],
  direction: { type: Number, min: 0, max: 360 }
}, { _id: false });

// Chart data is stored as a Mixed document. We previously used a typed
// sub-schema (ChartDataSchema with categories[String] + series[ChartSeriesSchema]),
// but Mongoose's strict subdocument cast was silently dropping the field
// during certain update paths — chart elements were saving with `data`
// stripped, causing post-refresh charts to come back empty. Mixed
// preserves the JSON shape verbatim. Joi validation on the API layer still
// enforces the structure (categories: string[], series: [{id,label,values}])
// before any save reaches Mongoose, so we don't lose validation coverage.

// Using a relaxed schema for union element types; per-type required validation is enforced at API validation layer
const SlideElementSchema = new Schema<ISlideElement>({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['text', 'heading', 'image', 'video', 'shape', 'chart']
  },
  position: { type: PositionSchema, required: true },
  size: { type: SizeSchema, required: true },
  zIndex: { type: Number, default: 1, min: 0 },
  rotation: { type: Number, default: 0, min: -360, max: 360 },

  // Text and heading fields
  content: { type: String },
  level: { type: Number, enum: [1, 2, 3, 4, 5, 6] },
  fontSize: { type: Number, min: 8, max: 200 },
  fontFamily: { type: String },
  fontWeight: {
    type: String,
    enum: ['normal', 'bold', 'lighter', 'bolder'],
    default: 'normal'
  },
  textAlign: {
    type: String,
    enum: ['left', 'center', 'right', 'justify'],
    default: 'left'
  },
  color: { type: String },
  backgroundColor: { type: String },
  padding: { type: Number, min: 0 },
  lineHeight: { type: Number, min: 0.5, max: 3 },

  // Image fields
  imageUrl: { type: String },
  alt: { type: String },
  objectFit: {
    type: String,
    enum: ['cover', 'contain', 'fill', 'scale-down', 'none'],
    default: 'cover'
  },
  borderRadius: { type: Number, min: 0 },
  opacity: { type: Number, min: 0, max: 1, default: 1 },
  filter: { type: String },
  flipX: { type: Boolean, default: false },
  flipY: { type: Boolean, default: false },
  // Crop properties (percentages 0-100)
  cropX: { type: Number, min: 0, max: 100 },
  cropY: { type: Number, min: 0, max: 100 },
  cropWidth: { type: Number, min: 0, max: 100 },
  cropHeight: { type: Number, min: 0, max: 100 },
  // Original dimensions before cropping
  originalWidth: { type: Number, min: 0 },
  originalHeight: { type: Number, min: 0 },

  // Video fields
  videoUrl: { type: String },
  autoplay: { type: Boolean, default: false },
  controls: { type: Boolean, default: true },
  muted: { type: Boolean, default: false },
  loop: { type: Boolean, default: false },
  poster: { type: String },

  // Shape fields
  shapeType: {
    type: String,
    enum: ['rectangle', 'circle', 'triangle', 'arrow', 'diamond', 'pentagon', 'hexagon', 'star', 'heart', 'cloud', 'callout', 'parallelogram']
  },
  fillColor: { type: String },
  borderColor: { type: String },
  borderWidth: { type: Number, min: 0 },
  cornerRadius: { type: Number, min: 0 },
  gradient: { type: GradientSchema },

  // Chart fields. Stored alongside other element fields in the relaxed
  // union schema; per-type required validation is enforced at the API
  // layer via Joi (see ValidationService.elementSchema).
  chartType: {
    type: String,
    enum: ['bar', 'line', 'pie', 'area']
  },
  data: { type: Schema.Types.Mixed },
  primarySeriesId: { type: String },
  stacked: { type: Boolean },
  donut: { type: Boolean },
  showLegend: { type: Boolean },
  legendPosition: {
    type: String,
    enum: ['top', 'right', 'bottom']
  },
  showAxis: { type: Boolean },
  showGrid: { type: Boolean },
  showLabels: { type: Boolean },
  title: { type: String },
  textColor: { type: String }
} as any, {
  timestamps: true,
  _id: false
});

const SlideSchema = new Schema<ISlide>({
  id: { type: String, required: true },
  title: { type: String, trim: true },
  elements: [SlideElementSchema],
  backgroundColor: { type: String, default: '#ffffff' },
  backgroundImage: { type: String },
  thumbnailUrl: { type: String },
  thumbnailExpired: { type: Boolean, default: false },
  transition: { type: String, default: 'slide' },
  order: { type: Number, required: true, min: 0 }
}, {
  timestamps: true,
  _id: false
});

const PresentationSchema = new Schema<IPresentation>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  slides: [SlideSchema],
  theme: {
    type: String,
    default: 'default',
    enum: ['default', 'dark', 'light', 'corporate', 'creative']
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  collaborators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  lastModified: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
PresentationSchema.index({ createdBy: 1, updatedAt: -1 });
PresentationSchema.index({ isPublic: 1, lastModified: -1 });
PresentationSchema.index({ tags: 1 });
PresentationSchema.index({ title: 'text', description: 'text' });

// Virtuals
PresentationSchema.virtual('slideCount').get(function () {
  return this.slides?.length || 0;
});

// Pre-save middleware
PresentationSchema.pre('save', function (next) {
  this.lastModified = new Date();

  // Ensure slides have proper order
  if (this.slides) {
    this.slides.forEach((slide, index) => {
      slide.order = index;
    });
  }

  next();
});

// Static methods
// Cast to any to assign custom statics in a typed-safe way
(PresentationSchema.statics as any).findByUser = function (userId: mongoose.Types.ObjectId) {
  return this.find({
    $or: [
      { createdBy: userId },
      { collaborators: userId }
    ]
  }).sort({ lastModified: -1 });
};

(PresentationSchema.statics as any).findPublic = function (limit = 20, skip = 0) {
  return this.find({ isPublic: true })
    .sort({ lastModified: -1 })
    .limit(limit)
    .skip(skip)
    .populate('createdBy', 'name email');
};

// Instance methods
(PresentationSchema.methods as any).addCollaborator = function (userId: mongoose.Types.ObjectId) {
  if (!this.collaborators.includes(userId)) {
    this.collaborators.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

(PresentationSchema.methods as any).removeCollaborator = function (userId: mongoose.Types.ObjectId) {
  this.collaborators = this.collaborators.filter(
    (id: mongoose.Types.ObjectId) => !id.equals(userId)
  );
  return this.save();
};

export const Presentation = mongoose.model<IPresentation>('Presentation', PresentationSchema);
export default Presentation;
