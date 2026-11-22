import React from 'react';

const FinalCTA: React.FC = () => {
  return (
    <section
      style={{
        paddingBlock: 'clamp(80px, 9vw, 144px)',
        borderTop: '1px solid var(--rule-hair)',
        background: 'var(--paper)',
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)',
          gap: 'clamp(32px, 4vw, 64px)',
          alignItems: 'end',
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
            Ready when you are
          </div>
          <h2
            className="display"
            style={{
              fontSize: 'var(--step-3)',
              lineHeight: 'var(--lh-snug)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              margin: '16px 0 0',
              maxWidth: '20ch',
            }}
          >
            Import your first deck in the next ten minutes.
          </h2>
          <p
            style={{
              marginTop: 20,
              fontSize: 'var(--step-1)',
              lineHeight: 1.55,
              color: 'var(--ink-muted)',
              maxWidth: '52ch',
            }}
          >
            Free to try on one deck. No credit card. If the import doesn't hold up, you close the tab
            and you're no worse off than before.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
            <a href="/register" className="focus-ring" style={primaryCta}>
              Start free trial
            </a>
            <a href="/login" className="focus-ring" style={secondaryCta}>
              I already have an account
            </a>
          </div>
        </div>

        {/* Quiet metadata panel — no gradient aura, no glow card */}
        <aside
          aria-label="Trial details"
          style={{
            borderTop: '1px solid var(--rule-strong)',
            paddingTop: 20,
          }}
        >
          <dl style={{ display: 'grid', gap: 16, margin: 0 }}>
            {[
              ['Free tier', '1 deck imported, 1 SCORM export, full editor'],
              ['Then', '$24 / month per author for unlimited decks'],
              ['Setup', 'No install. No LMS integration required.'],
              ['Cancel', 'Anytime from the dashboard.'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 16, alignItems: 'baseline' }}>
                <dt className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                  {k}
                </dt>
                <dd style={{ margin: 0, fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
};

export default FinalCTA;

const primaryCta: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 46,
  padding: '0 22px',
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--paper)',
  background: 'var(--accent)',
  textDecoration: 'none',
  borderRadius: 2,
  transition: 'background 160ms ease',
};

const secondaryCta: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 46,
  padding: '0 20px',
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--ink)',
  background: 'transparent',
  border: '1px solid var(--rule-strong)',
  textDecoration: 'none',
  borderRadius: 2,
};
