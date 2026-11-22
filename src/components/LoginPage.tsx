import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import AuthLayout, { ErrorNotice, EyeIcon, LockIcon } from './ui/AuthLayout';

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || '/';
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const success = await login(email, password);
    if (success) {
      toast.success('Signed in');
      navigate(from, { replace: true });
    }
  };

  return (
    <AuthLayout
      mode="login"
      title="Welcome back."
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className="focus-ring" style={switchLinkStyle}>
            Create one →
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorNotice message={error} />}

        <div style={{ display: 'grid', gap: 20 }}>
          <div>
            <label htmlFor="email" className="lp-label">Email</label>
            <input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="lp-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error || undefined}
              placeholder="you@work.com"
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <label htmlFor="password" className="lp-label" style={{ marginBottom: 0 }}>Password</label>
              <a href="#" className="focus-ring" style={inlineLinkStyle}>Forgot?</a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="lp-field"
                style={{ paddingRight: 44 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error || undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="focus-ring"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={eyeButtonStyle}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          <button type="submit" className="lp-btn-primary" disabled={isLoading}>
            {isLoading && <span className="lp-spinner" aria-hidden />}
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mono" style={metaNoteStyle}>
            <LockIcon /> TLS-encrypted · session ends on sign-out
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}

const switchLinkStyle: React.CSSProperties = {
  color: 'var(--accent-ink)',
  fontWeight: 500,
  textDecoration: 'none',
  borderBottom: '1px solid currentColor',
  paddingBottom: 1,
};

const inlineLinkStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--ink-muted)',
  textDecoration: 'none',
  borderBottom: '1px dotted var(--ink-ghost)',
};

const eyeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  height: '100%',
  width: 40,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  color: 'var(--ink-faint)',
};

const metaNoteStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  margin: '4px 0 0',
  fontSize: 11.5,
  color: 'var(--ink-faint)',
  letterSpacing: '0.02em',
};

