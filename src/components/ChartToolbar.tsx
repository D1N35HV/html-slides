import React from 'react';
import { useStore } from '../store';
import { useLayoutStore } from '../store/layoutStore';
import {
  ChartBarIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

// Floating contextual toolbar for chart elements. Q9: editing primarily
// happens in the sidebar (data grid + style); this bar carries the small
// element-level affordances (delete, dupe, layer) plus an "Edit data" hint
// that re-asserts the sidebar focus when the user has navigated away from
// the Charts panel.
//
// Visual styling matches the existing ImageToolbar/ShapeToolbar so charts
// look like a sibling, not a one-off. PRODUCT.md flags the legacy toolbars
// for paper-aesthetic migration in a later pass.

interface ChartToolbarProps {
  elementId: string;
}

export const ChartToolbar: React.FC<ChartToolbarProps> = ({ elementId }) => {
  const element = useStore((s) =>
    s.slides[s.currentSlide]?.elements.find(el => el.id === elementId),
  );
  const removeElement = useStore((s) => s.removeElement);
  const duplicateElement = useStore((s) => s.duplicateElement);
  const bringForward = useStore((s) => s.bringForward);
  const sendBackward = useStore((s) => s.sendBackward);
  const setActiveSidebarPanel = useLayoutStore((s) => s.setActiveSidebarPanel);
  const activeSidebarPanel = useLayoutStore((s) => s.activeSidebarPanel);

  if (!element || element.type !== 'chart') return null;

  const editorActive = activeSidebarPanel === 'charts';

  return (
    <div
      className="chart-toolbar fixed top-[72px] z-50 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center gap-1 px-3 py-2"
      style={{
        left: 'calc(320px + (100vw - 320px) / 2)',
        transform: 'translateX(-50%)',
      }}
      // Match ShapeToolbar's contained-interactions pattern so toolbar
      // clicks don't bubble to slide-level handlers and clear selection.
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`px-2 py-1 hover:bg-gray-100 rounded flex items-center gap-1.5 text-sm ${editorActive ? 'bg-gray-100' : ''}`}
        onClick={() => setActiveSidebarPanel('charts' as any)}
        aria-pressed={editorActive}
        title="Edit data and style"
      >
        <TableCellsIcon className="w-4 h-4" />
        <span>Edit data</span>
      </button>

      <div className="w-px h-5 bg-gray-200" />

      <button
        type="button"
        className="p-1.5 hover:bg-gray-100 rounded"
        onClick={() => duplicateElement(elementId)}
        title="Duplicate"
      >
        <DocumentDuplicateIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-gray-100 rounded"
        onClick={() => bringForward(elementId)}
        title="Bring forward"
      >
        <ArrowUpIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="p-1.5 hover:bg-gray-100 rounded"
        onClick={() => sendBackward(elementId)}
        title="Send backward"
      >
        <ArrowDownIcon className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-gray-200" />

      <button
        type="button"
        className="p-1.5 hover:bg-gray-100 rounded text-red-600"
        onClick={() => removeElement(elementId)}
        title="Delete"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
