import React, { useMemo } from 'react';
import {
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  GripVertical,
  Type as TypeIcon,
  Heading as HeadingIcon,
  Film as FilmIcon,
  Image as ImageIcon,
  Square as SquareIcon,
  HelpCircle as HelpCircleIcon,
  CheckCircle2 as CheckCircle2Icon,
} from 'lucide-react';
import { useStore } from '../../store/index';
import { useLayoutStore } from '../../store/layoutStore';
import type { SlideElement } from '../../store/sliceTypes';
import { ShapeRenderer } from '../ShapeElement';
import { resolveMediaUrl } from '../../lib/utils';

/**
 * "Position" panel content — tabs + body. Rendered inside the
 * left ElementsSidebar when activeSidebarPanel === 'position',
 * opened by the ContextMenu's "Show layers" action.
 *
 * Two tabs:
 *   Arrange — four stacking-order actions with shortcuts.
 *   Layers  — flat list of every element on the current slide, front-to-back,
 *             with a tiny preview, element label, and click-to-select.
 */
export function PositionPanel() {
  const tab = useLayoutStore((s) => s.positionPanelTab);
  const setTab = useLayoutStore((s) => s.setPositionPanelTab);

  return (
    <div className="pp-root">
      <div className="pp-tabs" role="tablist" aria-label="Position">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'arrange'}
          className={`pp-tab${tab === 'arrange' ? ' pp-tab-active' : ''}`}
          onClick={() => setTab('arrange')}
        >
          Arrange
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'layers'}
          className={`pp-tab${tab === 'layers' ? ' pp-tab-active' : ''}`}
          onClick={() => setTab('layers')}
        >
          Layers
        </button>
      </div>

      <div className="pp-body">
        {tab === 'arrange' ? <ArrangeTab /> : <LayersTab />}
      </div>
    </div>
  );
}

function ArrangeTab() {
  const selectedElementId = useStore((s) => s.selectedElementId);
  const slide = useStore((s) => s.slides[s.currentSlide]);
  const updateElementZIndex = useStore((s) => s.updateElementZIndex);
  const bringForward = useStore((s) => s.bringForward);
  const sendBackward = useStore((s) => s.sendBackward);

  const disabled = !selectedElementId || !slide;

  const bringToFront = () => {
    if (!selectedElementId || !slide) return;
    const maxZ = Math.max(...(slide.elements?.map((el) => el.zIndex || 1) || [1]));
    updateElementZIndex(selectedElementId, maxZ + 1);
  };
  const sendToBack = () => {
    if (!selectedElementId || !slide) return;
    const minZ = Math.min(...(slide.elements?.map((el) => el.zIndex || 1) || [1]));
    updateElementZIndex(selectedElementId, Math.max(1, minZ - 1));
  };

  return (
    <div className="pp-arrange">
      {disabled && (
        <div className="pp-empty">Select an element on the canvas to arrange it.</div>
      )}
      <ArrangeRow
        icon={<ChevronsUp />}
        label="Bring to front"
        shortcut="Ctrl+Alt+]"
        onClick={bringToFront}
        disabled={disabled}
      />
      <ArrangeRow
        icon={<ChevronUp />}
        label="Bring forward"
        shortcut="Ctrl+]"
        onClick={() => selectedElementId && bringForward(selectedElementId)}
        disabled={disabled}
      />
      <ArrangeRow
        icon={<ChevronDown />}
        label="Send backward"
        shortcut="Ctrl+["
        onClick={() => selectedElementId && sendBackward(selectedElementId)}
        disabled={disabled}
      />
      <ArrangeRow
        icon={<ChevronsDown />}
        label="Send to back"
        shortcut="Ctrl+Alt+["
        onClick={sendToBack}
        disabled={disabled}
      />
    </div>
  );
}

function ArrangeRow({
  icon, label, shortcut, onClick, disabled,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="pp-arrange-row"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
    >
      <span className="pp-arrange-icon" aria-hidden="true">{icon}</span>
      <span className="pp-arrange-label">{label}</span>
      <span className="pp-arrange-shortcut">{shortcut}</span>
    </button>
  );
}

