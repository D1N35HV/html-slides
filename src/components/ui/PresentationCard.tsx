import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/ApiService';
import { resolveMediaUrl } from '../../lib/utils';

export interface PresentationSummary {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  isPublic: boolean;
  slideCount?: number;
  thumbnailUrl?: string;
  updatedAt?: string;
  createdAt?: string;
  createdBy?: { name: string; email: string };
  /** Optional SCORM-related metadata if surfaced by the API. */
  scormExportedAt?: string;
  scormPackageSize?: number;
}

interface Props {
  data: PresentationSummary;
  onDeleted(id: string): void;
  onDuplicated?(originalId: string, newItem: PresentationSummary): void;
}

const PresentationCard: React.FC<Props> = ({ data, onDeleted, onDuplicated }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<'dup' | 'del' | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleDuplicate = async () => {
    try {
      setBusy('dup');
      const res = await apiService.duplicatePresentation(data._id);
      if (res.success && res.data) {
        onDuplicated?.(data._id, res.data as any);
      }
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${data.title || 'Untitled'}"? This can't be undone.`)) return;
    try {
      setBusy('del');
      const res = await apiService.deletePresentation(data._id);
      if (res.success) onDeleted(data._id);
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  };

  const title = data.title || 'Untitled';
  const slideCount = data.slideCount ?? 0;
  const updated = relativeTime(data.updatedAt || data.createdAt);
  const exportLabel = buildExportLabel(data);

  return (
    <article className="lp-card" style={{ position: 'relative' }}>
      {/* Thumbnail / open action */}
      <button
        onClick={() => navigate(`/editor/${data._id}`)}
        className="focus-ring"
        aria-label={`Open ${title}`}
        style={{
          position: 'relative',
          aspectRatio: '16 / 10',
          width: '100%',
          background: 'var(--paper-sunk)',
          border: 0,
          borderBottom: '1px solid var(--rule-hair)',
          padding: 0,
          cursor: 'pointer',
          display: 'block',
          overflow: 'hidden',
        }}
      >
        {data.thumbnailUrl ? (
          <img
            src={resolveMediaUrl(data.thumbnailUrl)}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
          />
        ) : (
          <ThumbnailFallback title={title} slideCount={slideCount} />
        )}
        {/* slide count pill — bottom-left, mono */}
        <span
          className="mono"
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            padding: '3px 8px',
            background: 'color-mix(in oklch, var(--paper) 88%, transparent)',
            border: '1px solid var(--rule-hair)',
            fontSize: 10.5,
            letterSpacing: '0.04em',
            color: 'var(--ink-muted)',
            borderRadius: 2,
          }}
        >
          {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
        </span>
      </button>

      {/* Meta block */}
      <div style={{ padding: '14px 16px 16px', display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
          <h3
            style={{
              margin: 0,
              fontSize: 14.5,
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {title}
          </h3>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="focus-ring"
              style={{
                width: 28,
                height: 28,
                display: 'grid',
                placeItems: 'center',
                background: 'transparent',
                border: 0,
                color: 'var(--ink-faint)',
                cursor: 'pointer',
                borderRadius: 2,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-faint)')}
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <div role="menu" className="lp-menu-surface" style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 10 }}>
                <button
                  role="menuitem"
                  className="lp-menu-item"
                  onClick={handleDuplicate}
                  disabled={busy === 'dup'}
                >
                  {busy === 'dup' ? <Spinner /> : <DuplicateIcon />}
                  Duplicate
                </button>
                <button
                  role="menuitem"
                  className="lp-menu-item destructive"
                  onClick={handleDelete}
                  disabled={busy === 'del'}
                >
                  {busy === 'del' ? <Spinner /> : <TrashIcon />}
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tags + visibility */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {(data.tags || []).slice(0, 2).map((t) => (
            <span
              key={t}
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: '0.04em',
                color: 'var(--ink-muted)',
                border: '1px solid var(--rule-hair)',
                padding: '2px 7px',
                borderRadius: 2,
              }}
            >
              {t}
            </span>
          ))}
          {(data.tags?.length ?? 0) > 2 && (
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-ghost)' }}>
              +{(data.tags!.length) - 2}
            </span>
          )}
          <span
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              color: data.isPublic ? 'var(--accent-ink)' : 'var(--ink-faint)',
            }}
            aria-label={data.isPublic ? 'Public' : 'Private'}
          >
            {data.isPublic ? <GlobeIcon /> : <LockIcon />}
            {data.isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        {/* Status row: updated + SCORM export state */}
        <div
          className="mono"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 11,
            color: 'var(--ink-faint)',
            paddingTop: 8,
            borderTop: '1px solid var(--rule-hair)',
            letterSpacing: '0.02em',
          }}
        >
          <span>edited {updated}</span>
          <span style={{ color: exportLabel.color }}>{exportLabel.text}</span>
        </div>
      </div>
    </article>
  );
};

export default PresentationCard;

function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildExportLabel(data: PresentationSummary): { text: string; color: string } {
  if (data.scormExportedAt) {
    const size = data.scormPackageSize ? ` · ${formatBytes(data.scormPackageSize)}` : '';
    return { text: `SCORM ${relativeTime(data.scormExportedAt)}${size}`, color: 'var(--accent-ink)' };
  }
  return { text: 'not exported', color: 'var(--ink-ghost)' };
}

function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)} KB`;
  return `${n} B`;
}

/* Deterministic, quiet thumbnail fallback — paper + a single slide silhouette.
   No gradients, no colored blobs. Uses the deck title as a small ghost label. */
function ThumbnailFallback({ title, slideCount }: { title: string; slideCount: number }) {
  const initial = (title.trim()[0] || '·').toUpperCase();
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper-sunk)' }}>
      <div
        style={{
          width: '58%',
          aspectRatio: '16 / 10',
          background: 'var(--paper-elev)',
          border: '1px solid var(--rule-hair)',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
          padding: 10,
          gap: 8,
        }}
      >
        <div className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-ghost)' }}>
          {slideCount > 0 ? `deck · ${slideCount}` : 'new deck'}
        </div>
        <div style={{ display: 'grid', placeItems: 'start', alignContent: 'end' }}>
          <span
            className="display"
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: 'var(--ink-ghost)',
              letterSpacing: '-0.03em',
              lineHeight: 0.9,
            }}
          >
            {initial}
          </span>
        </div>
      </div>
    </div>
  );
}

/* Icons */
function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="3.5" r="1.25" fill="currentColor" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
      <circle cx="8" cy="12.5" r="1.25" fill="currentColor" />
    </svg>
  );
}
function DuplicateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.5" y="3.5" width="8" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="4.5" y="1.5" width="8" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 3.5h9M5 3.5V2h4v1.5M4 3.5v8.5a1 1 0 001 1h4a1 1 0 001-1V3.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M1 6h10M6 1a7 7 0 010 10M6 1a7 7 0 000 10" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect x="2" y="5.5" width="8" height="5.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3.5 5.5V4a2.5 2.5 0 015 0v1.5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 12,
        height: 12,
        border: '1.25px solid var(--rule-strong)',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        animation: 'lp-spin 640ms linear infinite',
      }}
    />
  );
}
