import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth, ProfilePatch } from '../hooks/useAuth';

type SectionKey = 'profile' | 'preferences' | 'security';

const SECTIONS: ReadonlyArray<{ key: SectionKey; label: string; intro: string; title: string }> = [
  {
    key: 'profile',
    label: 'Profile',
    title: 'Profile',
    intro: 'Your name and avatar appear on shared decks and the Dashboard.'
  },
  {
    key: 'preferences',
    label: 'Preferences',
    title: 'Preferences',
    intro: 'Defaults that apply across every editing session. Changes apply immediately.'
  },
  {
    key: 'security',
    label: 'Security',
    title: 'Security',
    intro: "Change your password. You'll stay signed in on this device after updating."
  }
];

const SettingsPage: React.FC = () => {
  // All hooks must run on every render — do not gate with early returns above this block
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [section]);

  // Default-redirect /settings → /settings/profile, and unknown sections too
  if (!section || !SECTIONS.some((s) => s.key === section)) {
    return <Navigate to="/settings/profile" replace />;
  }

  if (isLoading) {
    return (
      <div className="lp-root" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--ink-faint)' }}>
        Loading…
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const activeSection = SECTIONS.find((s) => s.key === section)!;
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleString('en-US', { month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="lp-root settings-root" style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <TopBar />

      <main
        className="mx-auto settings-main"
        style={{
          width: '100%',
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
          paddingBlock: 'clamp(28px, 3.5vw, 48px)',
        }}
      >
        <div className="settings-grid">
          <LeftRail
            user={user}
            memberSince={memberSince}
            onSignOut={async () => {
              await logout();
              navigate('/login');
            }}
          />

          <section
            aria-labelledby="settings-section-title"
            style={{ minWidth: 0 }}
          >
            <SectionHeader
              ref={headingRef}
              title={activeSection.title}
              intro={activeSection.intro}
            />

            {activeSection.key === 'profile' && <ProfilePanel />}
            {activeSection.key === 'preferences' && <PreferencesPanel />}
            {activeSection.key === 'security' && <SecurityPanel />}
          </section>
        </div>
      </main>

      <Toaster position="bottom-right" />

      {/* Page-scoped styles for the grid, rail, rows, toggle, and strength meter */}
      <style>{SETTINGS_CSS}</style>
    </div>
  );
};

export default SettingsPage;

/* ─── Top bar ─────────────────────────────────────── */

function TopBar() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: 'var(--paper)',
        borderBottom: '1px solid var(--rule-hair)',
      }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--max)',
          paddingInline: 'var(--rail)',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}
      >
        <Link
          to="/landing"
          className="focus-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'var(--ink)',
          }}
          aria-label="Slide Bolt home"
        >
          <LogoMark />
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Slide Bolt</span>
        </Link>

        <span aria-hidden style={{ width: 1, height: 18, background: 'var(--rule-strong)' }} />

        <Link
          to="/"
          className="focus-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13.5,
            color: 'var(--ink-muted)',
            textDecoration: 'none',
          }}
        >
          <span aria-hidden>←</span>
          Library
        </Link>
      </div>
    </header>
  );
}

/* ─── Left rail ───────────────────────────────────── */

