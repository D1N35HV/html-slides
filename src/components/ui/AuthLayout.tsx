import React from 'react';
import { Link } from 'react-router-dom';

type AuthLayoutProps = {
  mode: 'login' | 'register';
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthLayout({ mode, title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="lp-root" style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <Navbar />
      <main className="lp-auth-grid">
        {/* Left: context pane — different content per mode */}
        <aside
          aria-hidden
          style={{
            background: 'var(--paper-sunk)',
            borderRight: '1px solid var(--rule-hair)',
            padding: 'clamp(40px, 5vw, 72px) clamp(24px, 5vw, 64px)',
            display: 'grid',
            alignContent: 'center',
          }}
        >
          <div style={{ maxWidth: 440 }}>
            {mode === 'register' ? <WhatHappensNext /> : <WorkIsWaiting />}
          </div>
        </aside>

        {/* Right: form */}
        <section
          style={{
            display: 'grid',
            alignContent: 'center',
            justifyItems: 'start',
            padding: 'clamp(40px, 6vw, 80px) clamp(24px, 5vw, 80px)',
            background: 'var(--paper)',
          }}
        >
          <div style={{ width: '100%', maxWidth: 420 }}>
            <div className="mono" style={kickerStyle}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </div>
            <h1
              className="display"
              style={{
                fontSize: 32,
                lineHeight: 1.1,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: 'var(--ink)',
                margin: '14px 0 0',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  color: 'var(--ink-muted)',
                  lineHeight: 1.5,
                  maxWidth: '42ch',
                }}
              >
                {subtitle}
              </p>
            )}

            <div style={{ marginTop: 32 }}>{children}</div>

            {footer && (
              <div
                style={{
                  marginTop: 28,
                  paddingTop: 20,
                  borderTop: '1px solid var(--rule-hair)',
                  fontSize: 13.5,
                  color: 'var(--ink-muted)',
                }}
              >
                {footer}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

const kickerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 11.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};

function Navbar() {
  return (
    <header
      style={{
        background: 'var(--paper)',
        borderBottom: '1px solid var(--rule-hair)',
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
        }}
      >
        <Link
          to="/landing"
          className="focus-ring"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--ink)' }}
        >
          <LogoMark />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Slide Bolt</span>
        </Link>
        <Link
          to="/landing"
          className="focus-ring"
          style={{ fontSize: 13.5, color: 'var(--ink-muted)', textDecoration: 'none' }}
        >
          ← Back to home
        </Link>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="2" y="5" width="14" height="10" rx="0" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="6" y="7" width="14" height="10" rx="0" fill="var(--accent)" />
      <line x1="9" y1="11" x2="17" y2="11" stroke="var(--paper)" strokeWidth="1.25" />
      <line x1="9" y1="14" x2="14" y2="14" stroke="var(--paper)" strokeWidth="1.25" opacity="0.6" />
    </svg>
  );
}

/* ─── Context panes ─────────────────────────────── */

function WhatHappensNext() {
  const steps = [
    { n: '01', label: 'Import a deck', body: 'Drop a .pptx. We keep every pixel — fonts, shapes, speaker notes.' },
    { n: '02', label: 'Refine on canvas', body: 'Edit the imports. Skip rebuilding a thing you already had.' },
    { n: '03', label: 'Ship to your LMS', body: 'One click produces a manifest-valid SCORM zip.' },
  ];
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        What happens next
      </div>
      <h2
        className="display"
        style={{
          fontSize: 26,
          lineHeight: 1.15,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          margin: '16px 0 0',
          maxWidth: '16ch',
        }}
      >
        Three steps between you and a SCORM export.
      </h2>

      <ol style={{ listStyle: 'none', padding: 0, margin: '32px 0 0' }}>
        {steps.map((s, i) => (
          <li
            key={s.n}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr',
              gap: 16,
              paddingBlock: 18,
              borderTop: i === 0 ? '1px solid var(--rule-hair)' : 'none',
              borderBottom: '1px solid var(--rule-hair)',
              alignItems: 'baseline',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--accent)',
                letterSpacing: '-0.01em',
              }}
            >
              {s.n}
            </span>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
                {s.label}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mono" style={{ marginTop: 28, fontSize: 11.5, color: 'var(--ink-faint)', lineHeight: 1.6 }}>
        SCORM 1.2 · SCORM 2004 · xAPI ready · WCAG 2.1 AA
      </div>
    </div>
  );
}

