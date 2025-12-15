import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Toolbar } from './Toolbar';
import { ElementsSidebar } from './ElementsSidebar';
import { Preview } from './Preview';
import { SlideStrip } from './SlideStrip';
import { Toaster, toast } from 'react-hot-toast';
import apiService from '../services/ApiService';
import { useStore } from '../store/index.ts';

interface ApiPresentationResponse {
  _id?: string;
  id?: string;
  title?: string;
  slides?: Array<{ id: string; elements?: any[]; order?: number; title?: string }>;
}

export const EditorPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { slides, currentSlide, setCurrentSlide, addSlide, setSlides, clearHistory } = useStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          .sort((a: any,b: any) => (a?.order||0) - (b?.order||0))
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
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-gray-600">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        <p>Loading presentation...</p>
        <button onClick={() => navigate('/')} className="text-sm text-indigo-600 hover:underline">Back to dashboard</button>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-red-600">
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="text-sm text-indigo-600 hover:underline">Back to dashboard</button>
        <Toaster position="bottom-right" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <ElementsSidebar />
        <div className="flex-1 flex flex-col w-3/4">
          <Preview />
          {/* New Slide Strip Component */}
          <SlideStrip className="h-24" />
        </div>
      </div>
      <Toaster position="bottom-right" />
    </div>
  );
};

export default EditorPage;