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
  const { slides, currentSlide, setCurrentSlide, selectedElementId } = useStore();
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

  // Sync reveal.js when slides change (after initial load or user edits)
  useEffect(() => {
    if (!containerRef.current || !deckRef.current) return;

    //updateSlides(containerRef.current, slides);
    // Add a small delay to ensure DOM is updated when new slides are added
    const timer = setTimeout(() => {
      if (deckRef.current && containerRef.current) {
        deckRef.current.sync();
        deckRef.current.layout();
        // Navigate to the current slide
        deckRef.current.slide(currentSlide, 0);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [slides, currentSlide, slidesTransitionKey]);

  // Additional sync specifically for when slide count changes (new slide added)
  useEffect(() => {
    if (!containerRef.current || !deckRef.current) return;

    const timer = setTimeout(() => {
      if (deckRef.current && containerRef.current) {
        console.log('Syncing reveal.js after slide count change:', slides.length);
        deckRef.current.sync();
        deckRef.current.layout();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [slides.length]);

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

  // If slides arrive (length changes) AFTER deck is initialized but initial slides effect missed (e.g. deck wasn't ready during first slides update), force a sync
  useEffect(() => {
    if (!deckInitialized) return;
    if (!deckRef.current) return;
    if (!containerRef.current) return;
    const t = setTimeout(() => {
      deckRef.current?.sync();
      deckRef.current?.layout();
    }, 50);
    return () => clearTimeout(t);
  }, [slides.length, deckInitialized]);

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