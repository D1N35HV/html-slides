import React, { useState, useEffect, useRef } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useStore } from '../store/index';
import { useLayoutStore } from '../store/layoutStore';
import type { CreateTextElement, CreateHeadingElement, CreateImageElement, CreateVideoElement, CreateShapeElement } from '../store/sliceTypes';
import apiService from '../services/ApiService';
import collaborationService from '../services/CollaborationService';
import { ShapePreview } from './ShapeElement';
import {
  DocumentTextIcon,
  HashtagIcon,
  PhotoIcon,
  PlayIcon,
  RectangleStackIcon,
  PlusIcon,
  PaintBrushIcon,
  EyeDropperIcon,
  AdjustmentsHorizontalIcon,
  TrashIcon,
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
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { SaveButton } from './SaveButton';

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
  }>;
  slideCount: number;
  createdAt: string;
  thumbnails: string[];
  mediaFolder: string;
}

// Font Color Section Component with Color Picker
interface FontColorSectionProps {
  colors: string[];
  editorCallbacks: {
    onFontColorChange?: (color: string) => void;
  };
}

function FontColorSection({ colors, editorCallbacks }: FontColorSectionProps) {
  const [customColor, setCustomColor] = useState('#6366f1');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleCustomColorApply = () => {
    editorCallbacks.onFontColorChange?.(customColor);
    // Add to recent colors if not already present
    if (!recentColors.includes(customColor)) {
      setRecentColors(prev => [customColor, ...prev.slice(0, 4)]);
    }
  };

  const handlePresetColorClick = (color: string) => {
    editorCallbacks.onFontColorChange?.(color);
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Text Color</h3>

      {/* Preset Colors Grid */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {colors.map(color => (
          <button
            key={color}
            className="w-8 h-8 rounded-full border-2 border-gray-200 hover:scale-110 hover:border-purple-400 transition-all shadow-sm"
            style={{ backgroundColor: color }}
            onClick={() => handlePresetColorClick(color)}
            title={color}
          />
        ))}
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2">Recent Colors</h4>
          <div className="flex gap-2">
            {recentColors.map((color, idx) => (
              <button
                key={`recent-${idx}`}
                className="w-7 h-7 rounded-full border-2 border-gray-200 hover:scale-110 hover:border-purple-400 transition-all shadow-sm"
                style={{ backgroundColor: color }}
                onClick={() => handlePresetColorClick(color)}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Color Section */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Custom Color</h3>

        <div className="flex items-center gap-3 mb-3">
          <button
            className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-purple-400 transition-colors shadow-sm"
            style={{ backgroundColor: customColor }}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Click to open color picker"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">#</span>
              <HexColorInput
                color={customColor}
                onChange={setCustomColor}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                prefixed={false}
              />
            </div>
          </div>
          <button
            onClick={handleCustomColorApply}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Color Picker */}
        {showColorPicker && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <HexColorPicker
              color={customColor}
              onChange={setCustomColor}
              style={{ width: '100%', height: '160px' }}
            />
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">Selected: {customColor}</span>
              <button
                onClick={() => setShowColorPicker(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Background Color Section Component with Color Picker
interface BgColorSectionProps {
  colors: string[];
  editorCallbacks: {
    onBgColorChange?: (color: string) => void;
  };
}

function BgColorSection({ colors, editorCallbacks }: BgColorSectionProps) {
  const [customColor, setCustomColor] = useState('#ffff00');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Highlight-friendly colors
  const highlightColors = [
    '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff6600',
    '#ff9999', '#99ff99', '#9999ff', '#ffcc00', '#ff99cc',
    '#ccff00', '#00ccff', '#cc99ff', '#ffcc99', '#99ccff',
    'transparent'
  ];

  const handleCustomColorApply = () => {
    editorCallbacks.onBgColorChange?.(customColor);
    if (!recentColors.includes(customColor)) {
      setRecentColors(prev => [customColor, ...prev.slice(0, 4)]);
    }
  };

  const handlePresetColorClick = (color: string) => {
    editorCallbacks.onBgColorChange?.(color);
  };

  const handleRemoveHighlight = () => {
    editorCallbacks.onBgColorChange?.('transparent');
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Text Background / Highlight</h3>

      {/* Remove Highlight Button */}
      <button
        onClick={handleRemoveHighlight}
        className="w-full mb-4 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
      >
        <span className="w-4 h-4 border border-gray-300 rounded bg-white relative">
          <span className="absolute inset-0 flex items-center justify-center text-red-500 text-xs">✕</span>
        </span>
        Remove Highlight
      </button>

      {/* Preset Highlight Colors Grid */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {highlightColors.filter(c => c !== 'transparent').map(color => (
          <button
            key={color}
            className="w-8 h-8 rounded border-2 border-gray-200 hover:scale-110 hover:border-purple-400 transition-all shadow-sm"
            style={{ backgroundColor: color }}
            onClick={() => handlePresetColorClick(color)}
            title={color}
          />
        ))}
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2">Recent Colors</h4>
          <div className="flex gap-2">
            {recentColors.map((color, idx) => (
              <button
                key={`recent-bg-${idx}`}
                className="w-7 h-7 rounded border-2 border-gray-200 hover:scale-110 hover:border-purple-400 transition-all shadow-sm"
                style={{ backgroundColor: color }}
                onClick={() => handlePresetColorClick(color)}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Color Section */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Custom Color</h3>

        <div className="flex items-center gap-3 mb-3">
          <button
            className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-purple-400 transition-colors shadow-sm"
            style={{ backgroundColor: customColor }}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Click to open color picker"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">#</span>
              <HexColorInput
                color={customColor}
                onChange={setCustomColor}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                prefixed={false}
              />
            </div>
          </div>
          <button
            onClick={handleCustomColorApply}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Color Picker */}
        {showColorPicker && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <HexColorPicker
              color={customColor}
              onChange={setCustomColor}
              style={{ width: '100%', height: '160px' }}
            />
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">Selected: {customColor}</span>
              <button
                onClick={() => setShowColorPicker(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Element Background Color Section Component with Color Picker
interface ElementBgColorSectionProps {
  colors: string[];
  editorCallbacks: {
    onElementBgColorChange?: (color: string) => void;
  };
}

function ElementBgColorSection({ colors, editorCallbacks }: ElementBgColorSectionProps) {
  const [customColor, setCustomColor] = useState('#ffffff');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Background-friendly colors (more muted/professional)
  const bgColors = [
    '#ffffff', '#f8f9fa', '#e9ecef', '#dee2e6', '#ced4da',
    '#fff3cd', '#d4edda', '#d1ecf1', '#cce5ff', '#f8d7da',
    '#ffeaa7', '#dfe6e9', '#fab1a0', '#74b9ff', '#a29bfe',
    '#00cec9', '#fdcb6e', '#e17055', '#0984e3', '#6c5ce7',
    'transparent'
  ];

  const handleCustomColorApply = () => {
    editorCallbacks.onElementBgColorChange?.(customColor);
    if (!recentColors.includes(customColor)) {
      setRecentColors(prev => [customColor, ...prev.slice(0, 4)]);
    }
  };

  const handlePresetColorClick = (color: string) => {
    editorCallbacks.onElementBgColorChange?.(color);
  };

  const handleRemoveBackground = () => {
    editorCallbacks.onElementBgColorChange?.('transparent');
  };

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Text Box Background</h3>

      {/* Remove Background Button */}
      <button
        onClick={handleRemoveBackground}
        className="w-full mb-4 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
      >
        <span className="w-4 h-4 border border-gray-300 rounded bg-white relative">
          <span className="absolute inset-0 flex items-center justify-center text-red-500 text-xs">✕</span>
        </span>
        Remove Background
      </button>

      {/* Preset Background Colors Grid */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {bgColors.filter(c => c !== 'transparent').map(color => (
          <button
            key={color}
            className="w-8 h-8 rounded border-2 border-gray-200 hover:scale-110 hover:border-purple-400 transition-all shadow-sm"
            style={{ backgroundColor: color }}
            onClick={() => handlePresetColorClick(color)}
            title={color}
          />
        ))}
      </div>

      {/* Recent Colors */}
      {recentColors.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-gray-500 mb-2">Recent Colors</h4>
          <div className="flex gap-2">
            {recentColors.map((color, idx) => (
              <button
                key={`recent-elem-bg-${idx}`}
                className="w-7 h-7 rounded border-2 border-gray-200 hover:scale-110 hover:border-purple-400 transition-all shadow-sm"
                style={{ backgroundColor: color }}
                onClick={() => handlePresetColorClick(color)}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Color Section */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Custom Color</h3>

        <div className="flex items-center gap-3 mb-3">
          <button
            className="w-10 h-10 rounded-lg border-2 border-gray-300 hover:border-purple-400 transition-colors shadow-sm"
            style={{ backgroundColor: customColor }}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Click to open color picker"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">#</span>
              <HexColorInput
                color={customColor}
                onChange={setCustomColor}
                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                prefixed={false}
              />
            </div>
          </div>
          <button
            onClick={handleCustomColorApply}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Color Picker */}
        {showColorPicker && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <HexColorPicker
              color={customColor}
              onChange={setCustomColor}
              style={{ width: '100%', height: '160px' }}
            />
            <div className="mt-3 flex justify-between items-center">
              <span className="text-xs text-gray-500">Selected: {customColor}</span>
              <button
                onClick={() => setShowColorPicker(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ElementsSidebar() {
  const {
    addElement,
    currentSlide,
    selectedElementId,
    selectedElementIds,
    slides,
    setSelectedElement
  } = useStore();
  const {
    isEditorMinimized,
    activeSidebarPanel,
    setActiveSidebarPanel,
    editorCallbacks
  } = useLayoutStore();

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

  // Listen for PPT conversion progress events via socket.io
  useEffect(() => {
    collaborationService.onPPTProgress((event) => {
      if (event.type === 'init' && event.totalSlides) {
        setConversionProgress(prev => ({
          ...prev,
          totalSlides: event.totalSlides!,
          templateId: event.presentationId
        }));
      } else if (event.type === 'slide' && event.slide) {
        // Update progress
        setConversionProgress(prev => ({
          ...prev,
          currentSlide: (event.slideIndex ?? 0) + 1
        }));

        // Add slide to the template in templates list
        if (event.presentationId) {
          setTemplates(prev => prev.map(template => {
            if (template.id === event.presentationId) {
              // Only add if not already present
              const slideExists = template.slides.some(s => s.id === event.slide.id);
              if (!slideExists) {
                return {
                  ...template,
                  slides: [...template.slides, event.slide]
                };
              }
            }
            return template;
          }));
        }
      } else if (event.type === 'complete') {
        setConversionProgress(prev => ({ ...prev, isConverting: false }));
      } else if (event.type === 'error') {
        console.error('PPT conversion error:', event.error);
        setConversionProgress(prev => ({ ...prev, isConverting: false }));
        setTemplateError(event.error || 'Conversion failed');
      }
    });
  }, []);

  // Use activeSidebarPanel from store instead of local state
  const activeSection = activeSidebarPanel;
  const setActiveSection = setActiveSidebarPanel;

  // Fetch uploads when the uploads section is active
  useEffect(() => {
    if (activeSection === 'uploads') {
      fetchUploads();
    }
  }, [activeSection]);

  // Fetch templates when the design section is active
  useEffect(() => {
    if (activeSection === 'design') {
      fetchTemplates();
    }
  }, [activeSection]);

  const fetchTemplates = async () => {
    try {
      const response = await apiService.getTemplates();
      if (response.success && response.data) {
        setTemplates(response.data);
      }
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
        // Initialize conversion progress
        setConversionProgress({
          isConverting: true,
          currentSlide: 0,
          totalSlides: 0,
          filename: file.name
        });

        // Use streaming upload - slides are received via socket.io events
        const response = await apiService.uploadTemplateStreaming(file);

        // Reset conversion progress
        setConversionProgress(prev => ({ ...prev, isConverting: false }));

        if (response.success && response.data) {
          setTemplates(prev => [response.data!, ...prev]);
        }
      }
    } catch (error) {
      console.error('Template upload error:', error);
      setTemplateError('Failed to upload PowerPoint file. Please try again.');
      setConversionProgress(prev => ({ ...prev, isConverting: false }));
    } finally {
      setIsUploadingTemplate(false);
      if (templateInputRef.current) {
        templateInputRef.current.value = '';
      }
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const response = await apiService.deleteTemplate(templateId);
      if (response.success) {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
        }
      }
    } catch (error) {
      console.error('Delete template error:', error);
    }
  };

  const handleAddSlideFromTemplate = async (template: Template, slideIndex: number) => {
    try {
      // Try API first (loads from database if available)
      const response = await apiService.getTemplateSlide(template.id, slideIndex);

      let slideData;
      if (response.success && response.data) {
        slideData = response.data;
      } else {
        // Fallback to local state (for slides not yet in template.json)
        slideData = template.slides[slideIndex];
        if (!slideData) {
          console.error('Slide not found');
          return;
        }
        // Generate new IDs for local slide
        slideData = {
          id: `slide-${crypto.randomUUID()}`,
          elements: (slideData.elements || []).map((el: any) => ({
            ...el,
            id: `element-${crypto.randomUUID()}`,
          })),
          backgroundColor: slideData.backgroundColor,
          backgroundImage: slideData.backgroundImage,
        };
      }

      // Get current store state and add the slide
      const { slides, setSlides } = useStore.getState();

      // Add slide to presentation
      const updatedSlides = [...slides, slideData];
      setSlides(updatedSlides, updatedSlides.length - 1);
    } catch (error) {
      console.error('Error adding slide from template:', error);

      // Fallback to local state on error
      const slideData = template.slides[slideIndex];
      if (slideData) {
        const { slides, setSlides } = useStore.getState();
        const newSlide = {
          id: `slide-${crypto.randomUUID()}`,
          elements: (slideData.elements || []).map((el: any) => ({
            ...el,
            id: `element-${crypto.randomUUID()}`,
          })),
          backgroundColor: slideData.backgroundColor,
          backgroundImage: slideData.backgroundImage,
        };
        const updatedSlides = [...slides, newSlide];
        setSlides(updatedSlides, updatedSlides.length - 1);
      }
    }
  };

  const fetchUploads = async () => {
    try {
      const response = await apiService.getUploads();
      if (response.success && response.data) {
        setUploadedFiles(response.data);
      }
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
          setUploadedFiles(prev => [{
            id: response.data!.id,
            filename: response.data!.filename,
            type: response.data!.type,
            url: response.data!.url,
            size: response.data!.size,
            createdAt: response.data!.createdAt
          }, ...prev]);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteUpload = async (filename: string) => {
    try {
      const response = await apiService.deleteUpload(filename);
      if (response.success) {
        setUploadedFiles(prev => prev.filter(f => f.filename !== filename));
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleAddUploadedImage = (url: string) => {
    // Get the base URL from environment or default
    const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    const element: CreateImageElement = {
      type: 'image',
      position: { x: 100, y: 200 },
      size: { width: 300, height: 200 },
      imageUrl: fullUrl
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddUploadedVideo = (url: string) => {
    // Get the base URL from environment or default
    const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    const element: CreateVideoElement = {
      type: 'video',
      position: { x: 100, y: 200 },
      size: { width: 400, height: 225 },
      videoUrl: fullUrl
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
    'League Gothic, sans-serif'
  ];

  // Display names for font families
  const getFontDisplayName = (font: string) => font.split(',')[0].trim();

  const colors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#808080', '#800000'
  ];

  if (isEditorMinimized) {
    return null;
  }

  const currentSlideData = slides[currentSlide];
  const effectiveSelectedId = selectedElementId || (selectedElementIds?.length === 1 ? selectedElementIds[0] : null);
  const selectedElement = effectiveSelectedId
    ? currentSlideData?.elements?.find(el => el.id === effectiveSelectedId)
    : null;

  const handleAddText = () => {
    const element: CreateTextElement = {
      type: 'text',
      content: '<p>Double-click to edit and format your text with the rich text editor!</p>',
      position: { x: 50, y: 150 },
      size: { width: 400, height: 100 }
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
      size: { width: 500, height: 80 }
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  const handleAddShape = (shapeType: 'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram' = 'rectangle') => {
    const element: CreateShapeElement = {
      type: 'shape',
      position: { x: 150, y: 150 },
      size: { width: 200, height: 150 },
      shapeType: shapeType,
      fillColor: '#3B82F6',
      borderColor: '#1E40AF',
      borderWidth: 2,
      opacity: 1
    };
    const elementId = addElement(currentSlide, element);
    setSelectedElement(elementId);
  };

  // All available shape types for the sidebar
  const shapeTypes: Array<'rectangle' | 'circle' | 'triangle' | 'arrow' | 'diamond' | 'pentagon' | 'hexagon' | 'star' | 'heart' | 'cloud' | 'callout' | 'parallelogram'> = [
    'rectangle', 'circle', 'triangle', 'arrow', 'diamond', 'pentagon',
    'hexagon', 'star', 'heart', 'cloud', 'callout', 'parallelogram'
  ];

  return (
    <div className="flex h-full">
      {/* Left Navigation Bar */}
      <div className="w-16 bg-white flex flex-col">
        {/* Navigation Icons */}
        <div className="flex flex-col p-2 space-y-1">
          <button
            onClick={() => setActiveSection('design')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'design'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <PaintBrushIcon className="w-6 h-6 mb-1" />
            <span>Design</span>
          </button>

          <button
            onClick={() => setActiveSection('elements')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'elements'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Squares2X2Icon className="w-6 h-6 mb-1" />
            <span>Elements</span>
          </button>

          <button
            onClick={() => setActiveSection('text')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'text'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <DocumentTextIcon className="w-6 h-6 mb-1" />
            <span>Text</span>
          </button>

          <button
            onClick={() => setActiveSection('brand')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'brand'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <SwatchIcon className="w-6 h-6 mb-1" />
            <span>Brand</span>
          </button>

          <button
            onClick={() => setActiveSection('uploads')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'uploads'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <CloudArrowUpIcon className="w-6 h-6 mb-1" />
            <span>Uploads</span>
          </button>

          <button
            onClick={() => setActiveSection('magic')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'magic'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <SparklesIcon className="w-6 h-6 mb-1" />
            <span>Magic Media</span>
          </button>

          <button
            onClick={() => setActiveSection('charts')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'charts'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <ChartBarIcon className="w-6 h-6 mb-1" />
            <span>Charts</span>
          </button>
        </div>

        {/* Apps Section at Bottom */}
        <div className="mt-auto p-2">
          <button
            onClick={() => setActiveSection('apps')}
            className={`flex flex-col items-center p-3 rounded-lg text-xs transition-colors ${activeSection === 'apps'
              ? 'bg-purple-100 text-purple-600'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <CubeIcon className="w-6 h-6 mb-1" />
            <span>Apps</span>
          </button>
        </div>
      </div>

      {/* Main Content Panel */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search fonts and combinations"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Text Section */}
          {activeSection === 'text' && (
            <div className="p-4">
              <div className="space-y-6">
                {/* Add a text box section */}
                <div>
                  <button
                    onClick={handleAddText}
                    className="w-full flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
                  >
                    <PlusIcon className="w-6 h-6 text-gray-400 group-hover:text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-gray-600 group-hover:text-purple-700">Add a text box</span>
                  </button>
                </div>

                {/* Default text styles */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Default text styles</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        const element: CreateHeadingElement = {
                          type: 'heading',
                          content: '<h1>Add a heading</h1>',
                          level: 1,
                          position: { x: 50, y: 50 },
                          size: { width: 500, height: 80 }
                        };
                        const elementId = addElement(currentSlide, element);
                        setSelectedElement(elementId);
                      }}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-2xl font-bold text-gray-900">Add a heading</div>
                    </button>

                    <button
                      onClick={() => {
                        const element: CreateHeadingElement = {
                          type: 'heading',
                          content: '<h2>Add a subheading</h2>',
                          level: 2,
                          position: { x: 50, y: 150 },
                          size: { width: 450, height: 60 }
                        };
                        const elementId = addElement(currentSlide, element);
                        setSelectedElement(elementId);
                      }}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-xl font-semibold text-gray-700">Add a subheading</div>
                    </button>

                    <button
                      onClick={handleAddText}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                    >
                      <div className="text-base text-gray-600">Add a little bit of body text</div>
                    </button>
                  </div>
                </div>

                {/* Dynamic text */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Dynamic text</h3>
                  <div className="space-y-2">
                    <button className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-purple-600 text-white rounded flex items-center justify-center text-sm font-bold mr-3">
                          1
                        </div>
                        <span className="text-sm text-gray-700">Page numbers</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Elements Section */}
          {activeSection === 'elements' && (
            <div className="p-4">
              <div className="space-y-6">
                {/* Quick Add Elements */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Add</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleAddText}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
                    >
                      <DocumentTextIcon className="w-8 h-8 text-gray-600 group-hover:text-purple-600 mb-2" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Text</span>
                    </button>
                    <button
                      onClick={handleAddHeading}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
                    >
                      <HashtagIcon className="w-8 h-8 text-gray-600 group-hover:text-purple-600 mb-2" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Heading</span>
                    </button>
                    <button
                      onClick={() => handleAddShape()}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
                    >
                      <RectangleStackIcon className="w-8 h-8 text-gray-600 group-hover:text-purple-600 mb-2" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Shape</span>
                    </button>
                    <button
                      onClick={() => setActiveSection('uploads')}
                      className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors group"
                    >
                      <CloudArrowUpIcon className="w-8 h-8 text-gray-600 group-hover:text-purple-600 mb-2" />
                      <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Media</span>
                    </button>
                  </div>
                </div>

                {/* Shapes Gallery */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Shapes</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {shapeTypes.map((shapeType) => (
                      <ShapePreview
                        key={shapeType}
                        shapeType={shapeType}
                        size={40}
                        onClick={() => handleAddShape(shapeType)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Design Section */}
          {activeSection === 'design' && (
            <div className="p-4">
              <div className="space-y-4">
                {/* Template View - Show slides when a template is selected */}
                {selectedTemplate ? (
                  <div className="space-y-4">
                    {/* Back Button */}
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="flex items-center text-sm text-gray-600 hover:text-purple-600 transition-colors"
                    >
                      <ChevronLeftIcon className="w-4 h-4 mr-1" />
                      Back to Templates
                    </button>

                    {/* Template Name */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {selectedTemplate.name}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {selectedTemplate.slides.length} / {selectedTemplate.slideCount} slides
                      </span>
                    </div>

                    {/* Loading Progress Indicator */}
                    {conversionProgress.isConverting && conversionProgress.templateId === selectedTemplate.id && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-purple-700 font-medium flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading slides...
                          </span>
                          <span className="text-purple-600">
                            {conversionProgress.currentSlide} / {conversionProgress.totalSlides}
                          </span>
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-2">
                          <div
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(conversionProgress.currentSlide / conversionProgress.totalSlides) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Slides Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {selectedTemplate.slides.map((slide, index) => {
                        const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
                        const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
                        const thumbnailUrl = selectedTemplate.thumbnails[index]
                          ? `${baseUrl}${selectedTemplate.thumbnails[index]}`
                          : null;

                        return (
                          <div
                            key={slide.id}
                            className="relative group aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all border border-gray-200"
                            onClick={() => handleAddSlideFromTemplate(selectedTemplate, index)}
                          >
                            {thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt={`Slide ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"
                                style={{ backgroundColor: slide.backgroundColor || '#ffffff' }}>
                                <span className="text-gray-400 text-xs">Slide {index + 1}</span>
                              </div>
                            )}

                            {/* Slide Number Badge */}
                            <div className="absolute top-1 left-1 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded">
                              {index + 1}
                            </div>

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-center">
                                <PlusIcon className="w-8 h-8 text-white mx-auto mb-1" />
                                <span className="text-white text-xs font-medium">Add to Presentation</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Templates List View */
                  <div className="space-y-4">
                    {/* Upload PPT Button */}
                    <div>
                      <input
                        ref={templateInputRef}
                        type="file"
                        accept=".pptx,.ppt"
                        onChange={handleTemplateUpload}
                        className="hidden"
                        id="template-upload"
                      />
                      <label
                        htmlFor="template-upload"
                        className={`w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isUploadingTemplate
                          ? 'border-purple-400 bg-purple-50'
                          : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                          }`}
                      >
                        {isUploadingTemplate ? (
                          <>
                            <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
                            <span className="text-sm font-medium text-purple-600">Processing PowerPoint...</span>
                            <span className="text-xs text-purple-500 mt-1">This may take a moment</span>
                          </>
                        ) : (
                          <>
                            <DocumentArrowUpIcon className="w-10 h-10 text-gray-400 mb-2" />
                            <span className="text-sm font-medium text-gray-600">Upload PowerPoint</span>
                            <span className="text-xs text-gray-400 mt-1">.pptx or .ppt files</span>
                          </>
                        )}
                      </label>
                    </div>

                    {templateError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{templateError}</p>
                      </div>
                    )}

                    {/* Templates Header */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Your Templates</h3>
                      <span className="text-xs text-gray-500">{templates.length} templates</span>
                    </div>

                    {/* Templates Grid */}
                    {templates.length > 0 ? (
                      <div className="space-y-3">
                        {templates.map((template) => {
                          const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
                          const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
                          const thumbnailUrl = template.thumbnails[0]
                            ? `${baseUrl}${template.thumbnails[0]}`
                            : null;

                          return (
                            <div
                              key={template.id}
                              className="relative group bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-purple-300 hover:shadow-md transition-all"
                              onClick={() => setSelectedTemplate(template)}
                            >
                              {/* Thumbnail */}
                              <div className="aspect-[16/9] bg-gray-100 relative">
                                {thumbnailUrl ? (
                                  <img
                                    src={thumbnailUrl}
                                    alt={template.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <DocumentTextIcon className="w-12 h-12 text-gray-300" />
                                  </div>
                                )}

                                {/* Slide Count Badge */}
                                <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                  {template.slideCount} slides
                                </div>

                                {/* Delete Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTemplate(template.id);
                                  }}
                                  className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                >
                                  <XMarkIcon className="w-3 h-3 text-white" />
                                </button>
                              </div>

                              {/* Template Info */}
                              <div className="p-3">
                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                  {template.name}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(template.createdAt).toLocaleDateString()}
                                </p>
                              </div>

                              {/* Hover Arrow */}
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRightIcon className="w-5 h-5 text-purple-600" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <DocumentTextIcon className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-sm">No templates yet</p>
                        <p className="text-xs mt-1">Upload a PowerPoint to get started</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Brand Section */}
          {activeSection === 'brand' && (
            <div className="p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Brand Kit</h3>
                  <div className="text-sm text-gray-600">Brand elements coming soon...</div>
                </div>
              </div>
            </div>
          )}

          {/* Uploads Section */}
          {activeSection === 'uploads' && (
            <div className="p-4">
              <div className="space-y-4">
                {/* Upload Button */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isUploading
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                      }`}
                  >
                    {isUploading ? (
                      <>
                        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
                        <span className="text-sm font-medium text-purple-600">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <CloudArrowUpIcon className="w-10 h-10 text-gray-400 mb-2" />
                        <span className="text-sm font-medium text-gray-600">Upload images or videos</span>
                        <span className="text-xs text-gray-400 mt-1">Drag & drop or click to browse</span>
                      </>
                    )}
                  </label>
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{uploadError}</p>
                  </div>
                )}

                {/* Tabs for Images/Videos */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveUploadTab('images')}
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeUploadTab === 'images'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <PhotoIcon className="w-4 h-4 inline mr-1" />
                    Images
                  </button>
                  <button
                    onClick={() => setActiveUploadTab('videos')}
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeUploadTab === 'videos'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    <VideoCameraIcon className="w-4 h-4 inline mr-1" />
                    Videos
                  </button>
                </div>

                {/* Uploaded Files Grid */}
                <div>
                  {activeUploadTab === 'images' && (
                    <div className="grid grid-cols-2 gap-2">
                      {uploadedFiles
                        .filter(f => f.type === 'image')
                        .map(file => {
                          const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
                          const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
                          const fullUrl = file.url.startsWith('http') ? file.url : `${baseUrl}${file.url}`;

                          return (
                            <div
                              key={file.id}
                              className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                              onClick={() => handleAddUploadedImage(file.url)}
                            >
                              <img
                                src={fullUrl}
                                alt={file.filename}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                                <PlusIcon className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUpload(file.filename);
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                              >
                                <XMarkIcon className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          );
                        })}
                      {uploadedFiles.filter(f => f.type === 'image').length === 0 && (
                        <div className="col-span-2 text-center py-8 text-gray-400">
                          <PhotoIcon className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm">No images uploaded yet</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeUploadTab === 'videos' && (
                    <div className="space-y-2">
                      {uploadedFiles
                        .filter(f => f.type === 'video')
                        .map(file => {
                          const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
                          const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
                          const fullUrl = file.url.startsWith('http') ? file.url : `${baseUrl}${file.url}`;

                          return (
                            <div
                              key={file.id}
                              className="relative group flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-purple-50 hover:ring-2 hover:ring-purple-500 transition-all"
                              onClick={() => handleAddUploadedVideo(file.url)}
                            >
                              <div className="w-16 h-12 bg-gray-200 rounded flex items-center justify-center mr-3">
                                <PlayIcon className="w-6 h-6 text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 truncate">{file.filename}</p>
                                <p className="text-xs text-gray-400">
                                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteUpload(file.filename);
                                }}
                                className="p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                              >
                                <XMarkIcon className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          );
                        })}
                      {uploadedFiles.filter(f => f.type === 'video').length === 0 && (
                        <div className="text-center py-8 text-gray-400">
                          <VideoCameraIcon className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-sm">No videos uploaded yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Font Family Section */}
          {activeSection === 'fontFamily' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Fonts</h3>
              <div className="space-y-1">
                {fontFamilies.map(font => (
                  <button
                    key={font}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 text-sm rounded transition-colors"
                    style={{ fontFamily: font }}
                    onClick={() => editorCallbacks.onFontFamilyChange?.(font)}
                  >
                    {getFontDisplayName(font)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Font Color Section */}
          {activeSection === 'fontColor' && (
            <FontColorSection
              colors={colors}
              editorCallbacks={editorCallbacks}
            />
          )}

          {/* Text Highlight Color Section */}
          {activeSection === 'bgColor' && (
            <BgColorSection
              colors={colors}
              editorCallbacks={editorCallbacks}
            />
          )}

          {/* Element Background Color Section */}
          {activeSection === 'elementBgColor' && (
            <ElementBgColorSection
              colors={colors}
              editorCallbacks={editorCallbacks}
            />
          )}

          {/* Magic Media Section */}
          {activeSection === 'magic' && (
            <div className="p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Magic Media</h3>
                  <div className="text-sm text-gray-600">AI-powered media generation...</div>
                </div>
              </div>
            </div>
          )}

          {/* Charts Section */}
          {activeSection === 'charts' && (
            <div className="p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Charts</h3>
                  <div className="text-sm text-gray-600">Chart elements coming soon...</div>
                </div>
              </div>
            </div>
          )}

          {/* Apps Section */}
          {activeSection === 'apps' && (
            <div className="p-4">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Apps</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {/* App Icons */}
                    <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg mb-2 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">TG</span>
                      </div>
                      <span className="text-xs text-gray-600">TypeGradient</span>
                    </div>
                    <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-green-500 rounded-lg mb-2 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">E</span>
                      </div>
                      <span className="text-xs text-gray-600">TypeExtrude</span>
                    </div>
                    <div className="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg mb-2 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">TC</span>
                      </div>
                      <span className="text-xs text-gray-600">TypeCraft</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Recently used</h3>
                  <div className="text-sm text-gray-600">No recently used apps</div>
                </div>
              </div>
            </div>
          )}

          {/* Element Properties removed - now using floating toolbars */}
        </div>

        {/* Save Button */}
        <div className="p-4 border-t border-gray-200">
          <SaveButton />
        </div>
      </div>
    </div>
  );
}
