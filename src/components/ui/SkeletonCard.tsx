import React from 'react';

const SkeletonCard: React.FC = () => (
  <div
    className="lp-card"
    style={{ opacity: 0.9 }}
    aria-hidden
  >
    <div
      style={{
        aspectRatio: '16 / 10',
        background: 'var(--paper-sunk)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="sk-shimmer" />
    </div>
    <div style={{ padding: 14, display: 'grid', gap: 10 }}>
      <div style={bar(60, 12)} />
      <div style={bar(85, 10)} />
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <div style={bar(32, 14)} />
        <div style={bar(40, 14)} />
      </div>
    </div>
    <style>{`
      .sk-shimmer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          color-mix(in oklch, var(--paper) 50%, transparent) 50%,
          transparent 100%
        );
        animation: sk-slide 1600ms ease-in-out infinite;
      }
      @keyframes sk-slide {
        from { transform: translateX(-100%); }
        to   { transform: translateX(100%); }
      }
      @media (prefers-reduced-motion: reduce) {
        .sk-shimmer { animation: none; opacity: 0.4; }
      }
    `}</style>
  </div>
);

function bar(widthPct: number, height: number): React.CSSProperties {
  return {
    width: `${widthPct}%`,
    height,
    background: 'var(--paper-sunk)',
    borderRadius: 2,
  };
}

export default SkeletonCard;