function LeftRail({
  user,
  memberSince,
  onSignOut,
}: {
  user: { email: string; name: string };
  memberSince: string | null;
  onSignOut: () => void;
}) {
  return (
    <aside className="settings-rail">
      <div className="mono settings-kicker">Account</div>
      <nav aria-label="Settings sections" style={{ display: 'grid' }}>
        {SECTIONS.map((s) => (
          <NavLink
            key={s.key}
            to={`/settings/${s.key}`}
            className={({ isActive }) =>
              'settings-rail-link focus-ring' + (isActive ? ' is-active' : '')
            }
            end
          >
            {({ isActive }) => (
              <>
                {isActive && <span aria-hidden className="settings-rail-marker" />}
                <span>{s.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="settings-rail-footer">
        <div
          title={user.email}
          style={{
            fontSize: 12.5,
            color: 'var(--ink-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.email}
        </div>
        {memberSince && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4, letterSpacing: '0.02em' }}>
            Member since {memberSince}
          </div>
        )}
        <button
          className="lp-btn-ghost"
          style={{ marginTop: 12, paddingInline: 0, height: 28, fontSize: 12.5 }}
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

/* ─── Section header ──────────────────────────────── */

const SectionHeader = React.forwardRef<HTMLHeadingElement, { title: string; intro: string }>(
  function SectionHeader({ title, intro }, ref) {
    return (
      <div style={{ marginBottom: 28 }}>
        <h1
          ref={ref}
          id="settings-section-title"
          tabIndex={-1}
          className="display"
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            color: 'var(--ink)',
            lineHeight: 1.15,
            outline: 'none',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--ink-muted)',
            lineHeight: 1.5,
            maxWidth: '62ch',
          }}
        >
          {intro}
        </p>
      </div>
    );
  }
);

/* ─── Row primitive ───────────────────────────────── */

function FieldRow({
  label,
  helper,
  htmlFor,
  status,
  children,
}: {
  label: string;
  helper?: string;
  htmlFor?: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-label">
        <label htmlFor={htmlFor} style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', display: 'block' }}>
          {label}
        </label>
        {helper && (
          <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--ink-faint)', lineHeight: 1.5, maxWidth: '32ch' }}>
            {helper}
          </div>
        )}
      </div>
      <div className="settings-row-control">{children}</div>
      <div className="settings-row-status" aria-live="polite">{status}</div>
    </div>
  );
}

/* ─── Profile panel ───────────────────────────────── */

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function ProfilePanel() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const savedTimeout = useRef<number | null>(null);

  // Keep local draft in sync if user object updates from elsewhere
  useEffect(() => {
    if (user?.name && saveState === 'idle' && name === '') {
      setName(user.name);
    }
  }, [user, saveState, name]);

  const initial = (user?.name || user?.email || '·').trim().charAt(0).toUpperCase();
  const dirty = name.trim() !== (user?.name || '').trim() && name.trim().length > 0;

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return 'Name must be at least 2 characters.';
    if (trimmed.length > 50) return 'Name can be at most 50 characters.';
    return null;
  };

  const handleSave = async () => {
    const problem = validate(name);
    if (problem) {
      setValidationMsg(problem);
      return;
    }
    setValidationMsg(null);
    setErrorMsg(null);
    setSaveState('saving');
    try {
      await updateProfile({ name: name.trim() });
      setSaveState('saved');
      if (savedTimeout.current) window.clearTimeout(savedTimeout.current);
      savedTimeout.current = window.setTimeout(() => setSaveState('idle'), 2400);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Couldn’t save. Try again?');
      setSaveState('error');
    }
  };

  const handleDiscard = () => {
    setName(user?.name || '');
    setValidationMsg(null);
    setErrorMsg(null);
    setSaveState('idle');
  };

  return (
    <div className="settings-panel">
      <FieldRow
        label="Display name"
        helper="Shown on presenter overlays and shared links."
        htmlFor="settings-name"
      >
        <input
          id="settings-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (validationMsg) setValidationMsg(null);
          }}
          onBlur={() => {
            const problem = validate(name);
            setValidationMsg(problem);
          }}
          autoComplete="name"
          className="lp-field"
          aria-invalid={!!validationMsg}
          style={{ maxWidth: 380 }}
        />
        {validationMsg && (
          <div role="alert" style={{ marginTop: 6, fontSize: 12.5, color: 'oklch(0.5 0.18 27)' }}>
            {validationMsg}
          </div>
        )}
      </FieldRow>

      <FieldRow
        label="Email"
        helper="Email changes require support verification. Contact us to update."
        htmlFor="settings-email"
      >
        <input
          id="settings-email"
          type="email"
          value={user?.email || ''}
          readOnly
          aria-readonly
          className="lp-field"
          style={{ maxWidth: 380, color: 'var(--ink-faint)', background: 'var(--paper-sunk)' }}
        />
      </FieldRow>

      <FieldRow
        label="Avatar"
        helper="Avatar upload is coming soon — your initials appear on shared decks for now."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            aria-hidden
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--accent-wash)',
              color: 'var(--accent-ink)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              border: '1px solid var(--rule-hair)',
            }}
          >
            {initial}
          </div>
          <button
            type="button"
            disabled
            className="lp-btn-secondary"
            title="Avatar upload is coming soon"
            style={{ opacity: 0.55, cursor: 'not-allowed' }}
          >
            Upload image
          </button>
        </div>
      </FieldRow>

      {/* Footer: dirty-aware save/discard */}
      <div className="settings-section-footer">
        {errorMsg && saveState === 'error' && (
          <div role="alert" className="settings-error-banner">
            {errorMsg}
          </div>
        )}
        {saveState === 'saved' && (
          <div className="mono settings-saved-chip" aria-live="polite">Saved just now</div>
        )}
        {dirty && (
          <>
            <button type="button" className="lp-btn-ghost" onClick={handleDiscard} disabled={saveState === 'saving'}>
              Discard
            </button>
            <button
              type="button"
              className="lp-btn-primary"
              onClick={handleSave}
              disabled={saveState === 'saving' || !!validationMsg}
              style={{ width: 'auto', paddingInline: 18, height: 36, fontSize: 13.5 }}
            >
              {saveState === 'saving' ? <InlineSpinner light /> : null}
              {saveState === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Preferences panel ───────────────────────────── */

type PrefKey = 'autoSave' | 'notifications';
type RowStatus = 'idle' | 'saving' | 'saved' | 'error';

function PreferencesPanel() {
  const { user, updateProfile } = useAuth();
  const prefs = user?.preferences;

  // Local mirror of the two binary prefs we expose
  const [autoSave, setAutoSave] = useState<boolean>(prefs?.autoSave ?? true);
  const [notifications, setNotifications] = useState<boolean>(prefs?.notifications ?? true);
  const [rowStatus, setRowStatus] = useState<Record<PrefKey, RowStatus>>({
    autoSave: 'idle',
    notifications: 'idle',
  });
  const [rowError, setRowError] = useState<Partial<Record<PrefKey, string>>>({});
  const timers = useRef<Record<PrefKey, number | null>>({ autoSave: null, notifications: null });

  // Re-sync if user changes
  useEffect(() => {
    if (prefs) {
      setAutoSave(prefs.autoSave);
      setNotifications(prefs.notifications);
    }
  }, [prefs?.autoSave, prefs?.notifications]);

  const saveRow = async (key: PrefKey, nextValue: boolean) => {
    // optimistic
    if (key === 'autoSave') setAutoSave(nextValue);
    else setNotifications(nextValue);

    setRowStatus((s) => ({ ...s, [key]: 'saving' }));
    setRowError((e) => ({ ...e, [key]: undefined }));

    const patch: ProfilePatch = { preferences: { [key]: nextValue } as any };
    try {
      await updateProfile(patch);
      setRowStatus((s) => ({ ...s, [key]: 'saved' }));
      if (timers.current[key]) window.clearTimeout(timers.current[key]!);
      timers.current[key] = window.setTimeout(() => {
        setRowStatus((s) => (s[key] === 'saved' ? { ...s, [key]: 'idle' } : s));
      }, 2000);
    } catch (err: any) {
      // rollback
      if (key === 'autoSave') setAutoSave(!nextValue);
      else setNotifications(!nextValue);
      setRowStatus((s) => ({ ...s, [key]: 'error' }));
      setRowError((e) => ({ ...e, [key]: err?.message || 'Didn’t save' }));
    }
  };

  return (
    <div className="settings-panel">
      <FieldRow
        label="Autosave"
        helper="Saves the current deck every 20 seconds while editing."
        status={<RowStatusChip status={rowStatus.autoSave} error={rowError.autoSave} onRetry={() => saveRow('autoSave', autoSave)} />}
      >
        <Toggle
          checked={autoSave}
          label="Autosave"
          onChange={(next) => saveRow('autoSave', next)}
          disabled={rowStatus.autoSave === 'saving'}
        />
      </FieldRow>

      <FieldRow
        label="Email notifications"
        helper="Export-complete alerts and monthly summaries."
        status={<RowStatusChip status={rowStatus.notifications} error={rowError.notifications} onRetry={() => saveRow('notifications', notifications)} />}
      >
        <Toggle
          checked={notifications}
          label="Email notifications"
          onChange={(next) => saveRow('notifications', next)}
          disabled={rowStatus.notifications === 'saving'}
        />
      </FieldRow>
    </div>
  );
}

function RowStatusChip({ status, error, onRetry }: { status: RowStatus; error?: string; onRetry: () => void }) {
  if (status === 'idle') return null;
  if (status === 'saving') {
    return (
      <span className="mono settings-status" style={{ color: 'var(--ink-faint)' }}>
        <span aria-hidden className="settings-dot settings-dot--live" /> Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="mono settings-status" style={{ color: 'var(--ink-faint)' }}>
        <CheckIcon /> Saved
      </span>
    );
  }
  // error
  return (
    <span className="mono settings-status" style={{ color: 'oklch(0.5 0.18 27)', gap: 8 }} title={error}>
      Didn’t save
      <button type="button" className="lp-btn-ghost" onClick={onRetry} style={{ height: 22, paddingInline: 8, fontSize: 11.5 }}>
        Retry
      </button>
    </span>
  );
}

/* ─── Security panel ──────────────────────────────── */

function SecurityPanel() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reveal, setReveal] = useState<{ current: boolean; next: boolean; confirm: boolean }>({ current: false, next: false, confirm: false });
  const [state, setState] = useState<SaveState>('idle');
  const [currentErr, setCurrentErr] = useState<string | null>(null);
  const [confirmErr, setConfirmErr] = useState<string | null>(null);
  const [generalErr, setGeneralErr] = useState<string | null>(null);
  const [successUntil, setSuccessUntil] = useState<number | null>(null);

  const strength = useMemo(() => gradePassword(next), [next]);

  const matchOK = confirm.length === 0 || next === confirm;
  const canSubmit =
    current.length >= 1 &&
    next.length >= 8 &&
    confirm.length >= 8 &&
    next === confirm &&
    state !== 'saving';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentErr(null);
    setConfirmErr(null);
    setGeneralErr(null);

    if (next !== confirm) {
      setConfirmErr('Doesn’t match the new password.');
      return;
    }
    if (next.length < 8) {
      setGeneralErr('New password must be at least 8 characters.');
      return;
    }

    setState('saving');
    const startedAt = Date.now();
    try {
      await changePassword(current, next);
      // Minimum 400ms perceived delay — feels considered, not cavalier
      const elapsed = Date.now() - startedAt;
      if (elapsed < 400) await new Promise((r) => setTimeout(r, 400 - elapsed));
      setCurrent('');
      setNext('');
      setConfirm('');
      setState('saved');
      setSuccessUntil(Date.now() + 6000);
      setTimeout(() => setSuccessUntil((v) => (v && Date.now() >= v ? null : v)), 6200);
    } catch (err: any) {
      if (err?.code === 'INVALID_CURRENT_PASSWORD') {
        setCurrentErr('That’s not your current password.');
      } else {
        setGeneralErr(err?.message || 'Couldn’t update your password. Try again?');
      }
      setState('error');
    }
  };

  const showSuccess = state === 'saved' && successUntil && Date.now() < successUntil;

  return (
    <form className="settings-panel" onSubmit={handleSubmit} noValidate>
      {showSuccess && (
        <div className="settings-success-banner" role="status">
          <CheckIcon /> Password updated.
        </div>
      )}

      <FieldRow label="Current password" htmlFor="settings-current-pw">
        <PasswordInput
          id="settings-current-pw"
          value={current}
          onChange={(v) => { setCurrent(v); if (currentErr) setCurrentErr(null); }}
          autoComplete="current-password"
          reveal={reveal.current}
          onToggleReveal={() => setReveal((r) => ({ ...r, current: !r.current }))}
          invalid={!!currentErr}
        />
        {currentErr && (
          <div role="alert" style={{ marginTop: 6, fontSize: 12.5, color: 'oklch(0.5 0.18 27)' }}>
            {currentErr}
          </div>
        )}
      </FieldRow>

      <FieldRow
        label="New password"
        helper="At least 8 characters. Mixing letters, numbers, and symbols helps."
        htmlFor="settings-new-pw"
      >
        <PasswordInput
          id="settings-new-pw"
          value={next}
          onChange={(v) => setNext(v)}
          autoComplete="new-password"
          reveal={reveal.next}
          onToggleReveal={() => setReveal((r) => ({ ...r, next: !r.next }))}
        />
        <StrengthMeter score={strength.score} label={strength.label} show={next.length > 0} />
      </FieldRow>

      <FieldRow label="Confirm new password" htmlFor="settings-confirm-pw">
        <PasswordInput
          id="settings-confirm-pw"
          value={confirm}
          onChange={(v) => { setConfirm(v); if (confirmErr) setConfirmErr(null); }}
          autoComplete="new-password"
          reveal={reveal.confirm}
          onToggleReveal={() => setReveal((r) => ({ ...r, confirm: !r.confirm }))}
          invalid={!matchOK || !!confirmErr}
          onBlur={() => {
            if (confirm.length > 0 && next !== confirm) setConfirmErr('Doesn’t match the new password.');
          }}
        />
        {confirmErr && (
          <div role="alert" style={{ marginTop: 6, fontSize: 12.5, color: 'oklch(0.5 0.18 27)' }}>
            {confirmErr}
          </div>
        )}
      </FieldRow>

      <div className="settings-section-footer">
        {generalErr && (
          <div role="alert" className="settings-error-banner">
            {generalErr}
          </div>
        )}
        <button
          type="submit"
          className="lp-btn-primary"
          disabled={!canSubmit}
          style={{ width: 'auto', paddingInline: 18, height: 36, fontSize: 13.5 }}
        >
          {state === 'saving' ? <InlineSpinner light /> : null}
          {state === 'saving' ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </form>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  reveal,
  onToggleReveal,
  invalid,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  reveal: boolean;
  onToggleReveal: () => void;
  invalid?: boolean;
  onBlur?: () => void;
}) {
  return (
    <div style={{ position: 'relative', maxWidth: 380 }}>
      <input
        id={id}
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        className="lp-field"
        aria-invalid={invalid || undefined}
        style={{ paddingRight: 40 }}
      />
      <button
        type="button"
        onClick={onToggleReveal}
        aria-label={reveal ? 'Hide password' : 'Show password'}
        aria-pressed={reveal}
        className="focus-ring"
        style={{
          position: 'absolute',
          top: '50%',
          right: 8,
          transform: 'translateY(-50%)',
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          background: 'transparent',
          border: 0,
          cursor: 'pointer',
          color: 'var(--ink-faint)',
          borderRadius: 2,
        }}
      >
        {reveal ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function StrengthMeter({ score, label, show }: { score: 0 | 1 | 2 | 3; label: string; show: boolean }) {
  if (!show) return null;
  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, maxWidth: 380 }}>
      <div aria-hidden style={{ display: 'flex', gap: 4, flex: 1 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 4,
              background: i < score ? 'var(--accent)' : 'var(--rule-hair)',
              transition: 'background 180ms cubic-bezier(0.2, 0.7, 0.25, 1)',
            }}
          />
        ))}
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', letterSpacing: '0.02em' }}>{label}</span>
    </div>
  );
}

