import React, { useEffect, useRef, useState } from 'react';
import type Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import { useStore } from '../store/index';
import { useLayoutStore } from '../store/layoutStore';
import { revealConfig } from '../config/reveal';
import { createDeck } from '../utils/reveal';
import { EditorToggle } from './EditorToggle';
import { SlidePreview } from './SlidePreview';

export function Preview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Reveal.Api>();
  // Track when the Reveal deck has finished its async initialization
  const [deckInitialized, setDeckInitialized] = useState(false);
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const selectedElementId = useStore((s) => s.selectedElementId);
  const { isEditorMinimized } = useLayoutStore();

  // Listen for Reveal.js slide change events and update store
  useEffect(() => {
    if (!deckInitialized || !deckRef.current) return;

    const handler = (event: any) => {
      const newSlideIndex = event.indexh || 0;
      // Only update if different to avoid infinite loops
      if (newSlideIndex !== currentSlide) {
        setCurrentSlide(newSlideIndex);
      }
    };

    deckRef.current.on('slidechanged', handler);

    return () => {
      deckRef.current?.off('slidechanged', handler);
    };
  }, [deckInitialized, setCurrentSlide, currentSlide]);

  // Create a dependency string for all slide transitions to trigger resync
  const slidesTransitionKey = slides.map(s => `${s.id}-${s.transition || 'slide'}-${s.transitionSpeed || 'default'}`).join(',');

  useEffect(() => {
    const initDeck = async () => {
      if (!containerRef.current) return;

      if (deckRef.current) {
        deckRef.current.destroy();
      }
      setDeckInitialized(false);

      try {
        deckRef.current = await createDeck(containerRef.current, revealConfig);
        deckRef.current.sync();
        deckRef.current.layout();
        setDeckInitialized(true);
      } catch (error) {
        console.error('Error initializing deck:', error);
      }
    };

    initDeck();

    return () => {
      if (deckRef.current) {
        deckRef.current.destroy();
      }
    };
  }, [isEditorMinimized]);

  // Sync reveal.js when current slide changes or structural changes occur
  useEffect(() => {
    if (!containerRef.current || !deckRef.current) return;

    // We only need to sync and layout if the slide structure or current slide changed
    // For individual element updates inside a slide, React handles it without needing Reveal.js sync
    if (deckRef.current && containerRef.current) {
      deckRef.current.slide(currentSlide, 0);
    }
  }, [currentSlide]);

  // Handle structural changes (slide count or transitions)
  useEffect(() => {
    if (!containerRef.current || !deckRef.current) return;

    const timer = setTimeout(() => {
      if (deckRef.current && containerRef.current) {
        deckRef.current.sync();
        deckRef.current.layout();
        deckRef.current.slide(currentSlide, 0);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [slides.length, slidesTransitionKey]);



  // Handle race: if slides from DB arrive BEFORE deck finishes initializing, ensure a sync runs once deck is ready
  useEffect(() => {
    if (!deckInitialized) return;
    if (!deckRef.current) return;
    if (!containerRef.current) return;
    // Only run when we actually have slides (0 -> >0) or on deck init
    if (slides.length >= 0) {
      // Slight timeout to allow React to paint the slide <section> elements
      const t = setTimeout(() => {
        try {
          deckRef.current?.sync();
          deckRef.current?.layout();
          deckRef.current?.slide(currentSlide, 0);
          console.log('[Preview] Post-init sync performed (deckInitialized=true)');
        } catch (e) {
          console.warn('[Preview] Post-init sync error', e);
        }
      }, 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckInitialized]);



  return (
    <div className={`flex-1 relative transition-all duration-300 bg-white pt-14 overflow-hidden`}>
      <EditorToggle />
      <div ref={containerRef} className="reveal h-[calc(100%-56px)] w-full">
        <div className="slides">
          <SlidePreview />
        </div>
      </div>
    </div>
  );
}