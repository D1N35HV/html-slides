import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { ElementsSidebar } from './ElementsSidebar';
import { Preview } from './Preview';
import { SlideStrip } from './SlideStrip';
import { Toaster, toast } from 'react-hot-toast';
import apiService from '../services/ApiService';
import { useStore } from '../store/index';
import collaborationService from '../services/CollaborationService';

interface ApiPresentationResponse {
  _id?: string;
  id?: string;
  title?: string;
  slides?: Array<{ id: string; elements?: any[]; order?: number; title?: string }>;
}

export const EditorPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const setCurrentSlide = useStore((s) => s.setCurrentSlide);
  const addSlide = useStore((s) => s.addSlide);
  const setSlides = useStore((s) => s.setSlides);
  const clearHistory = useStore((s) => s.clearHistory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cleanup = collaborationService.onPPTProgress((event) => {
      if (event.type === 'slide' && event.slide && event.presentationId === id) {
        const storeState = useStore.getState();
        const currentSlides = storeState.slides;
        const exists = currentSlides.some(s => s.id === event.slide!.id);
        
        if (!exists) {
          console.log('[EditorPage] Auto-loading incoming slide:', event.slide.id);
          storeState.setSlides([...currentSlides, event.slide], storeState.currentSlide);
        }
      }
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) { setError('Missing id'); setLoading(false); return; }
      try {
        setLoading(true);
        setError(null);
        const res = await apiService.getPresentation(id);
        if (!res.success || !res.data) throw new Error(res.message || 'Failed to load');
        const data = res.data as unknown as ApiPresentationResponse & { slides?: any };

        if (cancelled) return;

        let incomingSlides: any = data.slides;
        // 1. If slides is a JSON string, parse it
        if (typeof incomingSlides === 'string') {
          try {
            incomingSlides = JSON.parse(incomingSlides);
            console.log('[EditorPage] Parsed slides JSON string ->', incomingSlides);
          } catch (parseErr) {
            console.warn('[EditorPage] Failed to parse slides JSON string', parseErr);
            incomingSlides = [];
          }
        }
        // 2. If slides is an object map (e.g. {"slideId": {..}}) convert to array
        if (incomingSlides && !Array.isArray(incomingSlides) && typeof incomingSlides === 'object') {
          // Heuristic: treat object values as slides
          const values = Object.values(incomingSlides);
          if (values.every(v => typeof v === 'object')) {
            incomingSlides = values;
            console.log('[EditorPage] Converted slides object map to array');
          }
        }

        const rawSlides: any[] = Array.isArray(incomingSlides) ? incomingSlides : [];

        const normalized = rawSlides
          .filter(s => !!s) // remove nulls
          .sort((a: any, b: any) => (a?.order || 0) - (b?.order || 0))
          .map((s: any, slideIndex: number) => {
            let slideElements: any = s.elements;
            // Allow elements to be a JSON string
            if (typeof slideElements === 'string') {
              try {
                slideElements = JSON.parse(slideElements);
              } catch (e) {
                console.warn('[EditorPage] Failed to parse elements JSON string', e);
                slideElements = [];
              }
            }
            if (slideElements && !Array.isArray(slideElements) && typeof slideElements === 'object') {
              slideElements = Object.values(slideElements);
            }
            const elements = (Array.isArray(slideElements) ? slideElements : [])
              .filter(el => !!el)
              .map((el: any, elIndex: number) => {
                const base = {
                  id: el.id || el._id || `el-${slideIndex}-${elIndex}`,
                  type: el.type || el.elementType || 'text',
                  position: (el.position && typeof el.position.x === 'number' && typeof el.position.y === 'number')
                    ? el.position
                    : { x: 50 + (elIndex * 30), y: 50 + (elIndex * 30) },
                  size: (el.size && typeof el.size.width === 'number' && typeof el.size.height === 'number')
                    ? el.size
                    : { width: 400, height: 200 },
                  zIndex: typeof el.zIndex === 'number' ? el.zIndex : 1,
                  rotation: typeof el.rotation === 'number' ? el.rotation : 0
                } as any;
                // Type-specific props
                if (base.type === 'text' || base.type === 'heading') {
                  base.content = el.content || el.html || '';
                  if (base.type === 'heading') base.level = el.level || 1;
                }
                if (base.type === 'image') {
                  base.imageUrl = el.imageUrl || el.url || el.src || '';
                  base.opacity = el.opacity;
                  base.objectFit = el.objectFit;
                  base.flipX = el.flipX;
                  base.flipY = el.flipY;
                  // Crop properties
                  base.cropX = el.cropX;
                  base.cropY = el.cropY;
                  base.cropWidth = el.cropWidth;
                  base.cropHeight = el.cropHeight;
                  base.originalWidth = el.originalWidth;
                  base.originalHeight = el.originalHeight;
                }
                if (base.type === 'video') {
                  base.videoUrl = el.videoUrl || el.url || '';
                }
                if (base.type === 'shape') {
                  base.shapeType = el.shapeType || 'rectangle';
                  base.fillColor = el.fillColor;
                  base.borderColor = el.borderColor;
                  base.borderWidth = el.borderWidth;
                  base.cornerRadius = el.cornerRadius;
                }
                return base;
              });
            return {
              id: s.id || s._id || `slide-${slideIndex}`,
              elements,
              backgroundColor: s.backgroundColor || undefined,
              backgroundImage: s.backgroundImage || undefined,
              thumbnailUrl: s.thumbnailUrl || undefined,
              transition: s.transition || undefined,
              transitionSpeed: s.transitionSpeed || undefined
            };
          });

        const safeSlides = normalized.length > 0 ? normalized : [{ id: `slide-${Date.now()}`, elements: [] }];
        console.log('[EditorPage] Hydrating store with slides:', safeSlides);

        // Clear history first to avoid any issues with previous state
        clearHistory();

        // Use the proper setSlides action instead of direct state manipulation
        setSlides(safeSlides, 0);

        // Persist for Save/Update flows
        const pid = (data as any)._id || (data as any).id || id;
        localStorage.setItem('currentPresentationId', pid);
        if ((data as any).title) localStorage.setItem('currentPresentationTitle', (data as any).title);
      } catch (e: any) {
        const msg = e.message || 'Error loading presentation';
        if (!cancelled) {
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="lp-root" style={editorStatusStyle}>
        <div style={{ display: 'grid', gap: 18, placeItems: 'center', maxWidth: 320 }}>
          <div
            aria-hidden
            style={{
              width: 24,
              height: 24,
              border: '1.5px solid var(--rule-strong)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'lp-spin 640ms linear infinite',
            }}
          />
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            opening deck
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            Hydrating slides and reconnecting to the session…
          </p>
          <button
            onClick={() => navigate('/')}
            className="lp-btn-ghost focus-ring"
            style={{ marginTop: 4 }}
          >
            ← Back to library
          </button>
        </div>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="lp-root" style={editorStatusStyle}>
        <div style={{ display: 'grid', gap: 14, maxWidth: 440, textAlign: 'left' }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'oklch(0.55 0.18 27)' }}>
            couldn't open this deck
          </div>
          <h2 className="display" style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Something went wrong on load.
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={() => window.location.reload()} className="lp-btn-primary focus-ring" style={{ width: 'auto', paddingInline: 18 }}>
              Try again
            </button>
            <button onClick={() => navigate('/')} className="lp-btn-secondary focus-ring">
              Back to library
            </button>
          </div>
        </div>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#fbfbf9', overflow: 'hidden' }}>
      <Toolbar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <ElementsSidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Preview />
          <SlideStrip />
        </div>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
};

const editorStatusStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: 32,
  background: 'var(--paper)',
};

export default EditorPage;