/**
 * In-house strength heuristic: length thresholds + character-class diversity.
 * No zxcvbn. Returns a 0–3 score and a short label.
 */
function gradePassword(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { score: 0, label: '' };
  const len = pw.length;
  const classes =
    (/[a-z]/.test(pw) ? 1 : 0) +
    (/[A-Z]/.test(pw) ? 1 : 0) +
    (/\d/.test(pw) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(pw) ? 1 : 0);

  let score: 0 | 1 | 2 | 3 = 0;
  if (len >= 8 && classes >= 1) score = 1;
  if (len >= 12 && classes >= 2) score = 2;
  if (len >= 16 && classes >= 3) score = 3;

  const label = score === 0 ? 'Too short' : score === 1 ? 'Fine' : score === 2 ? 'Good' : 'Strong';
  return { score, label };
}

/* ─── Toggle ──────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="focus-ring settings-toggle"
      data-checked={checked ? 'true' : 'false'}
    >
      <span aria-hidden className="settings-toggle-thumb" />
    </button>
  );
}

/* ─── Icons ───────────────────────────────────────── */

function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="2" y="5" width="14" height="10" rx="0" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="6" y="7" width="14" height="10" rx="0" fill="var(--accent)" />
      <line x1="9" y1="11" x2="17" y2="11" stroke="var(--paper)" strokeWidth="1.25" />
      <line x1="9" y1="14" x2="14" y2="14" stroke="var(--paper)" strokeWidth="1.25" opacity="0.6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 6.5L5 9l4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 8s2.5-4.5 6.5-4.5c1.1 0 2.1.3 3 .8M14 8s-2.5 4.5-6.5 4.5c-1 0-2-.3-2.9-.8" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <line x1="2.5" y1="2.5" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function InlineSpinner({ light }: { light?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 12,
        height: 12,
        border: `1.5px solid ${light ? 'color-mix(in oklch, var(--paper) 40%, transparent)' : 'var(--rule-strong)'}`,
        borderTopColor: light ? 'var(--paper)' : 'var(--ink)',
        borderRadius: '50%',
        animation: 'lp-spin 640ms linear infinite',
        marginRight: 6,
        display: 'inline-block',
        verticalAlign: '-2px',
      }}
    />
  );
}

