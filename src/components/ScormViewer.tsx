import React, { useEffect, useRef, useState } from 'react';
import type Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import { useStore } from '../store';
import { revealConfig } from '../config/reveal';
import { createDeck } from '../utils/reveal';
import { SlidePreview } from './SlidePreview';
import { scormAPI } from '../SCORM_API_Wrapper';
import { Slide } from '../store/sliceTypes';

interface ScormViewerProps {
  slides: Slide[];
}

export const ScormViewer: React.FC<ScormViewerProps> = ({ slides }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Reveal.Api>();
  const setSlides = useStore(state => state.setSlides);
  const globalSlides = useStore(state => state.slides);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Populate the global store with the injected SCORM data
    if (slides && slides.length > 0) {
      setSlides(slides);
    }
  }, [slides, setSlides]);

  useEffect(() => {
    const init = async () => {
      if (!containerRef.current || globalSlides.length === 0) return;
      try {
        if (deckRef.current) deckRef.current.destroy();
        deckRef.current = await createDeck(containerRef.current, {
          ...revealConfig,
          embedded: false,
          controls: true,
          progress: true,
          keyboard: true,
          touch: true,
        });
        setReady(true);
        
        // LMS tracking tracking initialization
        scormAPI.setStatus('incomplete');
        
        // Setup SCORM sequential tracking
        deckRef.current.on('slidechanged', (event: any) => {
          const index = event.indexh || 0;
          scormAPI.setLocation(index.toString());
          scormAPI.commit();

          // If reached the end
          if (index === globalSlides.length - 1) {
            scormAPI.setStatus('completed');
            scormAPI.commit();
          }
        });

      } catch (e) {
        console.error('[ScormViewer] init error', e);
      }
    };
    init();
    return () => { deckRef.current?.destroy(); };
  }, [globalSlides.length]);

  if (globalSlides.length === 0) {
    return <div className="flex h-screen w-screen items-center justify-center bg-zinc-900 text-white">Loading SCORM Module...</div>;
  }

  return (
    <div className="fixed inset-0 bg-black text-white z-[1000] select-none scorm-mode">
      <div ref={containerRef} className="reveal h-full w-full">
        <div className="slides overflow-hidden">
          <SlidePreview mode="present" />
        </div>
      </div>
    </div>
  );
};
