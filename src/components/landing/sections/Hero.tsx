import React from 'react';

const Hero: React.FC = () => {
  return (
    <section style={{ paddingBlock: 'clamp(72px, 8vw, 128px) clamp(48px, 6vw, 96px)', position: 'relative' }}>
      <div
        className="mx-auto lp-hero-grid"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
        }}
      >
        {/* Copy block */}
        <div style={{ maxWidth: '42ch' }}>
          <div className="rise mono" style={kickerStyle}>
            <span style={{ width: 6, height: 6, background: 'var(--accent)', display: 'inline-block' }} />
            SCORM authoring for teams with an archive
          </div>

          <h1
            className="rise rise-d1 display"
            style={{
              fontSize: 'var(--step-4)',
              lineHeight: 'var(--lh-tight)',
              fontWeight: 600,
              marginTop: 24,
              marginBottom: 0,
              color: 'var(--ink)',
              maxWidth: '18ch',
            }}
          >
            Ship your PowerPoints as SCORM.
            <span style={{ color: 'var(--ink-faint)' }}> Without learning a new tool.</span>
          </h1>

          <p
            className="rise rise-d2"
            style={{
              fontSize: 'var(--step-1)',
              lineHeight: 1.55,
              color: 'var(--ink-muted)',
              marginTop: 24,
              maxWidth: '46ch',
            }}
          >
            Import your existing decks. Refine what matters. Export packages your LMS will actually
            accept — without rebuilding a single slide in Articulate or iSpring.
          </p>

          <div className="rise rise-d3" style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
            <a href="/register" className="focus-ring" style={primaryCta}>
              Start free trial
            </a>
            <a href="/login" className="focus-ring" style={secondaryCta}>
              Import a deck
              <span aria-hidden style={{ marginLeft: 6, transition: 'transform 160ms ease', display: 'inline-block' }}>→</span>
            </a>
          </div>

          <ul
            className="rise rise-d4 mono"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px 20px',
              marginTop: 36,
              padding: 0,
              listStyle: 'none',
              fontSize: 12.5,
              color: 'var(--ink-faint)',
            }}
          >
            <li>SCORM 1.2</li>
            <SepDot />
            <li>SCORM 2004</li>
            <SepDot />
            <li>xAPI ready</li>
            <SepDot />
            <li>WCAG 2.1 AA</li>
          </ul>
        </div>

        {/* Visual anchor: a stylized editor surface. Not a 3D scene. */}
        <figure
          className="rise rise-d5"
          style={{
            margin: 0,
            position: 'relative',
            maxWidth: 'min(100%, 960px)',
            justifySelf: 'start',
            width: '100%',
          }}
          aria-label="Slide Bolt editor with an imported PowerPoint deck, ready to export as SCORM"
        >
          <EditorMock />
          <figcaption
            className="mono"
            style={{
              marginTop: 14,
              fontSize: 11,
              letterSpacing: '0.1em',
              color: 'var(--ink-faint)',
              textTransform: 'uppercase',
            }}
          >
            Imported .pptx · edited in-place · one click to export
          </figcaption>
        </figure>
      </div>
    </section>
  );
};

export default Hero;

const kickerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 11.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};

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
  transition: 'background 160ms ease, transform 160ms ease',
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
  transition: 'border-color 160ms ease, color 160ms ease',
};

function SepDot() {
  return <span aria-hidden style={{ width: 2, height: 2, background: 'var(--ink-ghost)', borderRadius: '50%' }} />;
}

