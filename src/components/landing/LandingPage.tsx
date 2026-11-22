import React from 'react';
import Hero from './sections/Hero';
import HowItWorks from './sections/HowItWorks';
import Features from './sections/Features';
import Compatibility from './sections/Compatibility';
import FinalCTA from './sections/FinalCTA';

const LandingPage: React.FC = () => {
  return (
    <div className="lp-root min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <Compatibility />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;

function Navbar() {
  return (
    <header className="sticky top-0 z-40" style={{ backdropFilter: 'saturate(1.2)', background: 'color-mix(in oklch, var(--paper) 88%, transparent)', borderBottom: '1px solid var(--rule-hair)' }}>
      <div className="mx-auto grid items-center" style={{ maxWidth: 'var(--max)', gridTemplateColumns: 'auto 1fr auto', paddingInline: 'var(--rail)', height: 60, gap: 32 }}>
        <a href="/landing" className="focus-ring flex items-center" style={{ gap: 10, textDecoration: 'none', color: 'var(--ink)' }}>
          <LogoMark />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Slide Bolt</span>
        </a>
        <nav className="hidden md:flex items-center" style={{ gap: 28, justifySelf: 'center' }}>
          <NavLink href="#flow">How it works</NavLink>
          <NavLink href="#features">Features</NavLink>
          <NavLink href="#compatibility">LMS support</NavLink>
        </nav>
        <div className="flex items-center" style={{ gap: 16 }}>
          <a href="/login" className="focus-ring hidden sm:inline-flex" style={navLinkStyle}>Sign in</a>
          <a href="/register" className="focus-ring" style={primaryButtonStyle}>
            Start free trial
          </a>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="focus-ring"
      style={{
        fontSize: 14,
        color: 'var(--ink-muted)',
        textDecoration: 'none',
        transition: 'color 160ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
    >
      {children}
    </a>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ink-muted)',
  textDecoration: 'none',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 36,
  padding: '0 14px',
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--paper)',
  background: 'var(--accent)',
  textDecoration: 'none',
  borderRadius: 2,
  transition: 'background 160ms ease',
};

function LogoMark() {
  // A small, deliberate mark: two stacked "slides" suggesting a deck being packaged.
  // Flat, monochrome, ink-indigo. Not a gradient badge.
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="2" y="5" width="14" height="10" rx="0" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="6" y="7" width="14" height="10" rx="0" fill="var(--accent)" />
      <line x1="9" y1="11" x2="17" y2="11" stroke="var(--paper)" strokeWidth="1.25" />
      <line x1="9" y1="14" x2="14" y2="14" stroke="var(--paper)" strokeWidth="1.25" opacity="0.6" />
    </svg>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--rule-hair)', marginTop: 96 }}>
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
          paddingBlock: '48px 32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 40,
        }}
      >
        <div>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 16 }}>
            <LogoMark />
            <span style={{ fontSize: 15, fontWeight: 600 }}>Slide Bolt</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', lineHeight: 1.6, maxWidth: 260 }}>
            A quieter path from .pptx to LMS. Made for teams shipping at volume.
          </p>
        </div>
        <FooterCol title="Product" links={[
          ['Import', '#flow'],
          ['Features', '#features'],
          ['LMS support', '#compatibility'],
          ['Start free trial', '/register'],
        ]} />
        <FooterCol title="Resources" links={[
          ['SCORM spec notes', '#'],
          ['PPTX import guide', '#'],
          ['Accessibility report', '#'],
          ['Changelog', '#'],
        ]} />
        <FooterCol title="Company" links={[
          ['About', '#'],
          ['Privacy', '#'],
          ['Terms', '#'],
          ['Contact', 'mailto:hello@slidebolt.app'],
        ]} />
      </div>
      <div
        className="mx-auto flex"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
          paddingBlock: '16px 28px',
          borderTop: '1px solid var(--rule-hair)',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          © {new Date().getFullYear()} / SLIDE BOLT / BUILD {new Date().toISOString().slice(0, 10)}
        </span>
        <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          v0.9 — preview release
        </span>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 14 }}>
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {links.map(([label, href]) => (
          <li key={label}>
            <a
              href={href}
              className="focus-ring"
              style={{ fontSize: 13.5, color: 'var(--ink-muted)', textDecoration: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-muted)')}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
