import React, { useCallback, useEffect, useRef, useState } from 'react';
import apiService from '../services/ApiService';
import { collaborationService } from '../services/CollaborationService';

interface ShareButtonProps { presentationId: string; token: string; }

type Status = { kind: 'info' | 'error' | 'ok'; text: string } | null;

const ShareButton: React.FC<ShareButtonProps> = ({ presentationId, token }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<'invite' | 'export' | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const connectRealtime = useCallback(() => {
    collaborationService.connect(token);
    collaborationService.joinPresentation(presentationId);
  }, [token, presentationId]);

  const shareUrl = `${window.location.origin}/presentations/${presentationId}`;

  const addCollaborator = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy('invite');
    setStatus(null);
    try {
      const res = await apiService.addCollaborator(presentationId, trimmed);
      setStatus({ kind: 'ok', text: res.message || 'Invite sent' });
      setEmail('');
      connectRealtime();
    } catch (e: any) {
      setStatus({ kind: 'error', text: e.message || 'Failed to add collaborator' });
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus({ kind: 'ok', text: 'Link copied' });
    } catch {
      setStatus({ kind: 'error', text: 'Could not copy' });
    }
  };

  const exportScorm = async () => {
    setBusy('export');
    setStatus({ kind: 'info', text: 'Packaging SCORM…' });
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/presentations/${presentationId}/export/scorm`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slide-bolt-${presentationId}.scorm.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setStatus({ kind: 'ok', text: 'Downloaded — upload to your LMS.' });
    } catch {
      setStatus({ kind: 'error', text: 'Export failed. Try again?' });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter' && document.activeElement === emailRef.current) {
        e.preventDefault();
        addCollaborator();
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, email]);

  useEffect(() => {
    if (open && emailRef.current) {
      const t = setTimeout(() => emailRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  const toggle = () => {
    if (!open) connectRealtime();
    setOpen((o) => !o);
    setStatus(null);
  };

  return (
    <div className="lp-root" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="focus-ring"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          height: 32,
          paddingInline: 12,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--ink)',
          background: 'var(--paper-elev)',
          border: '1px solid var(--rule-strong)',
          borderRadius: 2,
          cursor: 'pointer',
          letterSpacing: '-0.005em',
          fontFamily: 'inherit',
        }}
      >
        <ShareIcon />
        Share
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Share and export"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: 360,
            background: 'var(--paper-elev)',
            border: '1px solid var(--rule-strong)',
            boxShadow: 'var(--shadow-raise)',
            borderRadius: 2,
            padding: 16,
            zIndex: 60,
            display: 'grid',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              Share this deck
            </h4>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="focus-ring"
              style={closeBtnStyle}
            >
              <CloseIcon />
            </button>
          </div>

          {/* Invite collaborator */}
          <div>
            <div className="mono" style={sectionLabelStyle}>Invite collaborator</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                ref={emailRef}
                className="lp-field"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy === 'invite'}
                aria-label="Collaborator email"
                style={{ height: 36 }}
              />
              <button
                onClick={addCollaborator}
                disabled={!email.trim() || busy === 'invite'}
                className="lp-btn-primary focus-ring"
                style={{ height: 36, width: 'auto', paddingInline: 14, fontSize: 13 }}
              >
                {busy === 'invite' ? <span className="lp-spinner" aria-hidden /> : 'Invite'}
              </button>
            </div>
          </div>

          {/* Share link */}
          <div>
            <div className="mono" style={sectionLabelStyle}>Share link</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="lp-field mono"
                style={{ height: 36, fontSize: 12, background: 'var(--paper-sunk)', color: 'var(--ink-muted)' }}
                aria-label="Shareable link"
              />
              <button
                onClick={copyLink}
                className="lp-btn-secondary focus-ring"
                style={{ height: 36 }}
              >
                Copy
              </button>
            </div>
          </div>

          {/* SCORM export */}
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--rule-hair)' }}>
            <div className="mono" style={sectionLabelStyle}>Export for LMS</div>
            <button
              onClick={exportScorm}
              disabled={busy === 'export'}
              className="focus-ring"
              style={exportButtonStyle}
            >
              {busy === 'export' ? <span className="lp-spinner" aria-hidden style={{ borderTopColor: 'var(--accent-ink)' }} /> : <DownloadIcon />}
              <span style={{ fontSize: 13, fontWeight: 500 }}>Download SCORM package</span>
              <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>
                .zip
              </span>
            </button>
            <p className="mono" style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
              SCORM 1.2 + 2004 · manifest-valid · AA contrast checked
            </p>
          </div>

          {/* Status strip */}
          {status && (
            <div
              role={status.kind === 'error' ? 'alert' : 'status'}
              style={{
                fontSize: 12.5,
                padding: '8px 10px',
                border: '1px solid',
                borderColor:
                  status.kind === 'error' ? 'oklch(0.58 0.18 27 / 0.4)' :
                  status.kind === 'ok' ? 'color-mix(in oklch, var(--accent) 30%, var(--rule-hair))' :
                  'var(--rule-hair)',
                color:
                  status.kind === 'error' ? 'oklch(0.4 0.16 27)' :
                  status.kind === 'ok' ? 'var(--accent-ink)' :
                  'var(--ink-muted)',
                background:
                  status.kind === 'error' ? 'oklch(0.98 0.02 27)' :
                  status.kind === 'ok' ? 'var(--accent-wash)' :
                  'var(--paper-sunk)',
                borderRadius: 2,
              }}
            >
              {status.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ShareButton;

const closeBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  color: 'var(--ink-faint)',
  borderRadius: 2,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--ink-faint)',
  marginBottom: 8,
};

const exportButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  height: 40,
  paddingInline: 12,
  background: 'var(--accent-wash)',
  border: '1px solid color-mix(in oklch, var(--accent) 30%, var(--rule-hair))',
  color: 'var(--accent-ink)',
  borderRadius: 2,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 120ms ease',
};

function ShareIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <circle cx="3" cy="6.5" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="10" cy="3" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="10" cy="10" r="1.75" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <line x1="4.5" y1="5.75" x2="8.5" y2="3.75" stroke="currentColor" strokeWidth="1.25" />
      <line x1="4.5" y1="7.25" x2="8.5" y2="9.25" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.25" />
      <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <line x1="7" y1="1.5" x2="7" y2="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 6L7 9.5L10.5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