function EditorMock() {
  const slides = [
    { n: '01', label: 'Cover', active: false },
    { n: '02', label: 'Learning objectives', active: true },
    { n: '03', label: 'Why compliance matters', active: false },
    { n: '04', label: 'Case study — phishing', active: false },
    { n: '05', label: 'Policy walkthrough', active: false },
    { n: '06', label: 'Knowledge check', active: false },
    { n: '07', label: 'Summary', active: false },
  ];

  return (
    <div
      style={{
        background: 'var(--paper-elev)',
        border: '1px solid var(--rule-hair)',
        boxShadow: 'var(--shadow-raise)',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 18,
          height: 42,
          borderBottom: '1px solid var(--rule-hair)',
          background: 'var(--paper-sunk)',
        }}
      >
        <div className="mono" style={{ fontSize: 12, color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileIcon />
          quarterly-compliance-2026.pptx
          <span style={{ color: 'var(--ink-ghost)' }}>·</span>
          <span style={{ color: 'var(--ink-faint)' }}>42 slides</span>
          <span style={{ color: 'var(--ink-ghost)' }}>·</span>
          <span style={{ color: 'var(--ink-faint)' }}>18 MB</span>
        </div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
          autosaved 2s ago
        </div>
      </div>

      {/* Body: strip + canvas */}
      <div style={{ display: 'grid', gridTemplateColumns: '188px 1fr', minHeight: 360 }}>
        {/* Slide strip */}
        <div
          style={{
            borderRight: '1px solid var(--rule-hair)',
            background: 'var(--paper-sunk)',
            padding: 12,
            display: 'grid',
            gap: 8,
            alignContent: 'start',
          }}
          aria-label="Slide list"
        >
          {slides.map((s) => (
            <div
              key={s.n}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                background: s.active ? 'var(--paper-elev)' : 'transparent',
                border: s.active ? '1px solid var(--rule-strong)' : '1px solid transparent',
                borderRadius: 2,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: s.active ? 'var(--accent)' : 'var(--ink-faint)',
                  letterSpacing: '0.08em',
                  fontWeight: s.active ? 700 : 400,
                }}
              >
                {s.n}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: s.active ? 'var(--ink)' : 'var(--ink-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: s.active ? 600 : 400,
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-ghost)', textAlign: 'center', marginTop: 6 }}>
            + 35 more
          </div>
        </div>

        {/* Canvas */}
        <div style={{ padding: 32, display: 'grid', placeItems: 'center', background: 'var(--paper-elev)' }}>
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              aspectRatio: '16 / 9',
              background: 'var(--paper)',
              border: '1px solid var(--rule-hair)',
              padding: '32px 40px',
              display: 'grid',
              gridTemplateRows: 'auto auto 1fr',
              gap: 12,
              position: 'relative',
              borderRadius: 2,
            }}
          >
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-ghost)' }}>
              Module 02 · Learning objectives
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
              By the end of this module, learners will be able to&hellip;
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, alignContent: 'start' }}>
              {[
                'Identify a phishing attempt in under 30 seconds.',
                'Correctly classify three categories of sensitive data.',
                'Report an incident via the internal security channel.',
              ].map((item, i) => (
                <li key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10, alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>{item}</span>
                </li>
              ))}
            </ul>

            {/* Selection handles hint — the "editable" affordance */}
            <span aria-hidden style={handle(-4, -4)} />
            <span aria-hidden style={handle(-4, 'auto', -4)} />
            <span aria-hidden style={handle('auto', -4, -4)} />
            <span aria-hidden style={handle('auto', -4, 'auto', -4)} />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          paddingInline: 18,
          height: 38,
          borderTop: '1px solid var(--rule-hair)',
          fontSize: 11.5,
          color: 'var(--ink-faint)',
          background: 'var(--paper-sunk)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Check />
          <span style={{ color: 'var(--accent)' }}>SCORM 1.2 valid</span>
        </span>
        <span style={{ color: 'var(--ink-ghost)' }}>·</span>
        <span>Manifest OK</span>
        <span style={{ color: 'var(--ink-ghost)' }}>·</span>
        <span>47 MB package</span>
        <span style={{ color: 'var(--ink-ghost)' }}>·</span>
        <span>AA contrast: 41 / 42 slides</span>
        <span style={{ marginLeft: 'auto', color: 'var(--ink)' }}>⌘E export</span>
      </div>
    </div>
  );
}

function handle(top?: number | 'auto', right?: number | 'auto', bottom?: number | 'auto', left?: number | 'auto'): React.CSSProperties {
  return {
    position: 'absolute',
    width: 8,
    height: 8,
    background: 'var(--paper)',
    border: '1px solid var(--accent)',
    top: top as any,
    right: right as any,
    bottom: bottom as any,
    left: left as any,
  };
}

function FileIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden="true">
      <path d="M1.5 1H8L11.5 4.5V13H1.5V1Z" stroke="currentColor" strokeWidth="1" />
      <path d="M8 1V4.5H11.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.5L4.5 9L10 3" stroke="var(--accent)" strokeWidth="1.5" fill="none" strokeLinecap="square" />
    </svg>
  );
}
