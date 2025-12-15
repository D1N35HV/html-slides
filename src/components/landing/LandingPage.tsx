import React, { Suspense, lazy } from 'react';
import Hero from './sections/Hero';
import Features from './sections/Features';
import FinalCTA from './sections/FinalCTA';

const Testimonials = lazy(() => import('./sections/Testimonials'));

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen text-gray-900 bg-gradient-to-br from-surface-subtle via-surface-alt to-white">
      <GradientAura />
      <Navbar />
      <main className="relative overflow-hidden">
        <Hero />
        <Features />
        <Suspense fallback={<SectionFallback label="Loading testimonials" /> }>
          <Testimonials />
        </Suspense>
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;

function Navbar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/50 supports-[backdrop-filter]:bg-white/40 border-b border-white/40">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-500 to-brand-300 shadow-glow">
            <span className="text-white font-bold">SB</span>
          </span>
          <span className="font-semibold text-gray-800">Slide Bolt</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
          <a href="#showcase" className="hover:text-gray-900 transition-colors">Showcase</a>
          <a href="#testimonials" className="hover:text-gray-900 transition-colors">Stories</a>
        </nav>
        <div className="flex items-center gap-3">
          <a href="/login" className="text-sm text-gray-600 hover:text-gray-900">Log in</a>
          <a href="/register" className="inline-flex items-center rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 text-white px-4 py-2 text-sm shadow-elevated hover:shadow-glow transition-shadow">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/50 bg-white/40 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">© {new Date().getFullYear()} Slide Bolt. All rights reserved.</p>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-900">Privacy</a>
          <a href="#" className="hover:text-gray-900">Terms</a>
          <a href="#" className="hover:text-gray-900">Support</a>
        </div>
      </div>
    </footer>
  );
}

function GradientAura() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-300/40 via-brand-500/25 to-indigo-400/30 blur-3xl" />
      <div className="absolute -bottom-24 right-1/4 h-[500px] w-[700px] rounded-full bg-gradient-to-tr from-purple-300/30 via-pink-300/25 to-brand-400/20 blur-3xl" />
    </div>
  );
}

function SectionFallback({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20">
      <div className="animate-pulse rounded-2xl border border-white/60 bg-white/50 backdrop-blur-xl p-10 shadow-soft">
        <p className="text-sm text-gray-500">{label}…</p>
      </div>
    </div>
  );
}
