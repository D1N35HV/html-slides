import React, { useEffect, useRef, useState, useCallback } from 'react';
import type Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import { useStore } from '../store';
import { revealConfig } from '../config/reveal';
import { createDeck } from '../utils/reveal';
import { SlidePreview } from './SlidePreview';
import { XMarkIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useNavigate, useParams } from 'react-router-dom';

const CHROME_IDLE_MS = 2500;

export const PresentationViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Reveal.Api>();
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const setEditingElement = useStore((s) => s.setEditingElement);
  const setSelectedElement = useStore((s) => s.setSelectedElement);

  useEffect(() => {
    try {
      if (typeof setEditingElement === 'function') setEditingElement(null);
      if (typeof setSelectedElement === 'function') setSelectedElement(null);
    } catch (e) {
      console.warn('[PresentationViewer] Failed to clear edit state', e);
    }
  }, [setEditingElement, setSelectedElement]);

  const [ready, setReady] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { id } = useParams();

  const slidesTransitionKey = slides
    .map((s) => `${s.id}-${s.transition || 'slide'}-${s.transitionSpeed || 'default'}`)
    .join(',');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  const markActivity = useCallback(() => {
    setChromeVisible(true);
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false);
    }, CHROME_IDLE_MS);
  }, []);

  useEffect(() => {
    markActivity();
    const onMove = () => markActivity();
    const onKey = () => markActivity();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onMove);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [markActivity]);

  useEffect(() => {
    const init = async () => {
      if (!containerRef.current) return;
      try {
        if (deckRef.current) deckRef.current.destroy();
        deckRef.current = await createDeck(containerRef.current, {
          ...revealConfig,
          embedded: false,
          controls: false,
          progress: false,
          keyboard: true,
          touch: true,
          overview: true,
          help: true,
        });
        setReady(true);
        deckRef.current.slide(currentSlide, 0);
      } catch (e) {
        console.error('[PresentationViewer] init error', e);
      }
    };
    init();
    return () => {
      deckRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!ready || !deckRef.current) return;
    const t = setTimeout(() => {
      deckRef.current?.sync();
      deckRef.current?.layout();
      deckRef.current?.slide(currentSlide, 0);
    }, 50);
    return () => clearTimeout(t);
  }, [slides.length, ready, currentSlide, slidesTransitionKey]);

  useEffect(() => {
    if (!ready || !deckRef.current) return;
    const handler = (event: any) => {
      setCurrentSlide(event.indexh || 0);
    };
    deckRef.current.on('slidechanged', handler);
    return () => {
      deckRef.current?.off('slidechanged', handler as any);
    };
  }, [ready, setCurrentSlide]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate(`/editor/${id}`);
      }
    },
    [navigate, id]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        /* ignore */
      });
    }
  }, []);

  const exit = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {}).finally(() => navigate(`/editor/${id}`));
    } else {
      navigate(`/editor/${id}`);
    }
  };

  const goPrev = () => {
    deckRef.current?.prev();
    markActivity();
  };
  const goNext = () => {
    deckRef.current?.next();
    markActivity();
  };

  const isFirst = currentSlide === 0;
  const isLast = currentSlide === slides.length - 1;
  const total = Math.max(slides.length, 1);
  const progress = total > 1 ? (currentSlide / (total - 1)) * 100 : 0;

  const chromeTransition = reducedMotion
    ? { transition: 'none' }
    : { transition: 'opacity 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' };

  return (
    <div
      className="presentation-mode fixed inset-0 z-[1000] select-none font-sans"
      style={{
        backgroundColor: 'oklch(0.14 0.02 265)',
        color: 'oklch(0.94 0.01 265)',
      }}
      role="region"
      aria-label="Presentation"
    >
      {/* Top chrome */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-3"
        style={{
          zIndex: 20,
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? 'auto' : 'none',
          background:
            'linear-gradient(to bottom, oklch(0.14 0.02 265 / 0.85) 0%, oklch(0.14 0.02 265 / 0) 100%)',
          ...chromeTransition,
        }}
        onMouseMove={markActivity}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={exit}
            className="group/btn inline-flex items-center gap-2 px-2.5 h-8 text-[13px] font-medium tracking-wide rounded-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: 'oklch(0.2 0.025 265 / 0.7)',
              border: '1px solid oklch(0.3 0.035 265)',
              color: 'oklch(0.94 0.01 265)',
              outlineColor: 'oklch(0.62 0.14 265)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'oklch(0.26 0.035 265 / 0.85)';
              e.currentTarget.style.borderColor = 'oklch(0.4 0.05 265)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'oklch(0.2 0.025 265 / 0.7)';
              e.currentTarget.style.borderColor = 'oklch(0.3 0.035 265)';
            }}
            aria-label="Exit presentation (Escape)"
            title="Exit presentation"
          >
            <XMarkIcon className="w-4 h-4" />
            <span>Exit</span>
            <span
              className="font-mono text-[11px] tracking-wider px-1.5 py-0.5 leading-none"
              style={{
                backgroundColor: 'oklch(0.1 0.015 265)',
                color: 'oklch(0.72 0.02 265)',
                border: '1px solid oklch(0.26 0.03 265)',
              }}
            >
              Esc
            </span>
          </button>
          <div
            className="h-4 w-px"
            style={{ backgroundColor: 'oklch(0.3 0.035 265)' }}
            aria-hidden="true"
          />
          <span
            className="text-[12px] font-medium uppercase tracking-[0.14em]"
            style={{ color: 'oklch(0.72 0.02 265)' }}
          >
            Presenting
          </span>
          {isLast && slides.length > 1 && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 leading-none"
              style={{
                backgroundColor: 'oklch(0.28 0.12 265)',
                color: 'oklch(0.92 0.02 265)',
                border: '1px solid oklch(0.42 0.14 265)',
              }}
              role="status"
            >
              End of deck
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={goPrev}
            disabled={isFirst}
            className="h-8 w-8 inline-flex items-center justify-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: 'oklch(0.2 0.025 265 / 0.7)',
              border: '1px solid oklch(0.3 0.035 265)',
              color: 'oklch(0.94 0.01 265)',
              opacity: isFirst ? 0.35 : 1,
              cursor: isFirst ? 'not-allowed' : 'pointer',
              outlineColor: 'oklch(0.62 0.14 265)',
            }}
            onMouseEnter={(e) => {
              if (isFirst) return;
              e.currentTarget.style.backgroundColor = 'oklch(0.26 0.035 265 / 0.85)';
              e.currentTarget.style.borderColor = 'oklch(0.4 0.05 265)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'oklch(0.2 0.025 265 / 0.7)';
              e.currentTarget.style.borderColor = 'oklch(0.3 0.035 265)';
            }}
            aria-label="Previous slide (Left arrow)"
            title="Previous slide — ←"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>

          <div
            className="font-mono text-[13px] tabular-nums px-3 h-8 inline-flex items-center justify-center min-w-[72px]"
            style={{
              backgroundColor: 'oklch(0.1 0.015 265)',
              border: '1px solid oklch(0.26 0.03 265)',
              color: 'oklch(0.9 0.01 265)',
            }}
            aria-hidden="true"
          >
            <span>{String(currentSlide + 1).padStart(2, '0')}</span>
            <span className="mx-1.5" style={{ color: 'oklch(0.5 0.02 265)' }}>
              /
            </span>
            <span style={{ color: 'oklch(0.72 0.02 265)' }}>
              {String(total).padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={goNext}
            disabled={isLast}
            className="h-8 w-8 inline-flex items-center justify-center focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: 'oklch(0.2 0.025 265 / 0.7)',
              border: '1px solid oklch(0.3 0.035 265)',
              color: 'oklch(0.94 0.01 265)',
              opacity: isLast ? 0.35 : 1,
              cursor: isLast ? 'not-allowed' : 'pointer',
              outlineColor: 'oklch(0.62 0.14 265)',
            }}
            onMouseEnter={(e) => {
              if (isLast) return;
              e.currentTarget.style.backgroundColor = 'oklch(0.26 0.035 265 / 0.85)';
              e.currentTarget.style.borderColor = 'oklch(0.4 0.05 265)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'oklch(0.2 0.025 265 / 0.7)';
              e.currentTarget.style.borderColor = 'oklch(0.3 0.035 265)';
            }}
            aria-label="Next slide (Right arrow)"
            title="Next slide — →"
          >
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deck container */}
      <div ref={containerRef} className="reveal h-full w-full">
        <div className="slides overflow-hidden">
          <SlidePreview mode="present" />
        </div>
      </div>

      {/* Empty deck state */}
      {slides.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <div className="text-center">
            <div
              className="text-[13px] uppercase tracking-[0.18em] mb-2"
              style={{ color: 'oklch(0.58 0.02 265)' }}
            >
              No slides to present
            </div>
            <div
              className="font-mono text-[12px]"
              style={{ color: 'oklch(0.48 0.02 265)' }}
            >
              Press <span style={{ color: 'oklch(0.78 0.02 265)' }}>Esc</span> to return to the editor
            </div>
          </div>
        </div>
      )}

      {/* Bottom progress bar */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ zIndex: 15, height: '2px', backgroundColor: 'oklch(0.22 0.028 265)' }}
        aria-hidden="true"
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: 'oklch(0.62 0.14 265)',
            transition: reducedMotion
              ? 'none'
              : 'width 240ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          }}
        />
      </div>

      {/* Screen reader slide announcer */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        Slide {currentSlide + 1} of {total}
        {isLast && slides.length > 1 ? ', end of deck' : ''}
      </div>
    </div>
  );
};

export default PresentationViewer;
