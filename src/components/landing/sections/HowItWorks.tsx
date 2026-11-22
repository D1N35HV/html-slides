import React from 'react';

const steps = [
  {
    label: 'Import',
    num: '01',
    title: 'Drop a .pptx. Keep every pixel.',
    body: 'Our PPTX parser preserves layout, fonts, shapes, transitions, and speaker notes as-is — so you spend the afternoon editing, not rebuilding what you already paid a designer to make.',
    aside: 'Supports .pptx · .ppt · Google Slides export · Keynote export',
  },
  {
    label: 'Refine',
    num: '02',
    title: 'Edit on the canvas you already know.',
    body: 'Click to edit, drag to move, right-click for the menu. No new mental model. Fix the things the previous author got wrong, and move on. Collaborators join with a link.',
    aside: 'Live collaboration · comments · version history',
  },
  {
    label: 'Ship',
    num: '03',
    title: 'Export to SCORM. Your LMS will accept it.',
    body: 'One click produces a manifest-valid package. We flag AA contrast issues, orphan assets, and broken references before you upload — so your admin does not reject the zip at 4:55pm on a Friday.',
    aside: 'SCORM 1.2 · SCORM 2004 · xAPI · AA validation included',
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section id="flow" style={{ paddingBlock: 'clamp(72px, 8vw, 128px)', borderTop: '1px solid var(--rule-hair)' }}>
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
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 16,
            marginBottom: 'clamp(48px, 6vw, 80px)',
            maxWidth: '44rem',
          }}
        >
          <div className="mono" style={sectionKicker}>
            How it works
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
            Three steps. No new tool to learn.
          </h2>
        </header>

        {/* Steps */}
        <ol
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gap: 0,
          }}
        >
          {steps.map((s, i) => (
            <li
              key={s.num}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
                gap: 'clamp(24px, 4vw, 64px)',
                paddingBlock: 'clamp(28px, 3vw, 44px)',
                borderTop: i === 0 ? 'none' : '1px solid var(--rule-hair)',
                alignItems: 'baseline',
              }}
            >
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
                  {s.num}
                </span>
                <div>
                  <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                    {s.label}
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
                      maxWidth: '14ch',
                    }}
                  >
                    {s.title}
                  </h3>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 18 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--step-1)',
                    lineHeight: 1.55,
                    color: 'var(--ink-muted)',
                    maxWidth: '58ch',
                  }}
                >
                  {s.body}
                </p>
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-faint)',
                    paddingTop: 12,
                    borderTop: '1px solid var(--rule-hair)',
                  }}
                >
                  {s.aside}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default HowItWorks;

const sectionKicker: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 11.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};
