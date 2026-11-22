import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store';
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import ShareButton from './ShareButton';
import { SaveButton } from './SaveButton';
import collaborationService from '../services/CollaborationService';

export function Toolbar() {
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  const slides = useStore((s) => s.slides);
  const currentSlide = useStore((s) => s.currentSlide);
  const navigate = useNavigate();
  const location = useLocation();
  const [collaboratorCount, setCollaboratorCount] = useState(1);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const match = location.pathname.match(/editor\/(.+)$/);
  const presentationId = match ? match[1] : localStorage.getItem('currentPresentationId');
  const presentationTitle = localStorage.getItem('currentPresentationTitle') || 'Untitled Deck';
  const token = (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const handlePresent = () => {
    if (presentationId) navigate(`/present/${presentationId}`);
  };
  const handleHome = () => navigate('/');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if (((e.metaKey || e.ctrlKey) && e.key === 'y') ||
          ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canUndo, canRedo, undo, redo]);

  useEffect(() => {
    collaborationService.onPresence((data: { users: any[] }) => {
      setCollaboratorCount(data.users.length || 1);
    });
    if (presentationId && token) {
      collaborationService.connect(token);
      collaborationService.joinPresentation(presentationId);
    }
  }, [presentationId, token]);

  const commitTitle = () => {
    const next = titleDraft.trim();
    if (next && next !== presentationTitle) {
      localStorage.setItem('currentPresentationTitle', next);
      window.dispatchEvent(new Event('storage'));
    }
    setEditingTitle(false);
  };

  return (
    <div
      className="lp-root"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        height: 56,
        paddingInline: 16,
        gap: 16,
        background: 'var(--paper)',
        borderBottom: '1px solid var(--rule-hair)',
        flexShrink: 0,
      }}
    >
      {/* Left: home · undo/redo · title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={handleHome}
          aria-label="Back to library"
          className="focus-ring"
          style={iconBtn}
          title="Library"
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-sunk)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <LibraryIcon />
        </button>

        <span style={divider} aria-hidden />

        <div style={{ display: 'inline-flex', border: '1px solid var(--rule-hair)', borderRadius: 2, overflow: 'hidden' }}>
          <button
            onClick={() => canUndo && undo()}
            disabled={!canUndo}
            className="focus-ring"
            title="Undo (⌘Z)"
            aria-label="Undo"
            style={{ ...segBtn, borderRight: '1px solid var(--rule-hair)' }}
            onMouseEnter={(e) => { if (canUndo) e.currentTarget.style.background = 'var(--paper-sunk)'; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <ArrowUturnLeftIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => canRedo && redo()}
            disabled={!canRedo}
            className="focus-ring"
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
            style={segBtn}
            onMouseEnter={(e) => { if (canRedo) e.currentTarget.style.background = 'var(--paper-sunk)'; }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <ArrowUturnRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Center: deck title (inline editable) */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {editingTitle ? (
          <input
            autoFocus
            className="lp-field"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
            style={{ height: 32, maxWidth: 420, fontSize: 13.5, fontWeight: 500 }}
            aria-label="Deck title"
          />
        ) : (
          <button
            onClick={() => { setTitleDraft(presentationTitle); setEditingTitle(true); }}
            className="focus-ring"
            style={{
              background: 'transparent',
              border: 0,
              padding: '4px 10px',
              fontSize: 13.5,
              fontWeight: 500,
              color: 'var(--ink)',
              cursor: 'text',
              letterSpacing: '-0.005em',
              maxWidth: 420,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              borderRadius: 2,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--paper-sunk)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            title="Rename"
          >
            {presentationTitle}
          </button>
        )}
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>
          {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
        </span>
      </div>

      {/* Right: save · sync · share · present */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SaveButton minimal />

        <span style={divider} aria-hidden />

        <span
          className="mono"
          title={`${collaboratorCount} connected`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: collaboratorCount > 1 ? 'var(--accent-ink)' : 'var(--ink-faint)',
            letterSpacing: '0.04em',
          }}
        >
          <PresenceDot count={collaboratorCount} />
          {collaboratorCount} synced
        </span>

        {presentationId && <ShareButton presentationId={presentationId} token={token} />}

        <button
          onClick={handlePresent}
          disabled={!presentationId}
          className="focus-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            height: 32,
            paddingInline: 12,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--paper)',
            background: 'var(--accent)',
            border: 0,
            borderRadius: 2,
            cursor: presentationId ? 'pointer' : 'not-allowed',
            opacity: presentationId ? 1 : 0.5,
            letterSpacing: '-0.005em',
          }}
          title="Present (F5)"
        >
          <PlayIcon className="w-3.5 h-3.5" />
          Present
        </button>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 2,
  cursor: 'pointer',
  color: 'var(--ink-muted)',
  transition: 'background 120ms ease, color 120ms ease',
};

const segBtn: React.CSSProperties = {
  width: 34,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  color: 'var(--ink-muted)',
  transition: 'background 120ms ease, color 120ms ease',
};

const divider: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'var(--rule-hair)',
  flexShrink: 0,
};

function PresenceDot({ count }: { count: number }) {
  if (count <= 1) return <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-ghost)' }} />;
  return (
    <span aria-hidden style={{ position: 'relative', width: 6, height: 6 }}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'presence-pulse 1.8s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes presence-pulse { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.6); opacity: 0.35 } }`}</style>
    </span>
  );
}

function LibraryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 13L2 4L8 1.5L14 4L14 13L8 15.5L2 13Z" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" strokeWidth="1.25" />
      <line x1="8" y1="1.5" x2="8" y2="15.5" stroke="currentColor" strokeWidth="1.25" opacity="0.5" />
    </svg>
  );
}
