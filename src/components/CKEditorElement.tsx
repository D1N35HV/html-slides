import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import { CustomInlineEditor } from '../editor/CustomInlineEditor';
import { useStore } from '../store/index';
import { useShallow } from 'zustand/react/shallow';
import { ckEditorConfig } from '../config/ckeditor';
import { CustomCKEditorToolbar } from './CustomCKEditorToolbar';

// Registry of hidden CKEditor instances keyed by element id, so the shared
// toolbar can fan commands out across every text/heading element in the
// current multi-selection.
const hiddenEditorRegistry = new Map<string, any>();
export function getHiddenEditor(elementId: string) {
  return hiddenEditorRegistry.get(elementId);
}
export function getHiddenEditorsFor(elementIds: string[]) {
  return elementIds
    .map((id) => hiddenEditorRegistry.get(id))
    .filter(Boolean);
}

interface CKEditorElementProps {
  elementId: string;
  content: string;
  type: 'text' | 'heading';
  mode?: 'edit' | 'present';
  backgroundColor?: string;
}

export function CKEditorElement({ elementId, content, type, mode = 'edit', backgroundColor }: CKEditorElementProps) {
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [hiddenEditorInstance, setHiddenEditorInstance] = useState<any>(null);
  const [currentContent, setCurrentContent] = useState(content);
  const [lastDragTime, setLastDragTime] = useState(0);
  const updateTextElement = useStore((s) => s.updateTextElement);
  const updateHeadingElement = useStore((s) => s.updateHeadingElement);
  const setEditingElement = useStore((s) => s.setEditingElement);
  const editingElementId = useStore((s) => s.editingElementId);
  const globalDragState = useStore(useShallow((s) => s.globalDragState));
  const isSelectedFromStore = useStore((s) => s.selectedElementIds.includes(elementId));
  // Only one toolbar should be rendered across a multi-selection. "Primary"
  // is selectedElementId when a single element is selected, otherwise the
  // first id in selectedElementIds.
  const isPrimarySelected = useStore((s) => {
    if (s.selectedElementId) return s.selectedElementId === elementId;
    return s.selectedElementIds[0] === elementId;
  });
  // Narrow selector: subscribe only to the specific element this editor renders.
  // Keeps this component out of the re-render loop when other elements change.
  const slideEl = useStore((s) => s.slides[s.currentSlide]?.elements?.find(el => el.id === elementId)) as any;
  const editorRef = useRef<HTMLDivElement>(null);

  // Helper function to update content based on element type
  const updateElementContent = (elementId: string, content: string) => {
    if (type === 'text') {
      updateTextElement(elementId, { content });
    } else if (type === 'heading') {
      updateHeadingElement(elementId, { content });
    }
  };

  // Check if this element is currently being edited
  const isEditing = editingElementId === elementId;
  const isSelected = isSelectedFromStore;

  // Track drag state changes to prevent editing after drag
  useEffect(() => {
    if (globalDragState?.hasMoved) {
      setLastDragTime(Date.now());
    }
  }, [globalDragState?.hasMoved]);

  // Update content when props change
  useEffect(() => {
    setCurrentContent(content);
  }, [content]);

  // Handle clicking outside to stop editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && editorRef.current) {
        const target = event.target as Node;

        // Check if click is within the editor container
        if (editorRef.current.contains(target)) {
          return;
        }

        // Check if click is within CKEditor toolbar or other CKEditor UI elements
        const ckEditorElements = document.querySelectorAll('.ck');
        for (const element of ckEditorElements) {
          if (element.contains(target)) {
            return;
          }
        }

        // Check for CKEditor balloon panels and dropdowns
        const ckBalloonPanels = document.querySelectorAll('.ck-balloon-panel');
        for (const panel of ckBalloonPanels) {
          if (panel.contains(target)) {
            return;
          }
        }

        // Check for CKEditor dropdown menus
        const ckDropdowns = document.querySelectorAll('.ck-dropdown__panel');
        for (const dropdown of ckDropdowns) {
          if (dropdown.contains(target)) {
            return;
          }
        }

        // Check for Custom CKEditor Toolbar
        const customToolbar = document.querySelector('.custom-ckeditor-toolbar');
        if (customToolbar && customToolbar.contains(target)) {
          return;
        }

        // If we get here, the click was outside the editor and its UI elements
        stopEditing();
      }
    };

    const handleGlobalClick = (event: MouseEvent) => {
      // Prevent any clicks from being processed if currently dragging
      if (globalDragState?.isDragging || globalDragState?.hasMoved) {
        console.log('Intercepting click during drag state:', globalDragState);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isEditing) {
        stopEditing();
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    // Global click interceptor for drag protection
    document.addEventListener('click', handleGlobalClick, true); // Use capture phase

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, [isEditing, globalDragState]);

  // Cleanup effect to destroy editor on unmount
  useEffect(() => {
    return () => {
      if (editorInstance) {
        try {
          editorInstance.destroy().catch((error: any) => {
            console.warn('Error destroying editor on unmount:', error);
          });
        } catch (error) {
          console.warn('Error during editor cleanup:', error);
        }
      }
      if (hiddenEditorInstance) {
        if (hiddenEditorRegistry.get(elementId) === hiddenEditorInstance) {
          hiddenEditorRegistry.delete(elementId);
        }
        try {
          hiddenEditorInstance.destroy().catch((error: any) => {
            console.warn('Error destroying hidden editor on unmount:', error);
          });
        } catch (error) {
          console.warn('Error during hidden editor cleanup:', error);
        }
      }
    };
  }, [editorInstance, hiddenEditorInstance]);

  const startEditing = () => {
    console.log('Starting inline edit mode for element:', elementId);
    setEditingElement(elementId);
  };

  const stopEditing = () => {
    console.log('Stopping inline edit mode');
    if (editorInstance) {
      try {
        // Get the data before destroying the editor
        const data = editorInstance.getData();
        console.log('Saving content:', data);

        // Only update if we have valid data, otherwise keep current content
        if (data !== undefined && data !== null) {
          setCurrentContent(data);
          updateElementContent(elementId, data);
        } else {
          console.warn('Editor data is undefined, keeping current content:', currentContent);
          // If no valid data, use current content or fallback
          const fallbackContent = currentContent || content;
          if (fallbackContent) {
            updateElementContent(elementId, fallbackContent);
          }
        }

        // Properly destroy the editor
        editorInstance.destroy().then(() => {
          console.log('Editor destroyed successfully');
          setEditorInstance(null);
        }).catch((error: any) => {
          console.warn('Error destroying editor:', error);
          setEditorInstance(null);
        });
      } catch (error) {
        console.log('Error during stop editing:', error);
        // If there's an error getting data, try to preserve current content
        if (currentContent || content) {
          const fallbackContent = currentContent || content;
          updateElementContent(elementId, fallbackContent);
          console.log('Used fallback content:', fallbackContent);
        }
        setEditorInstance(null);
      }
    }
    setEditingElement(null);
  };

  const handleHiddenEditorReady = (editor: any) => {
    console.log('Hidden editor ready', editor);
    setHiddenEditorInstance(editor);
    hiddenEditorRegistry.set(elementId, editor);

    // Select all content in hidden editor so commands apply to everything
    try {
      const root = editor.model.document.getRoot();
      if (root && root.childCount > 0) {
        const range = editor.model.createRangeIn(root);
        editor.model.change((writer: any) => {
          writer.setSelection(range);
        });
      }
    } catch (error) {
      console.log('Hidden editor selection error:', error);
    }

    // Auto-save on every change
    editor.model.document.on('change:data', () => {
      try {
        const data = editor.getData();
        setCurrentContent(data);
        updateElementContent(elementId, data);
      } catch (error) {
        console.log('Auto-save error:', error);
      }
    });
  };

  const handleEditorReady = (editor: any) => {
    console.log('Inline editor ready', editor);
    setEditorInstance(editor);

    // Ensure the editor and toolbar are visible
    const editorElement = editor.ui.getEditableElement();
    console.log('Editor editable element:', editorElement);
    if (editorElement) {
      editorElement.style.visibility = 'visible';
      editorElement.style.opacity = '1';
      editorElement.style.zIndex = '9999';
      editorElement.style.background = 'transparent';
      editorElement.style.color = 'inherit';
      editorElement.style.fontSize = 'inherit';
      editorElement.style.fontFamily = 'inherit';
      editorElement.style.fontWeight = 'inherit';
      editorElement.style.lineHeight = 'inherit';
      editorElement.style.border = 'none';
      editorElement.style.padding = '0';
      editorElement.style.margin = '0';
      console.log('Applied visibility styles to editor element');
    }

    // Make sure toolbar is visible for inline editor
    try {
      const toolbarElement = editor.ui.view.toolbar?.element;
      console.log('Toolbar element:', toolbarElement);
      if (toolbarElement) {
        toolbarElement.style.visibility = 'visible';
        toolbarElement.style.opacity = '1';
        toolbarElement.style.zIndex = '10000';
        toolbarElement.style.display = 'flex';
        toolbarElement.style.position = 'absolute';
        console.log('Applied visibility styles to toolbar');
      } else {
        console.log('Toolbar element not found - checking for balloon toolbar');
      }
    } catch (error) {
      console.log('Error accessing toolbar element:', error);
    }

    // Focus the editor immediately and more reliably
    setTimeout(() => {
      try {
        console.log('Attempting to focus editor...');
        // Focus the editing view
        editor.editing.view.focus();

        // Move cursor to end of content
        const root = editor.model.document.getRoot();
        if (root && root.childCount > 0) {
          const range = editor.model.createRangeIn(root);
          editor.model.change((writer: any) => {
            writer.setSelection(range.end);
          });
        }

        console.log('Editor focused and cursor positioned');
      } catch (error) {
        console.log('Focus error:', error);
      }
    }, 100);

    // Auto-save on every change
    editor.model.document.on('change:data', () => {
      try {
        const data = editor.getData();
        setCurrentContent(data);
        updateElementContent(elementId, data);
      } catch (error) {
        console.log('Auto-save error:', error);
      }
    });

    // Prevent Reveal.js keyboard events when editor is focused
    editor.editing.view.document.on('keydown', (evt: any, data: any) => {
      // Stop propagation to prevent Reveal.js from handling keyboard events
      data.domEvent.stopPropagation();
    });
  };

  const handleClick = useCallback((e: React.MouseEvent) => {
    const timeSinceLastDrag = Date.now() - lastDragTime;
    const isDragBlocked = timeSinceLastDrag < 300; // Block for 300ms after drag

    console.log('CKEditorElement clicked!', {
      isEditing,
      elementId,
      globalDragState,
      isDragging: globalDragState?.isDragging,
      hasMoved: globalDragState?.hasMoved,
      timeSinceLastDrag,
      isDragBlocked
    });

    // Prevent editing if currently dragging, recently moved, or within drag cooldown
    if (!isEditing && !globalDragState?.isDragging && !globalDragState?.hasMoved && !isDragBlocked) {
      e.preventDefault();
      e.stopPropagation();
      startEditing();
    } else {
      console.log('Click blocked due to drag state');
    }
  }, [isEditing, elementId, globalDragState, startEditing, lastDragTime]);

  const handleEditorError = (error: any) => {
    console.error('CKEditor error:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
  };

  const editorConfig: any = {
    licenseKey: 'GPL', // GPL license for open source projects
    toolbar: [], // Hide default toolbar to use custom one
    // Ensure alignment plugin is available with all options including justify
    alignment: {
      options: ['left', 'center', 'right', 'justify']
    },
    fontSize: {
      options: [
        '8px', '9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '22px', '24px', '26px', '28px', '36px', '48px', '56px', '64px', '72px', '96px'
      ],
      supportAllValues: true
    },
    fontColor: {
      colors: [
        {
          color: 'hsl(0, 0%, 0%)',
          label: 'Black'
        },
        {
          color: 'hsl(0, 0%, 30%)',
          label: 'Dim grey'
        },
        {
          color: 'hsl(0, 0%, 60%)',
          label: 'Grey'
        },
        {
          color: 'hsl(0, 0%, 90%)',
          label: 'Light grey'
        },
        {
          color: 'hsl(0, 0%, 100%)',
          label: 'White',
          hasBorder: true
        },
        {
          color: 'hsl(0, 75%, 60%)',
          label: 'Red'
        },
        {
          color: 'hsl(30, 75%, 60%)',
          label: 'Orange'
        },
        {
          color: 'hsl(60, 75%, 60%)',
          label: 'Yellow'
        },
        {
          color: 'hsl(90, 75%, 60%)',
          label: 'Light green'
        },
        {
          color: 'hsl(120, 75%, 60%)',
          label: 'Green'
        },
        {
          color: 'hsl(150, 75%, 60%)',
          label: 'Aquamarine'
        },
        {
          color: 'hsl(180, 75%, 60%)',
          label: 'Turquoise'
        },
        {
          color: 'hsl(210, 75%, 60%)',
          label: 'Light blue'
        },
        {
          color: 'hsl(240, 75%, 60%)',
          label: 'Blue'
        },
        {
          color: 'hsl(270, 75%, 60%)',
          label: 'Purple'
        }
      ]
    },
    placeholder: type === 'heading' ? 'Click to edit heading' : 'Click to edit text'
  };

  if (isEditing) {
    return (
      <>
        {editorInstance && createPortal(
          <CustomCKEditorToolbar editor={editorInstance} isEditing={isEditing} />,
          document.body
        )}
        <div
          ref={editorRef}
          className="inline-editor-container relative w-full h-full"
          style={{
            minWidth: '200px',
            minHeight: type === 'heading' ? '48px' : '32px',
            padding: '8px',
            background: 'rgba(59, 130, 246, 0.05)',
            border: '2px solid #3b82f6',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            position: 'relative',
            display: 'block'
          }}
        >

          <CKEditor
            editor={CustomInlineEditor as any}
            data={currentContent || content}
            config={editorConfig}
            onReady={handleEditorReady}
            onError={handleEditorError}
          />
        </div>
      </>
    );
  }

  const baseClasses = 'inline-text-element w-full h-full rounded border-2 transition-all duration-200 relative outline-none overflow-hidden';
  const interactiveClasses = 'cursor-text hover:border-blue-200 group';
  const presentClasses = 'cursor-default border-transparent';

  return (
    <>
      {isSelected && !isEditing && mode === 'edit' && (
        <>
          {/* Only the primary-selected element renders the toolbar. All
              selected text elements still mount their hidden editor so the
              shared toolbar can fan commands across them. */}
          {isPrimarySelected && hiddenEditorInstance && createPortal(
            <CustomCKEditorToolbar editor={hiddenEditorInstance} isEditing={true} />,
            document.body
          )}
          <div style={{ display: 'none' }}>
            <CKEditor
              editor={CustomInlineEditor as any}
              data={currentContent || content}
              config={editorConfig}
              onReady={handleHiddenEditorReady}
              onError={handleEditorError}
            />
          </div>
        </>
      )}
      <div
        ref={editorRef}
        onDoubleClick={mode === 'edit' ? handleClick : undefined}
        className={`${baseClasses} ${mode === 'edit' ? interactiveClasses : presentClasses}`}
        style={{
          display: 'block',
          minHeight: type === 'heading' ? '48px' : '32px',
          pointerEvents: mode === 'edit' ? 'auto' : 'none',
          background: backgroundColor || (mode === 'present' ? 'transparent' : undefined),
          borderColor: 'transparent',
          zIndex: isEditing ? 9999 : 'auto',
          position: 'relative'
        }}
      >
        <div
          className="w-full h-full overflow-hidden pointer-events-auto"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent:
              slideEl?.verticalAlign === 'middle' ? 'center'
              : slideEl?.verticalAlign === 'bottom' ? 'flex-end'
              : 'flex-start',
            paddingTop:    slideEl?.paddingTop    ?? 0,
            paddingRight:  slideEl?.paddingRight  ?? 0,
            paddingBottom: slideEl?.paddingBottom ?? 0,
            paddingLeft:   slideEl?.paddingLeft   ?? 0,
            boxSizing: 'border-box',
            height: '100%',
          }}
          onDoubleClick={(e) => {
            if (mode !== 'edit') return;
            const timeSinceLastDrag = Date.now() - lastDragTime;
            const isDragBlocked = timeSinceLastDrag < 300; // Block for 300ms after drag

            console.log('Inner content clicked!', {
              isEditing,
              elementId,
              globalDragState,
              isDragging: globalDragState?.isDragging,
              hasMoved: globalDragState?.hasMoved,
              timeSinceLastDrag,
              isDragBlocked
            });

            // Prevent editing if currently dragging, recently moved, or within drag cooldown
            if (!isEditing && !globalDragState?.isDragging && !globalDragState?.hasMoved && !isDragBlocked) {
              e.preventDefault();
              e.stopPropagation();
              startEditing();
            } else {
              console.log('Inner click blocked due to drag state');
            }
          }}
          dangerouslySetInnerHTML={{
            __html: currentContent || content || (type === 'heading' ? '<h1>Click to edit heading</h1>' : '<p>Click to edit text</p>')
          }}
        />
        {mode === 'edit' && (
          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-bl transition-opacity duration-200 pointer-events-none">
            Click to edit
          </div>
        )}
      </div>
    </>
  );
}
