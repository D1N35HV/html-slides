import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../store/layoutStore';
import { useStore } from '../store';
import { 
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, 
  Minus, Plus,
  Type,
  Palette,
  MoreHorizontal,
  PaintRoller,
  Move,
  Play,
  Sparkles,
  Grid3X3,
  ArrowUpDown,
  Highlighter,
  PaintBucket
} from 'lucide-react';

interface CustomCKEditorToolbarProps {
  editor: any;
  isEditing: boolean;
}

export const CustomCKEditorToolbar: React.FC<CustomCKEditorToolbarProps> = ({ editor, isEditing }) => {
  const { setActiveSidebarPanel, setEditorCallbacks } = useLayoutStore();
  const { selectedElementId, slides, currentSlide, updateTextElement, updateHeadingElement } = useStore();
  const [fontFamily, setFontFamily] = useState('League Gothic');
  const [fontSize, setFontSize] = useState(56);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [alignment, setAlignment] = useState('left');
  const [fontColor, setFontColor] = useState('#000000');
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [elementBgColor, setElementBgColor] = useState<string>('transparent');

  // Get the selected element to read its background color
  const selectedElement = selectedElementId 
    ? slides[currentSlide]?.elements.find(el => el.id === selectedElementId)
    : null;

  const executeCommand = (commandName: string, value?: any) => {
    if (editor) {
      editor.execute(commandName, value);
      editor.editing.view.focus();
    }
  };

  // Register callbacks for sidebar interactions
  useEffect(() => {
    setEditorCallbacks({
      onFontFamilyChange: (font) => {
        setFontFamily(font);
        executeCommand('fontFamily', { value: font });
      },
      onFontColorChange: (color) => {
        setFontColor(color);
        executeCommand('fontColor', { value: color });
      },
      onBgColorChange: (color) => {
        setBgColor(color);
        executeCommand('fontBackgroundColor', { value: color });
      },
      onElementBgColorChange: (color) => {
        setElementBgColor(color);
        // Get fresh state from store to avoid stale closure
        const store = useStore.getState();
        const currentElement = store.selectedElementId 
          ? store.slides[store.currentSlide]?.elements.find(el => el.id === store.selectedElementId)
          : null;
        
        if (store.selectedElementId && currentElement) {
          if (currentElement.type === 'text') {
            store.updateTextElement(store.selectedElementId, { backgroundColor: color });
          } else if (currentElement.type === 'heading') {
            store.updateHeadingElement(store.selectedElementId, { backgroundColor: color });
          }
        }
      }
    });
  }, [editor]);

  // Update state when editor selection changes
  useEffect(() => {
    if (!editor) return;

    const updateState = () => {
      const selection = editor.model.document.selection;
      
      // Commands might not exist if plugins are not loaded, so we check safely
      setIsBold(editor.commands.get('bold')?.value || false);
      setIsItalic(editor.commands.get('italic')?.value || false);
      setIsUnderline(editor.commands.get('underline')?.value || false);
      setIsStrikethrough(editor.commands.get('strikethrough')?.value || false);
      
      const alignCommand = editor.commands.get('alignment');
      if (alignCommand) {
        setAlignment(alignCommand.value || 'left');
      }

      const fontSizeCommand = editor.commands.get('fontSize');
      if (fontSizeCommand && fontSizeCommand.value) {
        // fontSize value comes as string with unit (e.g., '16px')
        // Parse out the number portion
        const sizeStr = String(fontSizeCommand.value).replace(/[^0-9.]/g, '');
        const size = parseFloat(sizeStr);
        if (!isNaN(size) && size > 0) setFontSize(Math.round(size));
      }

      const fontFamilyCommand = editor.commands.get('fontFamily');
      if (fontFamilyCommand && fontFamilyCommand.value) {
        // Font family comes as full CSS value like 'Arial, Helvetica, sans-serif'
        // Extract just the primary font name for display
        const fullFontFamily = fontFamilyCommand.value;
        setFontFamily(fullFontFamily.split(',')[0].trim().replace(/['"]/g, ''));
      }
      
      const fontColorCommand = editor.commands.get('fontColor');
      if (fontColorCommand && fontColorCommand.value) {
        setFontColor(fontColorCommand.value);
      }
      
      const bgColorCommand = editor.commands.get('fontBackgroundColor');
      if (bgColorCommand) {
        setBgColor(bgColorCommand.value || null);
      }
    };

    editor.model.document.on('change:data', updateState);
    editor.editing.view.document.on('selectionChange', updateState);

    return () => {
      editor.model.document.off('change:data', updateState);
      editor.editing.view.document.off('selectionChange', updateState);
    };
  }, [editor]);

  if (!isEditing || !editor) return null;

  const toggleStyle = (style: string) => {
    executeCommand(style);
  };

  const changeFontSize = (delta: number) => {
    const newSize = fontSize + delta;
    if (newSize > 0) {
      setFontSize(newSize);
      // CKEditor fontSize plugin expects string values with units (e.g., '16px')
      executeCommand('fontSize', { value: `${newSize}px` }); 
    }
  };

  return (
    <div 
      className="custom-ckeditor-toolbar fixed top-[72px] z-50 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-2 px-4 py-2 overflow-x-auto max-w-[calc(100vw-380px)]"
      style={{
        left: 'calc(320px + (100vw - 320px) / 2)',
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing focus from editor
    >
      {/* Font Family */}
      <div className="relative group min-w-[120px]">
        <button 
          className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100 rounded text-sm font-medium"
          onClick={() => setActiveSidebarPanel('fontFamily')}
        >
          <span className="truncate">{fontFamily}</span>
          <ArrowUpDown className="w-3 h-3 ml-2 opacity-50" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Font Size */}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => changeFontSize(-1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Minus className="w-4 h-4" />
        </button>
        <input 
          type="number" 
          value={fontSize}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val) && val > 0) {
              setFontSize(val);
              executeCommand('fontSize', { value: `${val}px` });
            }
          }}
          className="w-10 text-center text-sm border-none focus:ring-0 p-0"
        />
        <button 
          onClick={() => changeFontSize(1)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Text Color */}
      <div className="relative">
        <button 
          className="p-1 hover:bg-gray-100 rounded flex flex-col items-center justify-center"
          onClick={() => setActiveSidebarPanel('fontColor')}
          title="Text Color"
        >
          <span className="font-bold text-lg leading-none">A</span>
          <div className="w-4 h-1 mt-0.5" style={{ backgroundColor: fontColor }}></div>
        </button>
      </div>

      {/* Text Highlight Color */}
      <div className="relative">
        <button 
          className="p-1 hover:bg-gray-100 rounded flex flex-col items-center justify-center"
          onClick={() => setActiveSidebarPanel('bgColor')}
          title="Text Highlight"
        >
          <Highlighter className="w-4 h-4" />
          <div className="w-4 h-1 mt-0.5" style={{ backgroundColor: bgColor || '#ffff00' }}></div>
        </button>
      </div>

      {/* Element Background Color */}
      <div className="relative">
        <button 
          className="p-1 hover:bg-gray-100 rounded flex flex-col items-center justify-center"
          onClick={() => setActiveSidebarPanel('elementBgColor')}
          title="Text Box Background"
        >
          <PaintBucket className="w-4 h-4" />
          <div className="w-4 h-1 mt-0.5 border border-gray-300" style={{ backgroundColor: (selectedElement as any)?.backgroundColor || 'transparent' }}></div>
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Styles */}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => toggleStyle('bold')}
          className={`p-1.5 rounded ${isBold ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button 
          onClick={() => toggleStyle('italic')}
          className={`p-1.5 rounded ${isItalic ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <Italic className="w-4 h-4" />
        </button>
        <button 
          onClick={() => toggleStyle('underline')}
          className={`p-1.5 rounded ${isUnderline ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <Underline className="w-4 h-4" />
        </button>
        <button 
          onClick={() => toggleStyle('strikethrough')}
          className={`p-1.5 rounded ${isStrikethrough ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
        >
          <Strikethrough className="w-4 h-4" />
        </button>
        <button 
          className="p-1.5 hover:bg-gray-100 rounded font-serif font-bold"
          title="Uppercase"
        >
          aA
        </button>
      </div>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Alignment */}
      <button 
        className="p-1.5 hover:bg-gray-100 rounded"
        onClick={() => {
          const nextAlign = alignment === 'left' ? 'center' : alignment === 'center' ? 'right' : alignment === 'right' ? 'justify' : 'left';
          executeCommand('alignment', { value: nextAlign });
        }}
      >
        {alignment === 'left' && <AlignLeft className="w-4 h-4" />}
        {alignment === 'center' && <AlignCenter className="w-4 h-4" />}
        {alignment === 'right' && <AlignRight className="w-4 h-4" />}
        {alignment === 'justify' && <AlignJustify className="w-4 h-4" />}
      </button>

      {/* Lists */}
      <button 
        onClick={() => executeCommand('bulletedList')}
        className="p-1.5 hover:bg-gray-100 rounded"
      >
        <List className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Spacing */}
      <button className="p-1.5 hover:bg-gray-100 rounded">
        <ArrowUpDown className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      {/* Extra Actions */}
      <button className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded text-sm font-medium">
        <Sparkles className="w-4 h-4" />
        <span>Effects</span>
      </button>
      
      <button className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded text-sm font-medium">
        <Play className="w-4 h-4" />
        <span>Animate</span>
      </button>

      <button className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded text-sm font-medium">
        <Move className="w-4 h-4" />
        <span>Position</span>
      </button>

      <div className="w-px h-6 bg-gray-200 mx-1" />

      <button className="p-1.5 hover:bg-gray-100 rounded">
        <Grid3X3 className="w-4 h-4 opacity-50" />
      </button>
      
      <button className="p-1.5 hover:bg-gray-100 rounded">
        <PaintRoller className="w-4 h-4" />
      </button>

    </div>
  );
};
