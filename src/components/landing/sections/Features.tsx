import React from 'react';

const supporting = [
  {
    n: '02',
    title: 'Export your admin will accept.',
    body: 'Manifest-valid SCORM 1.2 and 2004 packages. Real-world tested against Moodle, Canvas, Cornerstone, and Docebo — not just the spec on paper.',
  },
  {
    n: '03',
    title: 'AA contrast, verified before upload.',
    body: 'Every text block is scored against WCAG 2.1 AA on export. You get the list of slides to fix before your learners ever see the course.',
  },
  {
    n: '04',
    title: 'Speaker notes become narration.',
    body: 'Optional one-click text-to-speech turns notes into audio tracks. Auto-captioned, synced to slide advance, consented voices.',
  },
  {
    n: '05',
    title: 'Quizzes that report back.',
    body: 'Knowledge-check blocks export as SCORM cmi.interactions or xAPI statements. Your LMS sees the score; your compliance report writes itself.',
  },
  {
    n: '06',
    title: 'One library, not fifty zips.',
    body: 'Import a whole folder of decks in one go. Re-edit centrally, re-export anywhere. The course library you wish PowerPoint had.',
  },
];

const Features: React.FC = () => {
  return (
    <section
      id="features"
      style={{
        paddingBlock: 'clamp(72px, 8vw, 128px)',
        borderTop: '1px solid var(--rule-hair)',
        background: 'var(--paper-sunk)',
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
        }}
      >
        {/* Section header */}
        <header
          style={{
            display: 'grid',
            gap: 16,
            marginBottom: 'clamp(48px, 6vw, 80px)',
            maxWidth: '48rem',
          }}
        >
          <div className="mono" style={sectionKicker}>
            What it gives you
          </div>
          <h2
            className="display"
            style={{
              fontSize: 'var(--step-3)',
              lineHeight: 'var(--lh-snug)',
              fontWeight: 600,
              margin: 0,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              maxWidth: '22ch',
            }}
          >
            Specifically what you were afraid it wouldn't do.
          </h2>
        </header>

        {/* Hero feature: the import fidelity story */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
            gap: 'clamp(28px, 4vw, 64px)',
            alignItems: 'start',
            paddingBottom: 'clamp(64px, 7vw, 96px)',
            borderBottom: '1px solid var(--rule-hair)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span
                className="mono"
                style={{
                  fontSize: 'var(--step-3)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                01
              </span>
              <div>
                <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                  Lead feature
                </div>
                <h3
                  className="display"
                  style={{
                    fontSize: 'var(--step-2)',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    lineHeight: 'var(--lh-snug)',
                    color: 'var(--ink)',
                    margin: '10px 0 0',
                    maxWidth: '16ch',
                  }}
                >
                  Imports that look like you meant them.
                </h3>
              </div>
            </div>
            <p
              style={{
                marginTop: 20,
                fontSize: 'var(--step-1)',
                lineHeight: 1.55,
                color: 'var(--ink-muted)',
                maxWidth: '44ch',
              }}
            >
              Every other tool flattens your deck into a template. Slide Bolt keeps the original —
              fonts, shapes, anchor points, transitions, speaker notes, embedded media. You edit the
              deck you imported, not a reconstructed guess of it.
            </p>
            <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="/register" className="focus-ring" style={ghostCta}>
                Try it on your own deck
                <span aria-hidden style={{ marginLeft: 6 }}>→</span>
              </a>
            </div>
          </div>

          <FidelityReport />
        </div>

        {/* Supporting feature grid */}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            marginTop: 'clamp(48px, 6vw, 80px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'clamp(32px, 4vw, 56px) clamp(32px, 4vw, 48px)',
          }}
        >
          {supporting.map((f) => (
            <li key={f.n} style={{ display: 'grid', gap: 10 }}>
              <span className="mono" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.06em' }}>
                {f.n}
              </span>
              <h4
                style={{
                  fontSize: 'var(--step-1)',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                  color: 'var(--ink)',
                  margin: 0,
                  maxWidth: '22ch',
                }}
              >
                {f.title}
              </h4>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-muted)', margin: 0, maxWidth: '40ch' }}>
                {f.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default Features;

const sectionKicker: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 11.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};

const ghostCta: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--accent-ink)',
  textDecoration: 'none',
  borderBottom: '1px solid var(--accent)',
  paddingBottom: 2,
};

function FidelityReport() {
  const rows: { status: 'ok' | 'warn' | 'note'; count: string; what: string; detail: string }[] = [
    { status: 'ok', count: '42', what: 'slide layouts', detail: 'preserved as-is' },
    { status: 'ok', count: '3', what: 'master templates', detail: 'detected and mapped' },
    { status: 'ok', count: '7', what: 'custom fonts', detail: 'embedded, not substituted' },
    { status: 'ok', count: '184', what: 'shapes', detail: 'anchor points retained' },
    { status: 'note', count: '12', what: 'transitions', detail: 'translated to SCORM-safe equivalents' },
    { status: 'ok', count: '42', what: 'speaker notes', detail: 'carried over as module narration' },
    { status: 'warn', count: '1', what: 'broken link', detail: 'flagged on slide 29' },
    { status: 'ok', count: '6', what: 'videos', detail: 're-encoded for LMS compatibility' },
  ];

  return (
    <div
      style={{
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
          paddingInline: 18,
          height: 40,
          borderBottom: '1px solid var(--rule-hair)',
          background: 'var(--paper-sunk)',
          fontSize: 11.5,
          color: 'var(--ink-muted)',
          letterSpacing: '0.06em',
        }}
      >
        <span style={{ textTransform: 'uppercase' }}>import.report</span>
        <span style={{ color: 'var(--ink-faint)' }}>finished in 2.4s</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r, i) => (
          <li
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '18px 48px 1fr auto',
              alignItems: 'baseline',
              gap: 12,
              paddingInline: 18,
              paddingBlock: 11,
              borderTop: i === 0 ? 'none' : '1px solid var(--rule-hair)',
            }}
          >
            <StatusGlyph status={r.status} />
            <span className="mono" style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700, textAlign: 'right' }}>
              {r.count}
            </span>
            <span style={{ fontSize: 13.5, color: 'var(--ink)' }}>{r.what}</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
              {r.detail}
            </span>
          </li>
        ))}
      </ul>
      <div
        className="mono"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingInline: 18,
          height: 38,
          alignItems: 'center',
          borderTop: '1px solid var(--rule-hair)',
          background: 'var(--paper-sunk)',
          fontSize: 11.5,
          color: 'var(--ink-faint)',
        }}
      >
        <span>hash: a4c9f2e…8d</span>
        <span style={{ color: 'var(--accent)' }}>ready to edit ↵</span>
      </div>
    </div>
  );
}

function StatusGlyph({ status }: { status: 'ok' | 'warn' | 'note' }) {
  if (status === 'ok') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 6.5L4.5 9L10 3" stroke="var(--accent)" strokeWidth="1.75" fill="none" strokeLinecap="square" />
      </svg>
    );
  }
  if (status === 'warn') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="5" fill="none" stroke="var(--ink-muted)" strokeWidth="1.25" />
        <line x1="6" y1="3.5" x2="6" y2="7" stroke="var(--ink-muted)" strokeWidth="1.25" strokeLinecap="square" />
        <rect x="5.5" y="8" width="1" height="1" fill="var(--ink-muted)" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <line x1="2" y1="6" x2="10" y2="6" stroke="var(--ink-faint)" strokeWidth="1.25" />
    </svg>
  );
}
