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

// Fullscreen viewer for presenting slides (read-only)
export const PresentationViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Reveal.Api>();
  const { slides, currentSlide, setCurrentSlide, setEditingElement, setSelectedElement } = useStore();
  // Clear any edit/selection state when entering presentation mode
  useEffect(() => {
    try {
      if (typeof setEditingElement === 'function') setEditingElement(null);
      if (typeof setSelectedElement === 'function') setSelectedElement(null);
    } catch (e) {
      console.warn('[PresentationViewer] Failed to clear edit state', e);
    }
  }, [setEditingElement, setSelectedElement]);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  // Create a dependency string for all slide transitions to trigger resync
  const slidesTransitionKey = slides.map(s => `${s.id}-${s.transition || 'slide'}-${s.transitionSpeed || 'default'}`).join(',');

  // Init reveal deck in standalone mode (override embedded flag)
  useEffect(() => {
    const init = async () => {
      if (!containerRef.current) return;
      try {
        if (deckRef.current) deckRef.current.destroy();
        deckRef.current = await createDeck(containerRef.current, {
          ...revealConfig,
          embedded: false,
          controls: true,
          progress: true,
          keyboard: true,
          touch: true,
          overview: true,
          help: true
        });
        setReady(true);
        // Jump to current slide index stored in editor
        deckRef.current.slide(currentSlide, 0);
      } catch (e) {
        console.error('[PresentationViewer] init error', e);
      }
    };
    init();
    return () => { deckRef.current?.destroy(); };
  }, []);

  // Sync when slides length or transitions change
  useEffect(() => {
    if (!ready || !deckRef.current) return;
    const t = setTimeout(() => {
      deckRef.current?.sync();
      deckRef.current?.layout();
      deckRef.current?.slide(currentSlide, 0);
    }, 50);
    return () => clearTimeout(t);
  }, [slides.length, ready, currentSlide, slidesTransitionKey]);

  // Listen to deck slide change events to reflect in store (so we can exit and retain position)
  useEffect(() => {
    if (!ready || !deckRef.current) return;
    const handler = (event: any) => {
      setCurrentSlide(event.indexh || 0);
    };
    deckRef.current.on('slidechanged', handler);
    return () => { deckRef.current?.off('slidechanged', handler as any); };
  }, [ready, setCurrentSlide]);

  // Keyboard escape to exit
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      navigate(`/editor/${id}`);
    }
  }, [navigate, id]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Request fullscreen automatically if available
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {/* ignore */ });
    }
  }, []);

  const exit = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { }).finally(() => navigate(`/editor/${id}`));
    } else {
      navigate(`/editor/${id}`);
    }
  };

  const goPrev = () => { deckRef.current?.prev(); };
  const goNext = () => { deckRef.current?.next(); };

  return (
    <div className="fixed inset-0 bg-black text-white z-[1000] select-none presentation-mode">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-3">
          <button onClick={exit} className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 transition" title="Exit (Esc)">
            <XMarkIcon className="w-6 h-6" />
          </button>
          <span className="font-medium tracking-wide">Presenting</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40" disabled={currentSlide === 0}>
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="px-3 py-1 rounded bg-white/10 text-xs">{currentSlide + 1} / {slides.length}</div>
          <button onClick={goNext} className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40" disabled={currentSlide === slides.length - 1}>
            <ArrowRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      {/* Deck container */}
      <div ref={containerRef} className="reveal h-full w-full">
        <div className="slides overflow-hidden">
          <SlidePreview mode="present" />
        </div>
      </div>
    </div>
  );
};

export default PresentationViewer;