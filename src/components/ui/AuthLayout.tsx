import React from 'react';
import { Link } from 'react-router-dom';

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-subtle to-surface-alt">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="group inline-flex items-center gap-2">
          <div className="rounded-lg bg-brand-600 p-2 text-white shadow-glow transition-transform duration-200 group-hover:scale-105">
            {/* Simple logo mark */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7a3 3 0 013-3h10a3 3 0 013 3v10a3 3 0 01-3 3H7a3 3 0 01-3-3V7z" fill="currentColor" opacity="0.9" />
              <path d="M8 9h8v2H8zM8 13h6v2H8z" fill="white" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight text-gray-900">SlideBolt</span>
        </Link>
        <nav className="text-sm text-gray-600">
          <Link className="hover:text-gray-900 transition-colors" to="/">Back to Home</Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-6 pb-16 pt-6 md:grid-cols-2">
        <section className="hidden md:block">
          <div className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-elevated">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-transparent to-transparent" />
            <h2 className="relative z-10 mb-3 text-2xl font-semibold text-gray-900">Design. Collaborate. Present.</h2>
            <p className="relative z-10 mb-6 text-gray-600">Create beautiful, collaborative presentations with precision editing, real‑time co‑authoring, and smart layout tools.</p>
            <div className="relative z-10 rounded-xl border border-gray-100 bg-surface-subtle p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="h-24 rounded-lg bg-white shadow-soft" />
                <div className="h-24 rounded-lg bg-white shadow-soft" />
                <div className="h-24 rounded-lg bg-white shadow-soft" />
              </div>
            </div>
          </div>
        </section>

        <section className="animate-fade-in">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
              {subtitle && <p className="mt-2 text-gray-600">{subtitle}</p>}
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-elevated ring-1 ring-black/5">
              {children}
            </div>
            {footer && <div className="mt-6 text-center text-sm text-gray-600">{footer}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