function WorkIsWaiting() {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        Welcome back
      </div>
      <h2
        className="display"
        style={{
          fontSize: 26,
          lineHeight: 1.15,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          margin: '16px 0 0',
          maxWidth: '14ch',
        }}
      >
        Your decks are where you left them.
      </h2>
      <p
        style={{
          marginTop: 16,
          fontSize: 14.5,
          color: 'var(--ink-muted)',
          lineHeight: 1.55,
          maxWidth: '36ch',
        }}
      >
        Autosaved. Unbroken. Ready to pick up mid-slide — even the undo history survives.
      </p>

      <div
        style={{
          marginTop: 36,
          background: 'var(--paper-elev)',
          border: '1px solid var(--rule-hair)',
          boxShadow: 'var(--shadow-raise)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          className="mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 34,
            paddingInline: 14,
            borderBottom: '1px solid var(--rule-hair)',
            background: 'var(--paper-sunk)',
            fontSize: 11,
            color: 'var(--ink-faint)',
            letterSpacing: '0.06em',
          }}
        >
          <span style={{ textTransform: 'uppercase' }}>recent</span>
          <span>last opened</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {[
            ['Q2 Compliance Training', '42 slides', '2h ago'],
            ['New Hire Onboarding — 2026', '28 slides', 'yesterday'],
            ['Data Handling Refresher', '12 slides', '3d ago'],
          ].map(([name, size, when], i) => (
            <li
              key={name}
              style={{
                display: 'grid',
                gridTemplateColumns: '18px 1fr auto auto',
                alignItems: 'center',
                gap: 12,
                paddingInline: 14,
                paddingBlock: 11,
                borderTop: i === 0 ? 'none' : '1px solid var(--rule-hair)',
                fontSize: 13,
              }}
            >
              <DeckIcon />
              <span style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>{size}</span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-ghost)' }}>{when}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DeckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1.5" y="3.5" width="11" height="7" fill="none" stroke="var(--ink-faint)" strokeWidth="1" />
      <line x1="4" y1="6" x2="10" y2="6" stroke="var(--ink-faint)" strokeWidth="1" />
      <line x1="4" y1="8" x2="8" y2="8" stroke="var(--ink-faint)" strokeWidth="1" opacity="0.6" />
    </svg>
  );
}

/* ─── Shared auth UI helpers ─────────────────────── */

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '12px 14px',
        marginBottom: 20,
        border: '1px solid oklch(0.58 0.18 27 / 0.4)',
        background: 'oklch(0.98 0.02 27)',
        borderRadius: 2,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }}>
        <circle cx="7" cy="7" r="6" fill="none" stroke="oklch(0.55 0.18 27)" strokeWidth="1.25" />
        <line x1="7" y1="4" x2="7" y2="8" stroke="oklch(0.55 0.18 27)" strokeWidth="1.5" />
        <rect x="6.4" y="9.2" width="1.2" height="1.2" fill="oklch(0.55 0.18 27)" />
      </svg>
      <span style={{ fontSize: 13.5, color: 'oklch(0.35 0.15 27)', lineHeight: 1.5 }}>{message}</span>
    </div>
  );
}

export function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <rect x="2" y="5" width="7" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M3.5 5V3.5a2 2 0 014 0V5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function EyeIcon({ open }: { open: boolean }) {
  if (!open) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity="0.5"
      />
      <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
