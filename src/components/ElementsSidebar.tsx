import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../store/index';
import { useLayoutStore } from '../store/layoutStore';
import type { CreateTextElement, CreateHeadingElement, CreateImageElement, CreateVideoElement, CreateShapeElement, CreateChartElement, ChartType } from '../store/sliceTypes';
import { ChartElement } from './ChartElement';
import { ChartEditorPanel } from './ChartEditorPanel';
import { defaultChartElementProps } from '../utils/chartPalette';
import apiService from '../services/ApiService';
import collaborationService from '../services/CollaborationService';
import { ShapeRenderer, SHAPE_NAMES, isLineShape, type ShapeType } from './ShapeElement';
import {
  DocumentTextIcon,
  HashtagIcon,
  PhotoIcon,
  PlayIcon,
  RectangleStackIcon,
  PlusIcon,
  PaintBrushIcon,
  Squares2X2Icon,
  SwatchIcon,
  MagnifyingGlassIcon,
  CloudArrowUpIcon,
  ChartBarIcon,
  CubeIcon,
  SparklesIcon,
  VideoCameraIcon,
  XMarkIcon,
  DocumentArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { SaveButton } from './SaveButton';
import { ColorPicker } from './ui/ColorPicker';
import { PositionPanel } from './ui/PositionPanel';
import { extractDocumentColors } from '../utils/documentColors';

// Ink-indigo brand colors for shape previews — hex for SVG fill reliability.
const SHAPE_FILL = '#4248b2';      // ink-indigo body
const SHAPE_STROKE = '#2f3383';    // ink-indigo edge

// ──────────────────────────────────────────────
// Element library — shelves, drill-in, cross-category search
// ──────────────────────────────────────────────

type ShapeItem = {
  kind: 'shape';
  id: string;
  shapeType: ShapeType;
  name: string;
  keywords: string[];
};

type IconItem = {
  kind: 'icon';
  id: string;
  name: string;
  /** Heroicons outline path(s), 24×24 viewbox. Stroke handled at render time. */
  path: string;
  keywords: string[];
};

type ElementItem = ShapeItem | IconItem;

type ElementCategory = {
  id: string;
  name: string;
  items: ElementItem[];
};

/** Keep peek rows to one visual line (3-col grid). */
const SHELF_PEEK = 3;

const HERO_ICONS: IconItem[] = [
  { kind: 'icon', id: 'check', name: 'Check', keywords: ['correct', 'done', 'complete', 'yes'],
    path: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { kind: 'icon', id: 'cross', name: 'Cross', keywords: ['incorrect', 'wrong', 'no', 'remove'],
    path: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { kind: 'icon', id: 'info', name: 'Info', keywords: ['note', 'tip', 'help'],
    path: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z' },
  { kind: 'icon', id: 'idea', name: 'Idea', keywords: ['bulb', 'light', 'tip', 'insight'],
    path: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18' },
  { kind: 'icon', id: 'education', name: 'Education', keywords: ['cap', 'graduate', 'school', 'learn'],
    path: 'M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5' },
  { kind: 'icon', id: 'book', name: 'Book', keywords: ['read', 'reference', 'material'],
    path: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
  { kind: 'icon', id: 'assessment', name: 'Assessment', keywords: ['clipboard', 'task', 'checklist', 'quiz'],
    path: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z' },
  { kind: 'icon', id: 'data', name: 'Data', keywords: ['chart', 'metric', 'graph', 'bar'],
    path: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
  { kind: 'icon', id: 'warning', name: 'Warning', keywords: ['alert', 'caution', 'attention'],
    path: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' },
  { kind: 'icon', id: 'key-point', name: 'Key point', keywords: ['star', 'highlight', 'important', 'flag'],
    path: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z' },
];

const shapeItem = (shapeType: ShapeType, keywords: string[] = []): ShapeItem => ({
  kind: 'shape',
  id: shapeType,
  shapeType,
  name: SHAPE_NAMES[shapeType],
  keywords,
});

const ELEMENT_CATEGORIES: ElementCategory[] = [
  {
    id: 'basic',
    name: 'Basic shapes',
    items: [
      shapeItem('rectangle', ['square', 'box']),
      shapeItem('circle', ['ellipse', 'round']),
      shapeItem('triangle'),
      shapeItem('diamond', ['rhombus']),
      shapeItem('pentagon', ['five']),
      shapeItem('hexagon', ['six']),
      shapeItem('parallelogram', ['slanted']),
    ],
  },
  {
    id: 'symbols',
    name: 'Symbols',
    items: [
      shapeItem('star', ['favorite', 'highlight']),
      shapeItem('heart', ['love', 'like']),
      shapeItem('cloud', ['weather', 'storage']),
    ],
  },
  {
    id: 'lines',
    name: 'Lines',
    items: [
      shapeItem('line', ['horizontal', 'rule', 'separator', 'divider']),
      shapeItem('line-arrow-right', ['arrow', 'pointer', 'connector', 'direction']),
      shapeItem('line-arrow-double', ['arrow', 'bidirectional', 'two-way', 'range']),
    ],
  },
  {
    id: 'flow',
    name: 'Flow & callout',
    items: [
      shapeItem('arrow', ['direction', 'point']),
      shapeItem('callout', ['speech', 'bubble', 'quote']),
    ],
  },
  {
    id: 'icons',
    name: 'Learning icons',
    items: HERO_ICONS,
  },
];

// Charts picker — order chosen so the grid reads as comparison → trend →
// composition → share. Each tile renders a live recharts mini-preview, so
// users see the actual visual at insert time rather than an icon stand-in.
const CHART_TYPES: ReadonlyArray<{ id: ChartType; label: string }> = [
  { id: 'bar',  label: 'Bar' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'pie',  label: 'Pie' },
];

/** Build a data-URL SVG for an icon so it can drop onto the canvas as an image element. */
function iconToDataUrl(icon: IconItem, strokeHex = '#1a1d2b'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${strokeHex}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="120" height="120"><path d="${icon.path}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Upload type for files
interface UploadedFile {
  id: string;
  filename: string;
  type: 'image' | 'video';
  url: string;
  size: number;
  createdAt: string;
}

// Template type for imported PPTs
interface Template {
  id: string;
  name: string;
  originalFilename: string;
  slides: Array<{
    id: string;
    elements: any[];
    backgroundColor?: string;
    backgroundImage?: string;
    thumbnailUrl?: string;
  }>;
  slideCount: number;
  createdAt: string;
  thumbnails: string[];
  mediaFolder: string;
}

// ──────────────────────────────────────────────
// Color sub-panels
// ──────────────────────────────────────────────

interface TextColorSectionProps {
  editorCallbacks: {
    onFontColorChange?: (color: string) => void;
    onBgColorChange?: (color: string) => void;
    onElementBgColorChange?: (color: string) => void;
  };
}

function useDocumentColors() {
  const slides = useStore((s) => s.slides);
  return useMemo(() => extractDocumentColors(slides), [slides]);
}

function FontColorSection({ editorCallbacks }: TextColorSectionProps) {
  const documentColors = useDocumentColors();
  return (
    <div className="es-section">
      <ColorPicker
        onChange={(c) => editorCallbacks.onFontColorChange?.(c)}
        documentColors={documentColors}
      />
    </div>
  );
}

function BgColorSection({ editorCallbacks }: TextColorSectionProps) {
  const documentColors = useDocumentColors();
  return (
    <div className="es-section">
      <ColorPicker
        onChange={(c) => editorCallbacks.onBgColorChange?.(c)}
        onClear={() => editorCallbacks.onBgColorChange?.('transparent')}
        documentColors={documentColors}
        allowTransparent
        clearLabel="Remove highlight"
      />
    </div>
  );
}

function ElementBgColorSection({ editorCallbacks }: TextColorSectionProps) {
  const documentColors = useDocumentColors();
  return (
    <div className="es-section">
      <ColorPicker
        onChange={(c) => editorCallbacks.onElementBgColorChange?.(c)}
        onClear={() => editorCallbacks.onElementBgColorChange?.('transparent')}
        documentColors={documentColors}
        allowTransparent
        clearLabel="Remove background"
      />
    </div>
  );
}

function SlideBgColorSection() {
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const updateSlide = useStore((s) => s.updateSlide);
  const documentColors = useDocumentColors();
  const slide = slides[currentSlide];
  if (!slide) return null;
  return (
    <div className="es-section">
      <ColorPicker
        value={slide.backgroundColor}
        onChange={(c) => updateSlide(currentSlide, { backgroundColor: c })}
        onClear={() => updateSlide(currentSlide, { backgroundColor: 'transparent' })}
        documentColors={documentColors}
        allowGradients
        allowTransparent
        clearLabel="Transparent"
      />
    </div>
  );
}

function useSelectedShapes() {
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const selectedElementIds = useStore((s) => s.selectedElementIds);
  const selectedElementId = useStore((s) => s.selectedElementId);

  const slide = slides[currentSlide];
  const ids = selectedElementIds.length > 0
    ? selectedElementIds
    : (selectedElementId ? [selectedElementId] : []);

  const shapeIds = ids.filter((id) => {
    const el = slide?.elements.find((e) => e.id === id);
    return el?.type === 'shape';
  });
  const firstShape = slide?.elements.find((e) => e.id === shapeIds[0]);
  return { shapeIds, firstShape };
}

function ShapeFillColorSection() {
  const updateShapeElement = useStore((s) => s.updateShapeElement);
  const documentColors = useDocumentColors();
  const { shapeIds, firstShape } = useSelectedShapes();
  const fillColor = (firstShape as { fillColor?: string } | undefined)?.fillColor;

  const apply = (fill: string) => shapeIds.forEach((id) => updateShapeElement(id, { fillColor: fill }));

  return (
    <div className="es-section">
      <ColorPicker
        value={fillColor}
        onChange={apply}
        documentColors={documentColors}
        allowGradients
      />
    </div>
  );
}

function ShapeChangerSection() {
  const updateShapeElement = useStore((s) => s.updateShapeElement);
  const { shapeIds, firstShape } = useSelectedShapes();
  const currentType = (firstShape as { shapeType?: ShapeType } | undefined)?.shapeType ?? 'rectangle';

  const apply = (next: ShapeType) => {
    if (shapeIds.length === 0) return;
    shapeIds.forEach((id) => updateShapeElement(id, { shapeType: next }));
  };

  if (shapeIds.length === 0) {
    return (
      <section className="es-section">
        <div className="es-empty">
          <Squares2X2Icon />
          <div className="es-empty-title">Select a shape</div>
          <div className="es-empty-body">
            Pick a shape on the canvas to swap it for a different one without losing its size or position.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="es-section">
      {ELEMENT_CATEGORIES.filter((c) => c.id !== 'icons').map((category) => (
        <div key={category.id} className="es-shelf">
          <div className="es-shelf-head">
            <span className="es-shelf-title">
              {category.name}
              <span className="es-count">{category.items.length}</span>
            </span>
          </div>
          <div className="es-grid-3">
            {category.items
              .filter((item): item is ShapeItem => item.kind === 'shape')
              .map((item) => {
                const selected = currentType === item.shapeType;
                return (
                  <button
                    key={item.shapeType}
                    type="button"
                    className="es-shape-tile"
                    aria-pressed={selected}
                    title={item.name}
                    onClick={() => apply(item.shapeType)}
                    style={selected ? { borderColor: 'var(--accent-ink)', background: 'var(--accent-wash)' } : undefined}
                  >
                    <div className="es-shape-stage">
                      <ShapeRenderer
                        shapeType={item.shapeType}
                        fillColor={SHAPE_FILL}
                        borderColor={SHAPE_STROKE}
                        borderWidth={1.5}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    </div>
                    <span className="es-shape-label">{item.name}</span>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
    </section>
  );
}

function ShapeBorderColorSection() {
  const updateShapeElement = useStore((s) => s.updateShapeElement);
  const documentColors = useDocumentColors();
  const { shapeIds, firstShape } = useSelectedShapes();
  const borderColor = (firstShape as { borderColor?: string } | undefined)?.borderColor;

  const applyColor = (c: string) =>
    shapeIds.forEach((id) => updateShapeElement(id, { borderColor: c }));

  return (
    <div className="es-section">
      <ColorPicker
        value={borderColor}
        onChange={applyColor}
        documentColors={documentColors}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Element tile + shelf primitives
// ──────────────────────────────────────────────

function ItemPreview({ item }: { item: ElementItem }) {
  if (item.kind === 'shape') {
    return (
      <ShapeRenderer
        shapeType={item.shapeType}
        fillColor={SHAPE_FILL}
        borderColor={SHAPE_STROKE}
        borderWidth={1.5}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d={item.path} />
    </svg>
  );
}

interface ItemTileProps {
  item: ElementItem;
  onClick: (item: ElementItem) => void;
}

function ItemTile({ item, onClick }: ItemTileProps) {
  if (item.kind === 'shape') {
    return (
      <button
        type="button"
        className="es-shape-tile"
        title={item.name}
        onClick={() => onClick(item)}
      >
        <div className="es-shape-stage">
          <ItemPreview item={item} />
        </div>
        <span className="es-shape-label">{item.name}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="es-icon-tile"
      title={item.name}
      onClick={() => onClick(item)}
    >
      <div className="es-icon-stage">
        <ItemPreview item={item} />
      </div>
      <span className="es-icon-label">{item.name}</span>
    </button>
  );
}

interface ShelfProps {
  category: ElementCategory;
  onItemClick: (item: ElementItem) => void;
  onSeeAll: (categoryId: string) => void;
}

function Shelf({ category, onItemClick, onSeeAll }: ShelfProps) {
  const total = category.items.length;
  const overflow = total > SHELF_PEEK;
  const visible = overflow ? category.items.slice(0, SHELF_PEEK) : category.items;

  return (
    <div className="es-shelf">
      <div className="es-shelf-head">
        <span className="es-shelf-title">
          {category.name}
          <span className="es-count">{total}</span>
        </span>
        {overflow && (
          <button type="button" className="es-shelf-action" onClick={() => onSeeAll(category.id)}>
            See all
            <ChevronRightIcon />
          </button>
        )}
      </div>
      <div className="es-grid-3">
        {visible.map((item) => (
          <ItemTile key={item.id} item={item} onClick={onItemClick} />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Rail nav
// ──────────────────────────────────────────────

interface RailItem {
  id: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const RAIL_ITEMS: RailItem[] = [
  { id: 'design', label: 'Design', icon: PaintBrushIcon },
  { id: 'elements', label: 'Elements', icon: Squares2X2Icon },
  { id: 'text', label: 'Text', icon: DocumentTextIcon },
  { id: 'brand', label: 'Brand', icon: SwatchIcon },
  { id: 'uploads', label: 'Uploads', icon: CloudArrowUpIcon },
  { id: 'magic', label: 'Magic', icon: SparklesIcon },
  { id: 'charts', label: 'Charts', icon: ChartBarIcon },
];

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export function ElementsSidebar() {
  const addElement = useStore((s) => s.addElement);
  const currentSlide = useStore((s) => s.currentSlide);
  const setSelectedElement = useStore((s) => s.setSelectedElement);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const slides = useStore((s) => s.slides);
  const {
    isEditorMinimized,
    activeSidebarPanel,
    setActiveSidebarPanel,
    editorCallbacks,
  } = useLayoutStore();

  // The selected chart element drives the Charts panel into editor mode.
  // When no chart is selected, the panel shows the type picker (Q9).
  const selectedChart = useMemo(() => {
    if (!selectedElementId) return null;
    const slide = slides[currentSlide];
    const el = slide?.elements.find(e => e.id === selectedElementId);
    return el && el.type === 'chart' ? el : null;
  }, [slides, currentSlide, selectedElementId]);

  // Auto-switch to the Charts panel when a chart is selected (Q9).
  // Doesn't override the user's choice when a non-chart element is selected
  // — only the chart-selection event nudges the sidebar.
  useEffect(() => {
    if (selectedChart) setActiveSidebarPanel('charts' as any);
  }, [selectedChart?.id, setActiveSidebarPanel]);

  // Upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeUploadTab, setActiveUploadTab] = useState<'images' | 'videos'>('images');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isUploadingTemplate, setIsUploadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // Streaming conversion progress state
  const [conversionProgress, setConversionProgress] = useState<{
    isConverting: boolean;
    currentSlide: number;
    totalSlides: number;
    filename: string;
    templateId?: string;
  }>({ isConverting: false, currentSlide: 0, totalSlides: 0, filename: '' });

  // Elements panel: shelf drill-in + cross-category search
  const [elementsDrill, setElementsDrill] = useState<string | null>(null);
  const [elementsSearch, setElementsSearch] = useState('');

  // Listen for PPT conversion progress events via socket.io
  useEffect(() => {
    collaborationService.onPPTProgress((event) => {
      if (event.type === 'init' && event.totalSlides) {
        setConversionProgress((prev) => ({
          ...prev,
          totalSlides: event.totalSlides!,
          templateId: event.presentationId,
        }));
      } else if (event.type === 'slide' && event.slide) {
        setConversionProgress((prev) => ({
          ...prev,
          currentSlide: (event.slideIndex ?? 0) + 1,
        }));

        if (event.presentationId) {
          setTemplates((prev) =>
            prev.map((template) => {
              if (template.id === event.presentationId) {
                const slideExists = template.slides.some((s) => s.id === event.slide.id);
                if (!slideExists) {
                  return {
                    ...template,
                    slides: [...template.slides, event.slide],
                  };
                }
              }
              return template;
            })
          );
        }
      } else if (event.type === 'complete') {
        setConversionProgress((prev) => ({ ...prev, isConverting: false }));
      } else if (event.type === 'error') {
        console.error('PPT conversion error:', event.error);
        setConversionProgress((prev) => ({ ...prev, isConverting: false }));
        setTemplateError(event.error || 'Conversion failed');
      }
    });
  }, []);

  const activeSection = activeSidebarPanel;
  const setActiveSection = setActiveSidebarPanel;

  useEffect(() => {
    if (activeSection === 'uploads') fetchUploads();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'design') fetchTemplates();
  }, [activeSection]);

  // Reset Elements drill + search whenever the user navigates to a different rail section.
  useEffect(() => {
    if (activeSection !== 'elements') {
      setElementsDrill(null);
      setElementsSearch('');
    }
  }, [activeSection]);

  const fetchTemplates = async () => {
    try {
      const response = await apiService.getTemplates();
      if (response.success && response.data) setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingTemplate(true);
    setTemplateError(null);

    try {
      for (const file of Array.from(files)) {
        setConversionProgress({
          isConverting: true,
          currentSlide: 0,
          totalSlides: 0,
          filename: file.name,
        });

        const response = await apiService.uploadTemplateStreaming(file);

        setConversionProgress((prev) => ({ ...prev, isConverting: false }));

        if (response.success && response.data) {
          setTemplates((prev) => [response.data!, ...prev]);
        }
      }
    } catch (error) {
      console.error('Template upload error:', error);
      setTemplateError('Failed to upload PowerPoint file. Please try again.');
      setConversionProgress((prev) => ({ ...prev, isConverting: false }));
    } finally {
      setIsUploadingTemplate(false);
      if (templateInputRef.current) templateInputRef.current.value = '';
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await apiService.deleteTemplate(templateId);
      if (response.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        if (selectedTemplate?.id === templateId) setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Delete template error:', error);
    }
  };

  const handleAddSlideFromTemplate = async (template: Template, slideIndex: number) => {
    try {
      const response = await apiService.getTemplateSlide(template.id, slideIndex);

      let slideData: any;
      if (response.success && response.data) {
        slideData = response.data;
      } else {
        slideData = template.slides[slideIndex];
        if (!slideData) {
          console.error('Slide not found');
          return;
        }
        slideData = {
          id: `slide-${crypto.randomUUID()}`,
          elements: (slideData.elements || []).map((el: any) => ({
            ...el,
            id: `element-${crypto.randomUUID()}`,
          })),
          backgroundColor: slideData.backgroundColor,
          backgroundImage: slideData.backgroundImage,
          thumbnailUrl: slideData.thumbnailUrl,
        };
      }

      const { slides: currentSlides, setSlides } = useStore.getState();
      const updatedSlides = [...currentSlides, slideData];
      setSlides(updatedSlides, updatedSlides.length - 1);
    } catch (error) {
      console.error('Error adding slide from template:', error);

      const slideData = template.slides[slideIndex];
      if (slideData) {
        const { slides: currentSlides, setSlides } = useStore.getState();
        const newSlide = {
          id: `slide-${crypto.randomUUID()}`,
          elements: (slideData.elements || []).map((el: any) => ({
            ...el,
            id: `element-${crypto.randomUUID()}`,
          })),
          backgroundColor: slideData.backgroundColor,
          backgroundImage: slideData.backgroundImage,
          thumbnailUrl: slideData.thumbnailUrl,
        };
        const updatedSlides = [...currentSlides, newSlide];
        setSlides(updatedSlides, updatedSlides.length - 1);
      }
    }
  };

  const fetchUploads = async () => {
    try {
      const response = await apiService.getUploads();
      if (response.success && response.data) setUploadedFiles(response.data);
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      for (const file of Array.from(files)) {
        const response = await apiService.uploadFile(file);
        if (response.success && response.data) {
          setUploadedFiles((prev) => [
            {
              id: response.data!.id,
              filename: response.data!.filename,
              type: response.data!.type,
              url: response.data!.url,
              size: response.data!.size,
              createdAt: response.data!.createdAt,
            },
            ...prev,
          ]);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteUpload = async (filename: string) => {
    try {
      const response = await apiService.deleteUpload(filename);
      if (response.success) setUploadedFiles((prev) => prev.filter((f) => f.filename !== filename));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const resolveUploadUrl = (url: string) => {
    const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    return url.startsWith('http') ? url : `${baseUrl}${url}`;
  };

  const handleAddUploadedImage = (url: string) => {
    const element: CreateImageElement = {
      type: 'image',
      position: { x: 100, y: 200 },
      size: { width: 300, height: 200 },
      imageUrl: resolveUploadUrl(url),
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddUploadedVideo = (url: string) => {
    const element: CreateVideoElement = {
      type: 'video',
      position: { x: 100, y: 200 },
      size: { width: 400, height: 225 },
      videoUrl: resolveUploadUrl(url),
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const fontFamilies = [
    'Arial, Helvetica, sans-serif',
    'Courier New, Courier, monospace',
    'Georgia, serif',
    'Lucida Sans Unicode, Lucida Grande, sans-serif',
    'Tahoma, Geneva, sans-serif',
    'Times New Roman, Times, serif',
    'Trebuchet MS, Helvetica, sans-serif',
    'Verdana, Geneva, sans-serif',
    'League Gothic, sans-serif',
  ];

  const getFontDisplayName = (font: string) => font.split(',')[0].trim();

  if (isEditorMinimized) return null;

  const handleAddText = () => {
    const element: CreateTextElement = {
      type: 'text',
      content: '<p>Double-click to edit and format your text with the rich text editor!</p>',
      position: { x: 50, y: 150 },
      size: { width: 400, height: 100 },
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddHeading = () => {
    const element: CreateHeadingElement = {
      type: 'heading',
      content: '<h1>Your Slide Title</h1>',
      level: 1,
      position: { x: 50, y: 50 },
      size: { width: 500, height: 80 },
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddShape = (shapeType: ShapeType = 'rectangle') => {
    const isLine = isLineShape(shapeType);
    const element: CreateShapeElement = {
      type: 'shape',
      position: { x: 150, y: 150 },
      // Lines have zero vertical extent — the stroke renders outside the
      // bounding box via overflow:visible so the visual line still shows up,
      // and the selection rectangle collapses out of view (see SelectionBox
      // lineMode) so the user only sees the line + endpoint handles.
      size: isLine ? { width: 300, height: 0 } : { width: 200, height: 150 },
      shapeType,
      fillColor: '#3B82F6',
      borderColor: '#1E40AF',
      borderWidth: isLine ? 3 : 2,
      opacity: 1,
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddChart = (chartType: ChartType) => {
    const defaults = defaultChartElementProps(chartType);
    const element: CreateChartElement = {
      type: 'chart',
      // Q12: default insert size 480×320 (16:10 fits comfortably alongside
      // text). addElement handles overlap-avoidance and final positioning.
      position: { x: 100, y: 100 },
      size: { width: 480, height: 320 },
      ...defaults,
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddIcon = (icon: IconItem) => {
    const element: CreateImageElement = {
      type: 'image',
      position: { x: 200, y: 150 },
      size: { width: 120, height: 120 },
      imageUrl: iconToDataUrl(icon),
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddItem = (item: ElementItem) => {
    if (item.kind === 'shape') handleAddShape(item.shapeType);
    else handleAddIcon(item);
  };

  const searchResults = useMemo(() => {
    const q = elementsSearch.trim().toLowerCase();
    if (!q) return null;
    const all = ELEMENT_CATEGORIES.flatMap((c) => c.items);
    return all.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [elementsSearch]);

  const drilledCategory = elementsDrill
    ? ELEMENT_CATEGORIES.find((c) => c.id === elementsDrill) ?? null
    : null;

  const panelKicker = (() => {
    switch (activeSection) {
      case 'fontFamily': return 'Fonts';
      case 'fontColor': return 'Text color';
      case 'bgColor': return 'Highlight';
      case 'elementBgColor': return 'Box fill';
      case 'slideBgColor': return 'Slide background';
      case 'shapeFillColor': return 'Shape fill';
      case 'shapeBorderColor': return 'Shape border';
      case 'shapeSelector': return 'Change shape';
      case 'position': return 'Position';
      case 'magic': return 'Magic media';
      default: return activeSection;
    }
  })();

  return (
    <div className="lp-root es-root">
      {/* ────────── Left Navigation Rail ────────── */}
      <nav className="es-rail" aria-label="Sidebar sections">
        {RAIL_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className="es-rail-btn"
              aria-current={isActive}
              onClick={() => setActiveSection(item.id as any)}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          className="es-rail-btn"
          aria-current={activeSection === 'apps'}
          onClick={() => setActiveSection('apps' as any)}
        >
          <CubeIcon />
          <span>Apps</span>
        </button>
      </nav>

      {/* ────────── Main Panel ────────── */}
      <div className="es-panel">
        {/* Header: mono kicker + search */}
        <div className="es-panel-head">
          <div className="es-kicker">{panelKicker}</div>
          <div className="es-input-wrap">
            <MagnifyingGlassIcon className="es-input-icon" />
            <input
              type="text"
              className="es-input"
              placeholder={
                activeSection === 'elements'
                  ? 'Search shapes, icons, callouts…'
                  : 'Search this panel…'
              }
              aria-label="Search this panel"
              value={activeSection === 'elements' ? elementsSearch : ''}
              onChange={(e) => {
                if (activeSection === 'elements') setElementsSearch(e.target.value);
              }}
              readOnly={activeSection !== 'elements'}
            />
          </div>
        </div>

        {/* Scrolling content area */}
        <div className="es-scroll">
          {/* ── Elements ── three modes: search / drill-in / shelves ── */}
          {activeSection === 'elements' && (
            <>
              {searchResults ? (
                /* Mode 1: cross-category search results */
                <section className="es-section">
                  <div className="es-search-meta">
                    <span>
                      {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} for
                      {' '}&ldquo;{elementsSearch.trim()}&rdquo;
                    </span>
                    <button type="button" onClick={() => setElementsSearch('')}>Clear</button>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="es-grid-3">
                      {searchResults.map((item) => (
                        <ItemTile key={`${item.kind}-${item.id}`} item={item} onClick={handleAddItem} />
                      ))}
                    </div>
                  ) : (
                    <div className="es-empty">
                      <MagnifyingGlassIcon />
                      <div className="es-empty-title">No matching elements</div>
                      <div className="es-empty-body">
                        Try a different term — shapes, icons, and callouts all live here.
                      </div>
                    </div>
                  )}
                </section>
              ) : drilledCategory ? (
                /* Mode 2: drill-in — full grid for one category */
                <section className="es-section">
                  <button type="button" className="es-btn-back" onClick={() => setElementsDrill(null)}>
                    <ChevronLeftIcon className="w-3.5 h-3.5" />
                    Elements
                  </button>
                  <div>
                    <div className="es-h">{drilledCategory.name}</div>
                    <div className="es-meta" style={{ marginTop: 4 }}>
                      {drilledCategory.items.length} items
                    </div>
                  </div>
                  <div className="es-grid-3">
                    {drilledCategory.items.map((item) => (
                      <ItemTile key={`${item.kind}-${item.id}`} item={item} onClick={handleAddItem} />
                    ))}
                  </div>
                </section>
              ) : (
                /* Mode 3: default — Quick Add + category shelves */
                <>
                  <section className="es-section">
                    <div>
                      <div className="es-section-title"><span>Quick add</span></div>
                      <div className="es-grid-2">
                        <button type="button" className="es-tile" onClick={handleAddText}>
                          <DocumentTextIcon className="es-tile-icon" />
                          <span className="es-tile-label">Text box</span>
                        </button>
                        <button type="button" className="es-tile" onClick={handleAddHeading}>
                          <HashtagIcon className="es-tile-icon" />
                          <span className="es-tile-label">Heading</span>
                        </button>
                        <button type="button" className="es-tile" onClick={() => handleAddShape()}>
                          <RectangleStackIcon className="es-tile-icon" />
                          <span className="es-tile-label">Shape</span>
                        </button>
                        <button type="button" className="es-tile" onClick={() => setActiveSection('uploads' as any)}>
                          <PhotoIcon className="es-tile-icon" />
                          <span className="es-tile-label">Media</span>
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="es-section">
                    {ELEMENT_CATEGORIES.map((category) => (
                      <Shelf
                        key={category.id}
                        category={category}
                        onItemClick={handleAddItem}
                        onSeeAll={setElementsDrill}
                      />
                    ))}
                  </section>
                </>
              )}
            </>
          )}

          {/* ── Text ── */}
          {activeSection === 'text' && (
            <>
              <section className="es-section">
                <button
                  type="button"
                  className="es-dropzone"
                  onClick={handleAddText}
                  style={{ padding: '22px 16px' }}
                >
                  <PlusIcon style={{ width: 20, height: 20 }} />
                  <span className="es-dropzone-title">Add a text box</span>
                </button>
              </section>

              <section className="es-section">
                <div>
                  <div className="es-section-title"><span>Default styles</span></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                      type="button"
                      className="es-card"
                      style={{ padding: '14px 16px' }}
                      onClick={() => {
                        const element: CreateHeadingElement = {
                          type: 'heading',
                          content: '<h1>Add a heading</h1>',
                          level: 1,
                          position: { x: 50, y: 50 },
                          size: { width: 500, height: 80 },
                        };
                        const elementId = addElement(currentSlide, element);
                        setSelectedElement(elementId);
                      }}
                    >
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                        Add a heading
                      </div>
                      <div className="es-meta" style={{ marginTop: 4 }}>H1 · 48 pt</div>
                    </button>

                    <button
                      type="button"
                      className="es-card"
                      style={{ padding: '14px 16px' }}
                      onClick={() => {
                        const element: CreateHeadingElement = {
                          type: 'heading',
                          content: '<h2>Add a subheading</h2>',
                          level: 2,
                          position: { x: 50, y: 150 },
                          size: { width: 450, height: 60 },
                        };
                        const elementId = addElement(currentSlide, element);
                        setSelectedElement(elementId);
                      }}
                    >
                      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                        Add a subheading
                      </div>
                      <div className="es-meta" style={{ marginTop: 4 }}>H2 · 28 pt</div>
                    </button>

                    <button
                      type="button"
                      className="es-card"
                      style={{ padding: '14px 16px' }}
                      onClick={handleAddText}
                    >
                      <div style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.45 }}>
                        Add a little bit of body text
                      </div>
                      <div className="es-meta" style={{ marginTop: 4 }}>Body · 14 pt</div>
                    </button>
                  </div>
                </div>
              </section>

              <section className="es-section">
                <div>
                  <div className="es-section-title"><span>Dynamic</span></div>
                  <button
                    type="button"
                    className="es-card"
                    style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <span
                      className="es-meta"
                      style={{
                        width: 28,
                        height: 28,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--accent-wash)',
                        color: 'var(--accent-ink)',
                        borderRadius: 2,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      1
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>Page numbers</span>
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ── Design / Templates ── */}
          {activeSection === 'design' && (
            <>
              {selectedTemplate ? (
                <section className="es-section">
                  <button type="button" className="es-btn-back" onClick={() => setSelectedTemplate(null)}>
                    <ChevronLeftIcon className="w-3.5 h-3.5" />
                    All templates
                  </button>

                  <div>
                    <div className="es-h" style={{ wordBreak: 'break-word' }}>{selectedTemplate.name}</div>
                    <div className="es-meta" style={{ marginTop: 4 }}>
                      {selectedTemplate.slides.length} / {selectedTemplate.slideCount} slides
                    </div>
                  </div>

                  {conversionProgress.isConverting && conversionProgress.templateId === selectedTemplate.id && (
                    <div className="es-progress-row">
                      <div className="es-progress-label">
                        <span>Loading slides…</span>
                        <span className="es-meta">
                          {conversionProgress.currentSlide} / {conversionProgress.totalSlides}
                        </span>
                      </div>
                      <div className="es-progress-bar">
                        <div style={{ width: `${(conversionProgress.currentSlide / Math.max(conversionProgress.totalSlides, 1)) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="es-grid-2">
                    {selectedTemplate.slides.map((slide, index) => {
                      const thumb = selectedTemplate.thumbnails[index]
                        ? resolveUploadUrl(selectedTemplate.thumbnails[index])
                        : null;
                      return (
                        <div
                          key={slide.id}
                          className="es-slide-tile"
                          onClick={() => handleAddSlideFromTemplate(selectedTemplate, index)}
                          role="button"
                          tabIndex={0}
                        >
                          {thumb ? (
                            <img src={thumb} alt={`Slide ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div
                              style={{
                                width: '100%', height: '100%',
                                background: slide.backgroundColor || 'var(--paper-sunk)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <span className="es-meta">Slide {index + 1}</span>
                            </div>
                          )}
                          <span className="es-slide-num">{index + 1}</span>
                          <div className="es-slide-hover">
                            <PlusIcon style={{ width: 14, height: 14 }} />
                            Add slide
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="es-section">
                  <label
                    htmlFor="template-upload"
                    className="es-dropzone"
                    data-busy={isUploadingTemplate}
                  >
                    <input
                      ref={templateInputRef}
                      type="file"
                      accept=".pptx,.ppt"
                      onChange={handleTemplateUpload}
                      style={{ display: 'none' }}
                      id="template-upload"
                    />
                    {isUploadingTemplate ? (
                      <>
                        <Spinner />
                        <span className="es-dropzone-title">Processing PowerPoint…</span>
                        <span className="es-dropzone-hint">This may take a moment</span>
                      </>
                    ) : (
                      <>
                        <DocumentArrowUpIcon style={{ width: 28, height: 28, strokeWidth: 1.4 }} />
                        <span className="es-dropzone-title">Import PowerPoint</span>
                        <span className="es-dropzone-hint">.pptx · .ppt</span>
                      </>
                    )}
                  </label>

                  {templateError && (
                    <div style={{
                      padding: '10px 12px',
                      background: 'oklch(0.97 0.02 27)',
                      border: '1px solid oklch(0.82 0.08 27)',
                      borderRadius: 2,
                      color: 'oklch(0.42 0.14 27)',
                      fontSize: 12,
                    }}>
                      {templateError}
                    </div>
                  )}

                  <div>
                    <div className="es-section-title">
                      <span>Your templates</span>
                      <span className="es-count">{templates.length}</span>
                    </div>

                    {templates.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {templates.map((template) => {
                          const thumb = template.thumbnails[0] ? resolveUploadUrl(template.thumbnails[0]) : null;
                          return (
                            <div
                              key={template.id}
                              className="es-card"
                              onClick={() => setSelectedTemplate(template)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="es-card-thumb">
                                {thumb ? (
                                  <img src={thumb} alt={template.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <DocumentTextIcon style={{ width: 36, height: 36, color: 'var(--ink-ghost)', strokeWidth: 1.3 }} />
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="es-icon-btn"
                                  style={{ position: 'absolute', top: 6, right: 6 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTemplate(template.id);
                                  }}
                                  aria-label="Delete template"
                                >
                                  <XMarkIcon />
                                </button>
                                <span className="es-slide-num" style={{ top: 'auto', left: 'auto', bottom: 6, right: 6 }}>
                                  {template.slideCount} slides
                                </span>
                              </div>
                              <div className="es-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="es-h" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {template.name}
                                  </div>
                                  <div className="es-meta" style={{ marginTop: 3 }}>
                                    {new Date(template.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <ChevronRightIcon style={{ width: 16, height: 16, color: 'var(--ink-ghost)', flexShrink: 0 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="es-empty">
                        <DocumentTextIcon />
                        <div className="es-empty-title">No templates yet</div>
                        <div className="es-empty-body">
                          Import a PowerPoint file above to start pulling slides into your deck.
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── Brand ── */}
          {activeSection === 'brand' && (
            <section className="es-section">
              <div className="es-empty">
                <SwatchIcon />
                <div className="es-empty-title">Brand kit</div>
                <div className="es-empty-body">
                  Saved colors, logos, and typography will live here. Coming in the next update.
                </div>
              </div>
            </section>
          )}

          {/* ── Uploads ── */}
          {activeSection === 'uploads' && (
            <>
              <section className="es-section">
                <label htmlFor="file-upload" className="es-dropzone" data-busy={isUploading}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  {isUploading ? (
                    <>
                      <Spinner />
                      <span className="es-dropzone-title">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <CloudArrowUpIcon style={{ width: 28, height: 28, strokeWidth: 1.4 }} />
                      <span className="es-dropzone-title">Upload media</span>
                      <span className="es-dropzone-hint">Images · Video</span>
                    </>
                  )}
                </label>

                {uploadError && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'oklch(0.97 0.02 27)',
                    border: '1px solid oklch(0.82 0.08 27)',
                    borderRadius: 2,
                    color: 'oklch(0.42 0.14 27)',
                    fontSize: 12,
                  }}>
                    {uploadError}
                  </div>
                )}
              </section>

              <div className="es-tabbar" style={{ padding: '0 16px' }}>
                <button
                  type="button"
                  className="es-tab"
                  aria-selected={activeUploadTab === 'images'}
                  onClick={() => setActiveUploadTab('images')}
                >
                  <PhotoIcon style={{ width: 14, height: 14 }} />
                  Images
                </button>
                <button
                  type="button"
                  className="es-tab"
                  aria-selected={activeUploadTab === 'videos'}
                  onClick={() => setActiveUploadTab('videos')}
                >
                  <VideoCameraIcon style={{ width: 14, height: 14 }} />
                  Videos
                </button>
              </div>

              <section className="es-section">
                {activeUploadTab === 'images' ? (
                  <>
                    {uploadedFiles.filter((f) => f.type === 'image').length > 0 ? (
                      <div className="es-grid-2">
                        {uploadedFiles
                          .filter((f) => f.type === 'image')
                          .map((file) => (
                            <div
                              key={file.id}
                              className="es-upload-item"
                              onClick={() => handleAddUploadedImage(file.url)}
                              role="button"
                              tabIndex={0}
                            >
                              <img src={resolveUploadUrl(file.url)} alt={file.filename} />
                              <button
                                type="button"
                                className="es-icon-btn"
                                style={{ position: 'absolute', top: 5, right: 5 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUpload(file.filename);
                                }}
                                aria-label="Delete image"
                              >
                                <XMarkIcon />
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="es-empty">
                        <PhotoIcon />
                        <div className="es-empty-title">No images yet</div>
                        <div className="es-empty-body">Drop or browse to upload.</div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {uploadedFiles.filter((f) => f.type === 'video').length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {uploadedFiles
                          .filter((f) => f.type === 'video')
                          .map((file) => (
                            <div
                              key={file.id}
                              className="es-video-row es-upload-item"
                              style={{ aspectRatio: 'auto' }}
                              onClick={() => handleAddUploadedVideo(file.url)}
                              role="button"
                              tabIndex={0}
                            >
                              <div className="es-video-thumb">
                                <PlayIcon style={{ width: 16, height: 16 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {file.filename}
                                </div>
                                <div className="es-meta" style={{ marginTop: 2 }}>
                                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </div>
                              </div>
                              <button
                                type="button"
                                className="es-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUpload(file.filename);
                                }}
                                aria-label="Delete video"
                              >
                                <XMarkIcon />
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="es-empty">
                        <VideoCameraIcon />
                        <div className="es-empty-title">No videos yet</div>
                        <div className="es-empty-body">Drop or browse to upload.</div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}

          {/* ── Font family (invoked from text toolbar) ── */}
          {activeSection === 'fontFamily' && (
            <section className="es-section">
              <div>
                <div className="es-section-title"><span>Font family</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {fontFamilies.map((font) => (
                    <button
                      key={font}
                      type="button"
                      className="es-btn-sm"
                      style={{
                        justifyContent: 'flex-start',
                        height: 40,
                        padding: '0 14px',
                        fontFamily: font,
                        fontSize: 14,
                        border: '1px solid var(--rule-hair)',
                      }}
                      onClick={() => editorCallbacks.onFontFamilyChange?.(font)}
                    >
                      {getFontDisplayName(font)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Font color ── */}
          {activeSection === 'fontColor' && (
            <FontColorSection editorCallbacks={editorCallbacks} />
          )}

          {/* ── Text highlight ── */}
          {activeSection === 'bgColor' && (
            <BgColorSection editorCallbacks={editorCallbacks} />
          )}

          {/* ── Element background ── */}
          {activeSection === 'elementBgColor' && (
            <ElementBgColorSection editorCallbacks={editorCallbacks} />
          )}

          {/* ── Slide background ── */}
          {activeSection === 'slideBgColor' && <SlideBgColorSection />}

          {/* ── Shape fill ── */}
          {activeSection === 'shapeFillColor' && <ShapeFillColorSection />}

          {/* ── Shape border ── */}
          {activeSection === 'shapeBorderColor' && <ShapeBorderColorSection />}

          {/* ── Shape selector (swap shape type) ── */}
          {activeSection === 'shapeSelector' && <ShapeChangerSection />}

          {/* ── Position (arrange + layers) ── */}
          {activeSection === 'position' && <PositionPanel />}

          {/* ── Magic media ── */}
          {activeSection === 'magic' && (
            <section className="es-section">
              <div className="es-empty">
                <SparklesIcon />
                <div className="es-empty-title">Magic media</div>
                <div className="es-empty-body">
                  AI-generated imagery, tailored to your deck tone, will appear here.
                </div>
              </div>
            </section>
          )}

          {/* ── Charts ── two modes: editor (chart selected) / picker ── */}
          {activeSection === 'charts' && (
            selectedChart ? (
              <ChartEditorPanel elementId={selectedChart.id} />
            ) : (
              <section className="es-section">
                <div>
                  <div className="es-section-title"><span>Add a chart</span></div>
                  <div className="es-grid-2">
                    {CHART_TYPES.map((t) => {
                      const defaults = defaultChartElementProps(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className="es-shape-tile"
                          title={t.label}
                          onClick={() => handleAddChart(t.id)}
                        >
                          <div
                            className="es-shape-stage"
                            style={{
                              // 4:3 stage so line/area/pie all read clearly at
                              // tile size; bar still looks balanced.
                              aspectRatio: '4 / 3',
                              padding: 6,
                            }}
                          >
                            <ChartElement
                              elementId={`__chart_preview_${t.id}`}
                              chartType={defaults.chartType}
                              data={defaults.data}
                              stacked={defaults.stacked}
                              donut={defaults.donut}
                              mode="edit"
                              preview
                            />
                          </div>
                          <span className="es-shape-label">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="es-meta" style={{ lineHeight: 1.5, marginTop: 4 }}>
                    Series colors auto-pull from your deck palette. Click any
                    chart to customize its data, type, and style.
                  </p>
                </div>
              </section>
            )
          )}

          {/* ── Apps ── */}
          {activeSection === 'apps' && (
            <section className="es-section">
              <div className="es-empty">
                <CubeIcon />
                <div className="es-empty-title">Apps</div>
                <div className="es-empty-body">
                  Install integrations for stock media, SCORM validators, and brand assets.
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer: save */}
        <div className="es-footer">
          <SaveButton />
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      style={{ width: 18, height: 18, animation: 'lp-spin 700ms linear infinite' }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
