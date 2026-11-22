import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/index.ts';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.ts';
import { apiService } from '../services/ApiService.ts';

interface SaveButtonProps {
  className?: string;
  /** Compact pill for the top toolbar */
  minimal?: boolean;
}

type Status = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'needs-auth';

export function SaveButton({ className = '', minimal = false }: SaveButtonProps) {
  const slides = useStore((s) => s.slides);
  const getRemotePatch = useStore((s) => s.getRemotePatch);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [, tick] = useState(0); // drives the "x ago" relative label

  const lastSigRef = useRef<string>('');
  const autoTimer = useRef<number | null>(null);
  const inflight = useRef<Promise<any> | null>(null);

  // Re-render every 20s so the relative time stays fresh
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const computeSig = (data: any) => {
    try { return JSON.stringify(data); } catch { return Math.random().toString(36); }
  };

  const buildPayload = () => {
    const existingTitle = localStorage.getItem('currentPresentationTitle');
    return {
      title: existingTitle || `Deck ${new Date().toLocaleDateString()}`,
      description: existingTitle ? 'Updated in Slide Bolt' : 'Created in Slide Bolt',
      slides: slides.map((slide, index) => ({
        id: slide.id,
        title: `Slide ${index + 1}`,
        elements: slide.elements || [],
        backgroundColor: slide.backgroundColor || '#ffffff',
        backgroundImage: slide.backgroundImage || undefined,
        transition: (slide as any).transition || 'slide',
        transitionSpeed: (slide as any).transitionSpeed || 'default',
        thumbnailUrl: slide.thumbnailUrl || undefined,
        order: index,
      })),
      theme: 'default',
      isPublic: false,
    };
  };

  const doCreate = useCallback(async () => {
    const result = await apiService.createPresentation(buildPayload());
    if (result.data?._id) {
      localStorage.setItem('currentPresentationId', result.data._id);
    }
    return result;
  }, [slides]);

  const doUpdate = useCallback(async (id: string) => {
    const result = await apiService.updatePresentation(id, buildPayload() as any);
    if (!result.success) throw new Error(result.message || 'Update failed');
    if (result.data?.title) {
      localStorage.setItem('currentPresentationTitle', result.data.title);
    }
    return result;
  }, [slides]);

  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    if (status === 'saving') return;
    setStatus('saving');
    try {
      const id = localStorage.getItem('currentPresentationId');
      if (id) await doUpdate(id);
      else await doCreate();
      setLastSaved(new Date());
      setStatus('saved');
    } catch (err: any) {
      console.error('Save error:', err);
      setStatus('error');
      toast.error(`Save failed — ${err?.message || 'unknown error'}`);
    }
  }, [isAuthenticated, navigate, status, doCreate, doUpdate]);

  // Autosave (2s debounce)
  useEffect(() => {
    if (!isAuthenticated) { setStatus('needs-auth'); return; }
    if (getRemotePatch && getRemotePatch()) return;
    const sig = computeSig(slides);
    if (sig !== lastSigRef.current) {
      lastSigRef.current = sig;
      if (status !== 'saving') setStatus('dirty');
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
      autoTimer.current = window.setTimeout(async () => {
        if (status === 'saving' || inflight.current) return;
        setStatus('saving');
        try {
          const id = localStorage.getItem('currentPresentationId');
          inflight.current = id ? doUpdate(id) : doCreate();
          await inflight.current;
          setLastSaved(new Date());
          setStatus('saved');
        } catch (err: any) {
          console.error('Autosave error:', err);
          setStatus('error');
        } finally {
          inflight.current = null;
        }
      }, 2000);
    }
    return () => { if (autoTimer.current) window.clearTimeout(autoTimer.current); };
  }, [slides, isAuthenticated, getRemotePatch, doCreate, doUpdate, status]);

  const label = labelFor(status, lastSaved);

  if (minimal) {
    return (
      <button
        onClick={handleClick}
        disabled={status === 'saving'}
        title={label.title}
        aria-label={label.title}
        className={`focus-ring ${className}`}
        style={minimalPill(status)}
      >
        <StatusGlyph status={status} />
        <span style={{ fontSize: 11.5, letterSpacing: '0.02em' }} className="mono">
          {label.short}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'saving'}
      className={`focus-ring ${className}`}
      style={fullButton(status)}
      title={label.title}
    >
      <StatusGlyph status={status} />
      <span>{label.full}</span>
    </button>
  );
}