function LayersTab() {
  const slide = useStore((s) => s.slides[s.currentSlide]);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const setSelectedElement = useStore((s) => s.setSelectedElement);
  const [filter, setFilter] = React.useState<'all' | 'overlap'>('all');

  const selected = slide?.elements?.find((el) => el.id === selectedElementId);

  // Visual stacking: top (front) first — highest zIndex at the top of the list.
  const ordered = useMemo(() => {
    const list = (slide?.elements ?? []).slice();
    list.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));
    return list;
  }, [slide]);

  const visible = useMemo(() => {
    if (filter === 'all' || !selected) return ordered;
    return ordered.filter((el) => el.id === selected.id || overlaps(el, selected));
  }, [filter, ordered, selected]);

  return (
    <div className="pp-layers">
      <div className="pp-filter" role="tablist" aria-label="Layer filter">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={`pp-filter-chip${filter === 'all' ? ' pp-filter-chip-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'overlap'}
          className={`pp-filter-chip${filter === 'overlap' ? ' pp-filter-chip-active' : ''}`}
          onClick={() => setFilter('overlap')}
          disabled={!selected}
          title={!selected ? 'Select an element to see overlapping layers' : undefined}
        >
          Overlapping
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="pp-empty">No layers to show.</div>
      ) : (
        <ul className="pp-layer-list" role="list">
          {visible.map((el) => (
            <li key={el.id}>
              <button
                type="button"
                className={`pp-layer${selectedElementId === el.id ? ' pp-layer-active' : ''}`}
                onClick={() => setSelectedElement(el.id)}
              >
                <span className="pp-layer-grip" aria-hidden="true"><GripVertical /></span>
                <span className="pp-layer-preview"><LayerPreview element={el} /></span>
                <span className="pp-layer-label">{labelFor(el)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelFor(el: SlideElement): string {
  switch (el.type) {
    case 'text':
    case 'heading': {
      const raw = (el as { content?: string }).content ?? '';
      const stripped = raw.replace(/<[^>]+>/g, '').trim();
      return stripped ? stripped.slice(0, 40) : (el.type === 'heading' ? 'Heading' : 'Text');
    }
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'shape': return `Shape — ${(el as { shapeType?: string }).shapeType ?? 'rectangle'}`;
    case 'multiple_choice': return 'Multiple choice';
    case 'true_false': return 'True / false';
    default: return (el as { type?: string }).type ?? 'Element';
  }
}

function LayerPreview({ element }: { element: SlideElement }) {
  if (element.type === 'image') {
    const url = resolveMediaUrl((element as { imageUrl?: string }).imageUrl);
    if (url) {
      return <img src={url} alt="" className="pp-layer-thumb-img" draggable={false} />;
    }
    return <ImageIcon />;
  }
  if (element.type === 'video') return <FilmIcon />;
  if (element.type === 'shape') {
    const shape = element as any;
    return (
      <span className="pp-layer-thumb-shape" aria-hidden="true">
        <ShapeRenderer
          shapeType={shape.shapeType ?? 'rectangle'}
          fillColor={shape.fillColor ?? '#2f3383'}
          borderColor={shape.borderColor ?? '#2f3383'}
          borderWidth={1}
          preserveAspectRatio="xMidYMid meet"
        />
      </span>
    );
  }
  if (element.type === 'heading') return <HeadingIcon />;
  if (element.type === 'text') return <TypeIcon />;
  if (element.type === 'multiple_choice') return <HelpCircleIcon />;
  if (element.type === 'true_false') return <CheckCircle2Icon />;
  return <SquareIcon />;
}

function overlaps(a: SlideElement, b: SlideElement): boolean {
  const ax = a.position?.x ?? 0;
  const ay = a.position?.y ?? 0;
  const aw = a.size?.width ?? 0;
  const ah = a.size?.height ?? 0;
  const bx = b.position?.x ?? 0;
  const by = b.position?.y ?? 0;
  const bw = b.size?.width ?? 0;
  const bh = b.size?.height ?? 0;
  return !(ax + aw < bx || bx + bw < ax || ay + ah < by || by + bh < ay);
}
