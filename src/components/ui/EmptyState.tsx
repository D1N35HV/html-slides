import React from 'react';

interface EmptyStateProps {
  onCreate?: () => void;
  onImport?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onCreate, onImport }) => (
  <div
    style={{
      paddingBlock: 'clamp(48px, 8vw, 96px)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: 'clamp(32px, 5vw, 64px)',
      alignItems: 'center',
      maxWidth: 960,
    }}
  >
    <div>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
        }}
      >
        Library is empty
      </div>
      <h2
        className="display"
        style={{
          fontSize: 28,
          lineHeight: 1.15,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          color: 'var(--ink)',
          margin: '14px 0 0',
          maxWidth: '16ch',
        }}
      >
        Drop a deck to get started.
      </h2>
      <p
        style={{
          marginTop: 16,
          fontSize: 14.5,
          color: 'var(--ink-muted)',
          lineHeight: 1.55,
          maxWidth: '42ch',
        }}
      >
        Bring in a <span className="mono">.pptx</span> and we'll parse every slide, preserve your
        fonts and shapes, and give you a canvas to tidy up. Exports to SCORM when you're ready.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 28, flexWrap: 'wrap' }}>
        {onImport && (
          <button onClick={onImport} className="lp-btn-primary" style={{ width: 'auto', paddingInline: 22 }}>
            Import a PPTX
          </button>
        )}
        {onCreate && (
          <button onClick={onCreate} className="lp-btn-secondary">
            Start blank
          </button>
        )}
      </div>

      <p className="mono" style={{ marginTop: 20, fontSize: 11.5, color: 'var(--ink-faint)' }}>
        Tip: press <span style={{ color: 'var(--ink)' }}>⌘N</span> any time to create a deck.
      </p>
    </div>

    {/* Quiet visual hint — a placeholder library of 4 card silhouettes */}
    <div aria-hidden style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            aspectRatio: '16 / 10',
            background: 'var(--paper-sunk)',
            border: '1px dashed var(--rule-strong)',
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            transform: `translateY(${i % 2 === 0 ? -4 : 4}px)`,
          }}
        >
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-ghost)', letterSpacing: '0.08em' }}>
            {String(i + 1).padStart(2, '0')} · empty
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default EmptyState;