function labelFor(status: Status, lastSaved: Date | null) {
  switch (status) {
    case 'saving':   return { short: 'saving',    full: 'Saving…',            title: 'Saving…' };
    case 'saved':    return { short: relative(lastSaved), full: `Saved ${relative(lastSaved)}`, title: `Last saved ${lastSaved?.toLocaleTimeString() || ''}` };
    case 'dirty':    return { short: 'unsaved',  full: 'Unsaved changes',    title: 'You have unsaved changes' };
    case 'error':    return { short: 'retry',    full: 'Retry save',         title: 'The last save failed. Click to try again.' };
    case 'needs-auth': return { short: 'sign in', full: 'Sign in to save', title: 'Sign in to enable autosave and persistence' };
    case 'idle':
    default:         return { short: 'ready',    full: 'Save',               title: 'Save deck' };
  }
}

function relative(d: Date | null): string {
  if (!d) return 'now';
  const diff = Date.now() - d.getTime();
  if (diff < 5000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return d.toLocaleTimeString();
}

function minimalPill(status: Status): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    height: 28,
    paddingInline: 10,
    background: 'transparent',
    border: '1px solid var(--rule-hair)',
    borderRadius: 2,
    cursor: 'pointer',
    color: 'var(--ink-muted)',
    transition: 'border-color 120ms ease, color 120ms ease, background 120ms ease',
  };
  if (status === 'error') {
    return { ...base, color: 'oklch(0.5 0.18 27)', borderColor: 'oklch(0.58 0.18 27 / 0.5)' };
  }
  if (status === 'saving' || status === 'dirty') {
    return { ...base, color: 'var(--ink)', borderColor: 'var(--rule-strong)' };
  }
  if (status === 'needs-auth') {
    return { ...base, color: 'var(--accent-ink)', borderColor: 'color-mix(in oklch, var(--accent) 40%, var(--rule-hair))' };
  }
  return base;
}

function fullButton(status: Status): React.CSSProperties {
  // Use longhand border properties so per-status `borderColor` overrides
  // don't mix with the `border` shorthand (React warns when shorthand and
  // longhand of the same property change between renders).
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 38,
    padding: '0 14px',
    fontSize: 13.5,
    fontWeight: 500,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--rule-strong)',
    borderRadius: 2,
    cursor: 'pointer',
    background: 'var(--paper-elev)',
    color: 'var(--ink)',
    transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
    fontFamily: 'inherit',
  };
  if (status === 'error') return { ...base, borderColor: 'oklch(0.58 0.18 27 / 0.5)', color: 'oklch(0.5 0.18 27)' };
  if (status === 'dirty' || status === 'saving') return { ...base, background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--paper)' };
  return base;
}

function StatusGlyph({ status }: { status: Status }) {
  if (status === 'saving') {
    return (
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          border: '1.25px solid color-mix(in oklch, currentColor 40%, transparent)',
          borderTopColor: 'currentColor',
          borderRadius: '50%',
          animation: 'lp-spin 640ms linear infinite',
        }}
      />
    );
  }
  if (status === 'error') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <line x1="6" y1="3.5" x2="6" y2="7" stroke="currentColor" strokeWidth="1.25" />
        <rect x="5.4" y="8" width="1.2" height="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (status === 'dirty') {
    return <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />;
  }
  if (status === 'needs-auth') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="2" y="5.5" width="8" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M3.5 5.5V4a2.5 2.5 0 015 0v1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  // idle / saved
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="square" />
    </svg>
  );
}