/* ─── Styles ──────────────────────────────────────── */

const SETTINGS_CSS = `
  .settings-root .settings-grid {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: clamp(28px, 4vw, 56px);
    align-items: start;
  }
  .settings-root .settings-kicker {
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-muted);
    margin-bottom: 14px;
  }
  .settings-root .settings-rail {
    position: sticky;
    top: 76px;
    display: grid;
    gap: 0;
    align-content: start;
  }
  .settings-root .settings-rail-link {
    position: relative;
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 10px;
    font-size: 13.5px;
    color: var(--ink-muted);
    text-decoration: none;
    border-radius: 2px;
    transition: background 120ms ease, color 120ms ease;
  }
  .settings-root .settings-rail-link:hover {
    color: var(--ink);
    background: var(--paper-sunk);
  }
  .settings-root .settings-rail-link.is-active {
    color: var(--ink);
    font-weight: 600;
    background: var(--accent-wash);
  }
  .settings-root .settings-rail-marker {
    position: absolute;
    left: -10px;
    top: 6px;
    bottom: 6px;
    width: 2px;
    background: var(--accent);
  }
  .settings-root .settings-rail-footer {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--rule-hair);
  }

  .settings-root .settings-panel {
    display: grid;
    gap: 0;
  }
  .settings-root .settings-row {
    display: grid;
    grid-template-columns: 200px 1fr auto;
    gap: 24px;
    align-items: start;
    padding: 24px 0;
    border-bottom: 1px solid var(--rule-hair);
  }
  .settings-root .settings-row:first-of-type {
    padding-top: 4px;
  }
  .settings-root .settings-row-label { min-width: 0; }
  .settings-root .settings-row-control { min-width: 0; }
  .settings-root .settings-row-status {
    min-width: 120px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-top: 4px;
  }

  .settings-root .settings-section-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 24px;
    min-height: 36px;
    flex-wrap: wrap;
  }

  .settings-root .settings-error-banner {
    flex: 1;
    padding: 8px 12px;
    font-size: 12.5px;
    color: oklch(0.35 0.15 27);
    background: oklch(0.98 0.02 27);
    border: 1px solid oklch(0.58 0.18 27 / 0.35);
    text-align: left;
  }

  .settings-root .settings-success-banner {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--accent-ink);
    background: var(--accent-wash);
    border: 1px solid color-mix(in oklch, var(--accent) 30%, var(--rule-hair));
    margin-bottom: 8px;
  }

  .settings-root .settings-saved-chip {
    font-size: 11.5px;
    color: var(--ink-faint);
    letter-spacing: 0.02em;
    margin-right: auto;
  }

  .settings-root .settings-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .settings-root .settings-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }
  .settings-root .settings-dot--live {
    animation: settings-pulse 1.1s ease-in-out infinite;
  }
  @keyframes settings-pulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 1; }
  }

  /* Toggle */
  .settings-root .settings-toggle {
    width: 36px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: 20px;
    background: var(--rule-strong);
    position: relative;
    cursor: pointer;
    transition: background 150ms cubic-bezier(0.2, 0.7, 0.25, 1);
  }
  .settings-root .settings-toggle[data-checked="true"] {
    background: var(--accent);
  }
  .settings-root .settings-toggle:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .settings-root .settings-toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--paper);
    box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    transition: transform 150ms cubic-bezier(0.2, 0.7, 0.25, 1);
  }
  .settings-root .settings-toggle[data-checked="true"] .settings-toggle-thumb {
    transform: translateX(16px);
  }

  /* Responsive — rail becomes a tab strip under 720px */
  @media (max-width: 720px) {
    .settings-root .settings-grid {
      grid-template-columns: 1fr;
      gap: 20px;
    }
    .settings-root .settings-rail {
      position: static;
      top: auto;
    }
    .settings-root .settings-rail nav {
      display: flex !important;
      gap: 4px;
      border-bottom: 1px solid var(--rule-hair);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .settings-root .settings-rail-link {
      flex: 0 0 auto;
      padding: 0 14px;
      height: 40px;
      border-radius: 0;
      background: transparent !important;
      border-bottom: 2px solid transparent;
    }
    .settings-root .settings-rail-link.is-active {
      background: transparent;
      border-bottom-color: var(--accent);
    }
    .settings-root .settings-rail-marker { display: none; }
    .settings-root .settings-rail-footer {
      border-top: 0;
      margin-top: 8px;
      padding-top: 0;
    }

    .settings-root .settings-row {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .settings-root .settings-row-status {
      justify-content: flex-start;
      min-width: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .settings-root .settings-dot--live { animation: none; }
    .settings-root .settings-toggle,
    .settings-root .settings-toggle-thumb { transition: none; }
  }
`;
