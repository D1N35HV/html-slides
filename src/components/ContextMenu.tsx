import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/index';
import { useLayoutStore } from '../store/layoutStore';
import {
  Copy,
  ClipboardPaste,
  Paintbrush,
  CopyPlus,
  Trash2,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  Layers,
} from 'lucide-react';
import type { SlideElement, TextElement, HeadingElement, ShapeElement } from '../store/sliceTypes';
import {
  copyElement as clipCopy,
  copyStyle as clipCopyStyle,
  getCopiedElement,
  getCopiedStyle,
  hasElement as clipHasElement,
  hasStyle as clipHasStyle,
  subscribeClipboard,
} from '../utils/elementClipboard';

interface ContextMenuProps {
  elementId: string;
  x: number;
  y: number;
  onClose: () => void;
}

const MENU_WIDTH = 240;
const MENU_HEIGHT_APPROX = 420;

export function ContextMenu({ elementId, x, y, onClose }: ContextMenuProps) {
  const removeElement = useStore((s) => s.removeElement);
  const removeSelectedElements = useStore((s) => s.removeSelectedElements);
  const updateElementZIndex = useStore((s) => s.updateElementZIndex);
  const duplicateElement = useStore((s) => s.duplicateElement);
  const bringForward = useStore((s) => s.bringForward);
  const sendBackward = useStore((s) => s.sendBackward);
  const addElement = useStore((s) => s.addElement);
  const setSelectedElement = useStore((s) => s.setSelectedElement);
  const clearSelection = useStore((s) => s.clearSelection);
  const selectedElementIds = useStore((s) => s.selectedElementIds);
  const currentSlide = useStore((s) => s.currentSlide);
  const slide = useStore((s) => s.slides[s.currentSlide]);
  const updateTextElement = useStore((s) => s.updateTextElement);
  const updateHeadingElement = useStore((s) => s.updateHeadingElement);
  const updateShapeElement = useStore((s) => s.updateShapeElement);
  const setActiveSidebarPanel = useLayoutStore((s) => s.setActiveSidebarPanel);
  const setPositionPanelTab = useLayoutStore((s) => s.setPositionPanelTab);

  const menuRef = useRef<HTMLDivElement>(null);

  // Re-render when the clipboard changes (affects disabled states of Paste items).
  const [clipboardTick, setClipboardTick] = useState(0);
  useEffect(() => subscribeClipboard(() => setClipboardTick((n) => n + 1)), []);

  const element = useMemo(
    () => slide?.elements?.find((el) => el.id === elementId),
    [slide, elementId, clipboardTick],
  );

  const multi = Boolean(selectedElementIds && selectedElementIds.length > 1 && selectedElementIds.includes(elementId));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const doCopy = () => {
    if (element) clipCopy(element as SlideElement);
    onClose();
  };

  const doCopyStyle = () => {
    if (element) clipCopyStyle(element as SlideElement);
    onClose();
  };

  const doPaste = () => {
    const toPaste = getCopiedElement();
    if (!toPaste) { onClose(); return; }
    const { id: _id, ...rest } = toPaste as { id: string };
    const offset = { x: (toPaste.position?.x ?? 0) + 20, y: (toPaste.position?.y ?? 0) + 20 };
    addElement(currentSlide, { ...(rest as Omit<SlideElement, 'id'>), position: offset });
    onClose();
  };

  const doPasteStyle = () => {
    const style = getCopiedStyle();
    if (!style || !element) { onClose(); return; }
    if (element.type === 'text') {
      updateTextElement(element.id, style as Partial<TextElement>);
    } else if (element.type === 'heading') {
      updateHeadingElement(element.id, style as Partial<HeadingElement>);
    } else if (element.type === 'shape') {
      updateShapeElement(element.id, style as Partial<ShapeElement>);
    }
    onClose();
  };

  const doDuplicate = () => {
    duplicateElement(elementId);
    onClose();
  };

  const doDelete = () => {
    if (multi) {
      removeSelectedElements();
      clearSelection();
    } else {
      removeElement(elementId);
      setSelectedElement(null);
    }
    onClose();
  };

  const doBringToFront = () => {
    if (!slide) return;
    const maxZ = Math.max(...(slide.elements?.map((el) => el.zIndex || 1) || [1]));
    updateElementZIndex(elementId, maxZ + 1);
    onClose();
  };

  const doBringForward = () => {
    bringForward(elementId);
    onClose();
  };

  const doSendBackward = () => {
    sendBackward(elementId);
    onClose();
  };

  const doSendToBack = () => {
    if (!slide) return;
    const minZ = Math.min(...(slide.elements?.map((el) => el.zIndex || 1) || [1]));
    updateElementZIndex(elementId, Math.max(1, minZ - 1));
    onClose();
  };

  const doShowLayers = () => {
    setPositionPanelTab('layers');
    setActiveSidebarPanel('position');
    onClose();
  };

  const canPasteStyle = clipHasStyle() && element
    && (element.type === 'text' || element.type === 'heading' || element.type === 'shape');

  // Keep the menu on-screen.
  const adjustedX = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const adjustedY = Math.min(y, window.innerHeight - MENU_HEIGHT_APPROX - 8);

  const menuContent = (
    <div
      ref={menuRef}
      className="lp-root tb-menu"
      role="menu"
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 10000,
        width: MENU_WIDTH,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <MenuItem icon={<Copy />} label="Copy" shortcut="Ctrl+C" onClick={doCopy} />
      <MenuItem
        icon={<Paintbrush />}
        label="Copy style"
        shortcut="Ctrl+Alt+C"
        onClick={doCopyStyle}
        disabled={!element || (element.type !== 'text' && element.type !== 'heading' && element.type !== 'shape')}
      />
      <MenuItem
        icon={<ClipboardPaste />}
        label={canPasteStyle && !clipHasElement() ? 'Paste style' : 'Paste'}
        shortcut="Ctrl+V"
        onClick={clipHasElement() ? doPaste : doPasteStyle}
        disabled={!clipHasElement() && !canPasteStyle}
      />
      <MenuItem icon={<CopyPlus />} label="Duplicate" shortcut="Ctrl+D" onClick={doDuplicate} />
      <MenuItem
        icon={<Trash2 />}
        label={multi ? `Delete ${selectedElementIds.length} elements` : 'Delete'}
        shortcut="Del"
        onClick={doDelete}
        destructive
      />

      <hr className="tb-menu-divider" />

      <MenuItem icon={<ChevronsUp />} label="Bring to front" shortcut="Ctrl+Alt+]" onClick={doBringToFront} />
      <MenuItem icon={<ChevronUp />} label="Bring forward" shortcut="Ctrl+]" onClick={doBringForward} />
      <MenuItem icon={<ChevronDown />} label="Send backward" shortcut="Ctrl+[" onClick={doSendBackward} />
      <MenuItem icon={<ChevronsDown />} label="Send to back" shortcut="Ctrl+Alt+[" onClick={doSendToBack} />

      <hr className="tb-menu-divider" />

      <MenuItem icon={<Layers />} label="Show layers" shortcut="Alt+1" onClick={doShowLayers} />
    </div>
  );

  return createPortal(menuContent, document.body);
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function MenuItem({ icon, label, shortcut, onClick, disabled, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`tb-menu-item${destructive ? ' tb-menu-item-danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
    >
      <span className="tb-menu-item-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      {shortcut && <span className="tb-menu-item-shortcut">{shortcut}</span>}
    </button>
  );
}
