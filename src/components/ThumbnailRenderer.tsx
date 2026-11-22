import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';
import { useStore } from '../store';
import { revealConfig } from '../config/reveal';
import { createDeck } from '../utils/reveal';
import { SlidePreview } from './SlidePreview';
import apiService from '../services/ApiService';

/**
 * ThumbnailRenderer - A minimal component for server-side thumbnail generation
 * 
 * This component renders a single slide at full size (1024x768) without any
 * editor UI, toolbar, or other chrome. It's designed to be used with Puppeteer
 * to generate high-fidelity slide thumbnails.
 * 
 * Usage: /thumbnail/:presentationId/:slideIndex
 * 
 * The component sets a `data-thumbnail-ready` attribute when fully rendered,
 * which Puppeteer can wait for before taking a screenshot.
 */
export const ThumbnailRenderer: React.FC = () => {
    const { presentationId, slideIndex: slideIndexParam } = useParams<{ presentationId: string; slideIndex: string }>();
    const slideIndex = parseInt(slideIndexParam || '0', 10);

    const containerRef = useRef<HTMLDivElement>(null);
    const deckRef = useRef<Reveal.Api>();
    const slides = useStore((s) => s.slides);
    const setSlides = useStore((s) => s.setSlides);
    const setCurrentSlide = useStore((s) => s.setCurrentSlide);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load presentation data from API
    useEffect(() => {
        if (!presentationId) {
            setError('No presentation ID provided');
            return;
        }

        const loadPresentation = async () => {
            try {
                const response = await apiService.getPresentation(presentationId);
                if (response.data?.slides) {
                    // Transform API slides to store format
                    const transformedSlides = response.data.slides.map((slide: any) => ({
                        id: slide.id,
                        elements: slide.elements || [],
                        backgroundColor: slide.backgroundColor || '#ffffff',
                        backgroundImage: slide.backgroundImage,
                        transition: slide.transition || 'slide',
                        transitionSpeed: slide.transitionSpeed || 'default'
                    }));
                    setSlides(transformedSlides);
                    setCurrentSlide(Math.min(slideIndex, transformedSlides.length - 1));
                }
            } catch (err) {
                console.error('[ThumbnailRenderer] Failed to load presentation:', err);
                setError('Failed to load presentation');
            }
        };

        loadPresentation();
    }, [presentationId, slideIndex, setSlides, setCurrentSlide]);

    // Initialize Reveal.js deck
    useEffect(() => {
        if (slides.length === 0) return;

        const init = async () => {
            if (!containerRef.current) return;

            try {
                if (deckRef.current) {
                    deckRef.current.destroy();
                }

                deckRef.current = await createDeck(containerRef.current, {
                    ...revealConfig,
                    embedded: true,
                    controls: false,
                    progress: false,
                    keyboard: false,
                    touch: false,
                    overview: false,
                    help: false,
                    transition: 'none', // No transitions for thumbnails
                    backgroundTransition: 'none',
                    center: true,
                    hash: false,
                    history: false
                });

                // Navigate to the specific slide
                deckRef.current.slide(slideIndex, 0);

                // Wait a bit for everything to render, then mark as ready
                setTimeout(() => {
                    setIsReady(true);
                }, 500);
            } catch (e) {
                console.error('[ThumbnailRenderer] init error', e);
                setError('Failed to initialize presentation');
            }
        };

        init();

        return () => {
            deckRef.current?.destroy();
        };
    }, [slides.length, slideIndex]);

    if (error) {
        return (
            <div
                data-thumbnail-ready="false"
                data-thumbnail-error={error}
                style={{
                    width: 1024,
                    height: 768,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f0f0f0',
                    color: '#666'
                }}
            >
                {error}
            </div>
        );
    }

    return (
        <div
            id="thumbnail-container"
            data-thumbnail-ready={isReady ? 'true' : 'false'}
            data-presentation-id={presentationId}
            data-slide-index={slideIndex}
            style={{
                width: 1024,
                height: 768,
                margin: 0,
                padding: 0,
                overflow: 'hidden',
                backgroundColor: '#ffffff'
            }}
        >
            <div
                ref={containerRef}
                className="reveal"
                style={{
                    width: '100%',
                    height: '100%'
                }}
            >
                <div className="slides" style={{ overflow: 'hidden' }}>
                    <SlidePreview mode="present" />
                </div>
            </div>
        </div>
    );
};

export default ThumbnailRenderer;
