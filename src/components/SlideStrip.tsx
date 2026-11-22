import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../store/index';
import { Slide, SlideElement } from '../store/sliceTypes';
import { useThumbnailStore } from '../store/useThumbnailStore';
import collaborationService from '../services/CollaborationService';
import { resolveMediaUrl } from '../lib/utils';

interface SlideStripProps {
  className?: string;
}

const THUMB_W = 140;
const THUMB_H = 79; // 16:9

export const SlideStrip: React.FC<SlideStripProps> = ({ className = '' }) => {
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const addSlide = useStore((s) => s.addSlide);
  const removeSlide = useStore((s) => s.removeSlide);
  const [contextMenu, setContextMenu] = useState<{ index: number; x: number; y: number } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { thumbnails, setThumbnail } = useThumbnailStore();

  useEffect(() => {
    collaborationService.onThumbnailUpdate(({ slideId, thumbnailUrl }) => {
      setThumbnail(slideId, thumbnailUrl);
    });
  }, [setThumbnail]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Center the active thumbnail inside the strip only — never scroll the page.
  // (`element.scrollIntoView` walks all ancestors and will shift the document body
  //  horizontally if any ancestor lacks containment, which we've seen.)
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-slide-index="${currentSlide}"]`) as HTMLElement | null;
    if (!el) return;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const target = container.scrollLeft + (eRect.left - cRect.left) + eRect.width / 2 - cRect.width / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [currentSlide]);

  const duplicate = (index: number) => {
    addSlide();
    setContextMenu(null);
  };

  const remove = (index: number) => {
    if (slides.length > 1) removeSlide(index);
    setContextMenu(null);
  };

  const slideWidth = 1920;
  const slideHeight = 1080;
  const scale = Math.min(THUMB_W / slideWidth, THUMB_H / slideHeight);

  const Thumb = (slide: Slide, index: number) => {
    const active = index === currentSlide;
    const thumbUrl = thumbnails[slide.id] || (!slide.thumbnailExpired ? slide.thumbnailUrl : undefined);

    return (
      <div
        key={slide.id}
        data-slide-index={index}
        className="lp-root"
        style={{
          display: 'grid',
          gap: 6,
          flexShrink: 0,
          padding: 2,
        }}
      >
        <button
          onClick={() => setCurrentSlide(index)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ index, x: e.clientX, y: e.clientY }); }}
          className="focus-ring"
          aria-label={`Slide ${index + 1}`}
          aria-current={active ? 'true' : undefined}
          style={{
            width: THUMB_W,
            height: THUMB_H,
            padding: 0,
            border: active ? '1.5px solid var(--accent)' : '1px solid var(--rule-strong)',
            background: 'var(--paper-elev)',
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'border-color 120ms ease, box-shadow 120ms ease',
            boxShadow: active ? '0 0 0 2px color-mix(in oklch, var(--accent) 22%, transparent)' : 'none',
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--ink-faint)'; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--rule-strong)'; }}
        >
          {thumbUrl ? (
            <img
              src={resolveMediaUrl(thumbUrl)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
                width: slideWidth,
                height: slideHeight,
                background: slide.backgroundColor || '#ffffff',
                backgroundImage: slide.backgroundImage ? `url(${resolveMediaUrl(slide.backgroundImage)})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                pointerEvents: 'none',
              }}
            >
              {slide.elements.map((element) => (
                <div
                  key={element.id}
                  style={{
                    position: 'absolute',
                    left: element.position.x,
                    top: element.position.y,
                    width: element.size.width,
                    height: element.size.height,
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                    zIndex: element.zIndex || 1,
                  }}
                >
                  {renderMini(element)}
                </div>
              ))}
            </div>
          )}
        </button>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            textAlign: 'center',
            letterSpacing: '0.06em',
            color: active ? 'var(--accent-ink)' : 'var(--ink-faint)',
            fontWeight: active ? 700 : 400,
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`lp-root ${className}`}
      style={{
        background: 'var(--paper)',
        borderTop: '1px solid var(--rule-hair)',
        display: 'grid',
        gridTemplateRows: '1fr auto',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingInline: 14, paddingBlock: 10, minHeight: 0, minWidth: 0 }}>
        <div
          ref={scrollerRef}
          className="slide-scroller scrollbar-hide"
          onWheel={(e) => {
            if (scrollerRef.current) {
              e.preventDefault();
              scrollerRef.current.scrollLeft += e.deltaY;
            }
          }}
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            flex: '1 1 0%',
            minWidth: 0,
            scrollbarWidth: 'none',
          }}
        >
          <div style={{ display: 'flex', gap: 10, width: 'max-content' }}>
            {slides.map((slide, index) => Thumb(slide, index))}
          </div>
        </div>

        <button
          onClick={() => addSlide()}
          className="focus-ring"
          aria-label="Add new slide"
          title="Add slide"
          style={{
            flexShrink: 0,
            width: THUMB_W,
            height: THUMB_H + 8,
            border: '1px dashed var(--rule-strong)',
            background: 'transparent',
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            gap: 4,
            color: 'var(--ink-faint)',
            cursor: 'pointer',
            transition: 'border-color 120ms ease, color 120ms ease, background 120ms ease',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent-ink)';
            e.currentTarget.style.background = 'var(--accent-wash)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--rule-strong)';
            e.currentTarget.style.color = 'var(--ink-faint)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <PlusIcon />
          <span className="mono" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>add slide</span>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 28,
          paddingInline: 14,
          borderTop: '1px solid var(--rule-hair)',
          background: 'var(--paper-sunk)',
        }}
      >
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
            className="focus-ring"
            title="Previous slide (←)"
            aria-label="Previous"
            style={footerBtn(currentSlide === 0)}
          >
            <ChevronLeft />
          </button>
          <button
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
            className="focus-ring"
            title="Next slide (→)"
            aria-label="Next"
            style={footerBtn(currentSlide === slides.length - 1)}
          >
            <ChevronRight />
          </button>
        </div>

        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-muted)', letterSpacing: '0.06em' }}>
          <span style={{ color: 'var(--ink)', fontWeight: 700 }}>{String(currentSlide + 1).padStart(2, '0')}</span>
          <span style={{ color: 'var(--ink-ghost)', marginInline: 6 }}>/</span>
          <span>{String(slides.length).padStart(2, '0')}</span>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="lp-menu-surface lp-root"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 60, minWidth: 170 }}
        >
          <button className="lp-menu-item" onClick={() => duplicate(contextMenu.index)}>
            <DuplicateIcon /> Duplicate
          </button>
          {slides.length > 1 && (
            <button className="lp-menu-item destructive" onClick={() => remove(contextMenu.index)}>
              <TrashIcon /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SlideStrip;

function renderMini(element: SlideElement) {
  switch (element.type) {
    case 'text':
    case 'heading':
      return (
        <div
          style={{ width: '100%', height: '100%', overflow: 'hidden', backgroundColor: (element as any).backgroundColor || 'transparent' }}
          dangerouslySetInnerHTML={{ __html: (element as any).content || '' }}
        />
      );
    case 'image':
      return (
        <img
          src={resolveMediaUrl((element as any).imageUrl || '')}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: (element as any).objectFit || 'cover',
            opacity: (element as any).opacity ?? 1,
            transform: `scaleX(${(element as any).flipX ? -1 : 1}) scaleY(${(element as any).flipY ? -1 : 1})`,
          }}
        />
      );
    case 'video':
      return (
        <div style={{ width: '100%', height: '100%', background: 'oklch(0.2 0.02 265)', display: 'grid', placeItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="oklch(0.96 0.005 80)">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      );
    case 'shape':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: (element as any).fillColor || 'oklch(0.4 0.15 265)',
            borderColor: (element as any).borderColor || 'transparent',
            borderWidth: (element as any).borderWidth || 0,
            borderStyle: 'solid',
            borderRadius: (element as any).cornerRadius || 0,
            opacity: (element as any).opacity ?? 1,
          }}
        />
      );
    default:
      return null;
  }
}

function footerBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 24,
    height: 20,
    display: 'grid',
    placeItems: 'center',
    background: 'transparent',
    border: 0,
    color: disabled ? 'var(--ink-ghost)' : 'var(--ink-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 2,
    opacity: disabled ? 0.5 : 1,
    transition: 'background 120ms ease',
  };
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.25" />
      <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
function ChevronLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="square" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="square" />
    </svg>
  );
}
function DuplicateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.5" y="3.5" width="8" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="4.5" y="1.5" width="8" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 3.5h9M5 3.5V2h4v1.5M4 3.5v8.5a1 1 0 001 1h4a1 1 0 001-1V3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
