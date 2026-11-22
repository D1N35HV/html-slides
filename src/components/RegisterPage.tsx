import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import AuthLayout, { ErrorNotice, EyeIcon, LockIcon } from './ui/AuthLayout';

export default function RegisterPage() {
  const { register, isLoading, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const strength = useMemo(() => scorePassword(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    const success = await register(name, email, password);
    if (success) {
      toast.success('Account created');
      navigate('/', { replace: true });
    }
  };

  return (
    <AuthLayout
      mode="register"
      title="Create your account."
      subtitle="Free to try on one deck. No credit card. Cancel in one click."
      footer={
        <>
          Already using Slide Bolt?{' '}
          <Link to="/login" className="focus-ring" style={switchLinkStyle}>
            Sign in →
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <ErrorNotice message={error} />}

        <div style={{ display: 'grid', gap: 20 }}>
          <div>
            <label htmlFor="name" className="lp-label">Name</label>
            <input
              ref={nameRef}
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="lp-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Priya Nair"
            />
          </div>

          <div>
            <label htmlFor="email" className="lp-label">Work email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="lp-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <p className="lp-hint">We'll use this to send SCORM exports and team invites.</p>
          </div>

          <div>
            <label htmlFor="password" className="lp-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
                className="lp-field"
                style={{ paddingRight: 44 }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="password-strength password-hint"
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
            <StrengthMeter score={strength} shown={password.length > 0} />
            <p id="password-hint" className="lp-hint">At least 6 characters. Longer with a number or symbol is better.</p>
          </div>

          <button type="submit" className="lp-btn-primary" disabled={isLoading} style={{ marginTop: 4 }}>
            {isLoading && <span className="lp-spinner" aria-hidden />}
            {isLoading ? 'Creating account…' : 'Create account'}
          </button>

          <p style={termsStyle}>
            By creating an account you agree to the{' '}
            <a href="#" className="focus-ring" style={inlineLinkStyle}>Terms</a>
            {' '}and{' '}
            <a href="#" className="focus-ring" style={inlineLinkStyle}>Privacy Policy</a>.
          </p>

          <p className="mono" style={metaNoteStyle}>
            <LockIcon /> TLS-encrypted · no marketing emails
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}

function scorePassword(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) || /[A-Z]/.test(pw)) score += 1;
  return Math.min(3, score) as 0 | 1 | 2 | 3;
}

function StrengthMeter({ score, shown }: { score: 0 | 1 | 2 | 3; shown: boolean }) {
  const labels = ['too short', 'weak', 'fair', 'strong'];
  const colors = ['var(--ink-ghost)', 'oklch(0.7 0.12 60)', 'oklch(0.65 0.12 95)', 'var(--accent)'];
  return (
    <div
      aria-live="polite"
      id="password-strength"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr auto',
        gap: 6,
        alignItems: 'center',
        marginTop: 8,
        opacity: shown ? 1 : 0,
        transition: 'opacity 160ms ease',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            height: 3,
            background: score > i ? colors[score] : 'var(--rule-hair)',
            transition: 'background 160ms ease',
          }}
        />
      ))}
      <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: 8 }}>
        {labels[score]}
      </span>
    </div>
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
  color: 'var(--ink)',
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

const termsStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  color: 'var(--ink-faint)',
  lineHeight: 1.55,
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
