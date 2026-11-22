import React from 'react';

const lmsNames = [
  'Moodle',
  'Canvas',
  'Blackboard Learn',
  'Cornerstone',
  'Docebo',
  'TalentLMS',
  'Absorb',
  '360Learning',
  'SAP SuccessFactors',
  'Workday Learning',
  'LearnUpon',
  'Thinkific',
];

const formats = [
  { tag: 'SCORM 1.2', note: 'full export · cmi.core + cmi.interactions' },
  { tag: 'SCORM 2004', note: 'editions 2, 3, 4 · sequencing + navigation' },
  { tag: 'xAPI', note: 'statements via LRS endpoint · cmi5 profile optional' },
  { tag: 'AICC', note: 'legacy HACP fallback for older systems' },
];

const Compatibility: React.FC = () => {
  return (
    <section
      id="compatibility"
      style={{
        paddingBlock: 'clamp(72px, 8vw, 128px)',
        borderTop: '1px solid var(--rule-hair)',
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 'clamp(48px, 6vw, 80px)',
        }}
      >
        <header style={{ display: 'grid', gap: 16, maxWidth: '50rem' }}>
          <div className="mono" style={sectionKicker}>
            Compatibility
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
              maxWidth: '24ch',
            }}
          >
            Works with the LMS your IT already runs.
          </h2>
          <p
            style={{
              fontSize: 'var(--step-1)',
              lineHeight: 1.55,
              color: 'var(--ink-muted)',
              margin: 0,
              maxWidth: '58ch',
            }}
          >
            We don't ship our own LMS and we don't ask your admin to install anything. Exports are
            standard SCORM or xAPI zips — tested against the systems below, validated against the
            spec.
          </p>
        </header>

        {/* LMS compatibility grid — text names in mono, no fake logos */}
        <div>
          <div className="mono" style={subKicker}>
            Tested against
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              borderTop: '1px solid var(--rule-hair)',
              borderLeft: '1px solid var(--rule-hair)',
            }}
          >
            {lmsNames.map((name) => (
              <li
                key={name}
                style={{
                  padding: '18px 20px',
                  borderRight: '1px solid var(--rule-hair)',
                  borderBottom: '1px solid var(--rule-hair)',
                  fontSize: 14.5,
                  fontWeight: 500,
                  color: 'var(--ink)',
                  letterSpacing: '-0.005em',
                  background: 'var(--paper)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  aria-hidden
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-ghost)', letterSpacing: '0.08em' }}
                >
                  —
                </span>
                {name}
              </li>
            ))}
          </ul>
        </div>

        {/* Format coverage */}
        <div>
          <div className="mono" style={subKicker}>
            Export formats
          </div>
          <dl
            style={{
              margin: 0,
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '24px 40px',
            }}
          >
            {formats.map((f) => (
              <div key={f.tag} style={{ display: 'grid', gap: 8, paddingTop: 16, borderTop: '1px solid var(--rule-hair)' }}>
                <dt className="mono" style={{ fontSize: 13.5, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.02em' }}>
                  {f.tag}
                </dt>
                <dd className="mono" style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                  {f.note}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default Compatibility;

const sectionKicker: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 11.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};

const subKicker: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--ink-faint)',
};
