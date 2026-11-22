import React, { useEffect, useMemo, useRef, useState } from 'react';
import apiService from '../services/ApiService';
import { Link, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import PresentationCard, { PresentationSummary } from './ui/PresentationCard';
import SkeletonCard from './ui/SkeletonCard';
import EmptyState from './ui/EmptyState';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presentations, setPresentations] = useState<PresentationSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'exported' | 'drafts'>('all');
  const { user, isAuthenticated, logout, isLoading: authLoading } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    presentations.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort().slice(0, 16);
  }, [presentations]);

  const fetchPresentations = async (opts: { page?: number; search?: string } = {}) => {
    try {
      setLoading(true);
      const params: any = { page: opts.page || page, limit: 12 };
      if (opts.search !== undefined) params.search = opts.search.trim();
      const res = apiService.isAuthenticated()
        ? await apiService.getUserPresentations(params)
        : await apiService.getPublicPresentations(params);
      if (res.success) {
        setPresentations(res.data || []);
        setHasNextPage(res.pagination?.hasNextPage || false);
      }
    } catch (e: any) {
      setError(e.message?.split('\n')[0] || 'Failed to load your library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresentations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput.trim() !== search) {
        setPage(1);
        setSearch(searchInput.trim());
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const handleBlank = async () => {
    if (creating) return;
    try {
      setCreating(true);
      const res = await apiService.createPresentation({
        title: 'Untitled Deck',
        slides: [{ id: `slide-${Date.now()}`, elements: [], order: 0 }],
        isPublic: false,
        tags: [],
      } as any);
      if (res.success && res.data) {
        const id = (res as any).data._id || (res as any).data.id;
        if (id) navigate(`/editor/${id}`);
      }
    } catch (err: any) {
      console.error('Failed to create:', err);
      setError(err.message || 'Failed to create a new deck');
    } finally {
      setCreating(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsImporting(true);
      const response = await apiService.uploadTemplateStreaming(file);
      if (response.success && response.data) {
        const id = (response.data as any).presentationId;
        if (id) {
          navigate(`/editor/${id}`);
        } else {
          const createRes = await apiService.createPresentation({
            title: file.name.replace(/\.pptx?$/i, ''),
            slides: response.data.slides.map((s: any, i: number) => ({ ...s, order: i })),
            isPublic: false,
            tags: ['imported', 'ppt'],
          } as any);
          if (createRes.success && createRes.data) {
            const newId = (createRes as any).data._id || (createRes as any).data.id;
            if (newId) navigate(`/editor/${newId}`);
          } else {
            setError('Import succeeded but saving failed. Try again?');
          }
        }
      } else {
        setError('We couldn\'t parse that file. Is it a valid .pptx?');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setError('Import failed. ' + (err.message || ''));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleBlank();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const filtered = useMemo(() => {
    let list = presentations;
    if (activeTags.length > 0) {
      list = list.filter((p) => p.tags?.some((t) => activeTags.includes(t)));
    }
    if (statusFilter === 'exported') {
      list = list.filter((p) => !!p.scormExportedAt);
    } else if (statusFilter === 'drafts') {
      list = list.filter((p) => !p.scormExportedAt);
    }
    return list;
  }, [presentations, activeTags, statusFilter]);

  const stats = useMemo(() => {
    const total = presentations.length;
    const pub = presentations.filter((p) => p.isPublic).length;
    const priv = total - pub;
    const exported = presentations.filter((p) => p.scormExportedAt).length;
    return { total, pub, priv, exported };
  }, [presentations]);

  const showEmpty = !loading && presentations.length === 0;
  const showNoResults = !loading && presentations.length > 0 && filtered.length === 0;

  return (
    <div className="lp-root" style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      {/* Top Bar */}
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
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 20,
            alignItems: 'center',
          }}
        >
          <Link to="/landing" className="focus-ring" style={brandLinkStyle}>
            <LogoMark />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>Slide Bolt</span>
          </Link>

          <div style={{ justifySelf: 'stretch', maxWidth: 520, position: 'relative' }}>
            <SearchIcon />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search your library…"
              className="lp-field"
              aria-label="Search the library"
              style={{ paddingLeft: 38, height: 40 }}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
                aria-label="Clear search"
                className="focus-ring"
                style={clearSearchStyle}
              >
                <CrossIcon />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={handleBlank} disabled={creating} className="lp-btn-secondary lp-hide-sm" title="⌘N">
              {creating ? <Spinner /> : <PlusIcon />} Blank
            </button>
            <button onClick={handleImportClick} disabled={isImporting} className="lp-btn-primary lp-hide-xs" style={{ width: 'auto', paddingInline: 16, height: 36, fontSize: 13.5 }}>
              {isImporting ? <span className="lp-spinner" aria-hidden /> : <UploadIcon />}
              {isImporting ? 'Importing…' : 'Import .pptx'}
            </button>

            {isAuthenticated ? (
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
                  className="focus-ring"
                  style={avatarButtonStyle}
                >
                  <Avatar user={user} />
                </button>
                {userMenuOpen && (
                  <div role="menu" className="lp-menu-surface" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 220 }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--rule-hair)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Signed in'}</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                    </div>
                    <button
                      role="menuitem"
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className="lp-menu-item"
                    >
                      <SettingsIcon /> Settings
                    </button>
                    <div aria-hidden style={{ height: 1, background: 'var(--rule-hair)' }} />
                    <button
                      role="menuitem"
                      onClick={async () => { await logout(); setUserMenuOpen(false); navigate('/login'); }}
                      disabled={authLoading}
                      className="lp-menu-item destructive"
                    >
                      <SignOutIcon /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" style={{ fontSize: 13.5, color: 'var(--ink-muted)', textDecoration: 'none' }}>Sign in</Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto" style={{ width: '100%', maxWidth: 'var(--max)', paddingInline: 'var(--rail)', paddingBlock: 'clamp(32px, 4vw, 56px)' }}>
        {/* Library header */}
        <div style={{ display: 'grid', gap: 20, marginBottom: 32 }}>
          <div>
            <div className="mono" style={kickerStyle}>Library</div>
            <h1
              className="display"
              style={{
                margin: '10px 0 0',
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: '-0.025em',
                color: 'var(--ink)',
                lineHeight: 1.1,
              }}
            >
              {user?.name ? `${user.name.split(' ')[0]}'s decks.` : 'Your decks.'}
            </h1>
            {stats.total > 0 && (
              <div className="mono" style={statsRowStyle}>
                <Stat n={stats.total} label="total" />
                <SepDot />
                <Stat n={stats.priv} label="private" />
                <SepDot />
                <Stat n={stats.pub} label="public" />
                <SepDot />
                <Stat n={stats.exported} label="exported" accent />
              </div>
            )}
          </div>

          {/* Filters */}
          {presentations.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterChip>
              <FilterChip active={statusFilter === 'exported'} onClick={() => setStatusFilter('exported')}>Exported</FilterChip>
              <FilterChip active={statusFilter === 'drafts'} onClick={() => setStatusFilter('drafts')}>Drafts</FilterChip>

              {tagOptions.length > 0 && (
                <span aria-hidden style={{ width: 1, height: 18, background: 'var(--rule-strong)', marginInline: 4 }} />
              )}
              {tagOptions.map((tag) => (
                <FilterChip key={tag} active={activeTags.includes(tag)} onClick={() => toggleTag(tag)}>
                  <span style={{ color: 'var(--ink-ghost)' }}>#</span>{tag}
                </FilterChip>
              ))}

              {(activeTags.length > 0 || statusFilter !== 'all') && (
                <button
                  onClick={() => { setActiveTags([]); setStatusFilter('all'); }}
                  className="lp-btn-ghost"
                  style={{ marginLeft: 'auto' }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 24,
              padding: '12px 14px',
              border: '1px solid oklch(0.58 0.18 27 / 0.4)',
              background: 'oklch(0.98 0.02 27)',
              color: 'oklch(0.35 0.15 27)',
              fontSize: 13.5,
              borderRadius: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>{error}</span>
            <button onClick={() => setError(null)} className="lp-btn-ghost" style={{ color: 'inherit' }} aria-label="Dismiss">Dismiss</button>
          </div>
        )}

        {/* Grid / States */}
        {loading && presentations.length === 0 ? (
          <CardGrid>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </CardGrid>
        ) : showEmpty ? (
          <EmptyState onCreate={handleBlank} onImport={handleImportClick} />
        ) : showNoResults ? (
          <NoResults onReset={() => { setActiveTags([]); setStatusFilter('all'); setSearchInput(''); setSearch(''); }} />
        ) : (
          <CardGrid>
            {filtered.map((p) => (
              <PresentationCard
                key={p._id}
                data={p}
                onDeleted={(id) => setPresentations((prev) => prev.filter((x) => x._id !== id))}
                onDuplicated={(_, newItem) => setPresentations((prev) => [newItem, ...prev])}
              />
            ))}
          </CardGrid>
        )}

        {/* Pagination */}
        {(page > 1 || hasNextPage) && (
          <nav
            aria-label="Library pagination"
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: '1px solid var(--rule-hair)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="lp-btn-secondary"
            >
              ← Previous
            </button>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)', letterSpacing: '0.04em' }}>
              page {page}
            </span>
            <button
              disabled={!hasNextPage}
              onClick={() => setPage((p) => p + 1)}
              className="lp-btn-secondary"
            >
              Next →
            </button>
          </nav>
        )}
      </main>

      {/* Mobile-only FAB: direct import action, not a modal */}
      <button
        onClick={handleImportClick}
        disabled={isImporting}
        aria-label="Import a PPTX"
        className="focus-ring lp-fab-mobile"
        style={fabStyle}
      >
        {isImporting ? <span className="lp-spinner" aria-hidden /> : <UploadIcon />}
      </button>

      <Toaster position="bottom-right" />

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default Dashboard;

/* ─── Helpers & subcomponents ─────────────────────── */

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 20,
      }}
    >
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="lp-chip" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function NoResults({ onReset }: { onReset: () => void }) {
  return (
    <div style={{ paddingBlock: 80, textAlign: 'left', maxWidth: '52ch' }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
        No matches
      </div>
      <h3
        className="display"
        style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '10px 0 0' }}
      >
        Nothing in the library matches those filters.
      </h3>
      <p style={{ marginTop: 12, fontSize: 14.5, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
        Try a broader search, remove a tag, or clear the filter set.
      </p>
      <button onClick={onReset} className="lp-btn-secondary" style={{ marginTop: 20 }}>
        Clear filters
      </button>
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
      <span style={{ fontSize: 12.5, color: accent ? 'var(--accent-ink)' : 'var(--ink)', fontWeight: 600 }}>{n}</span>
      <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', letterSpacing: '0.02em' }}>{label}</span>
    </span>
  );
}

function SepDot() {
  return <span aria-hidden style={{ width: 2, height: 2, background: 'var(--ink-ghost)', borderRadius: '50%' }} />;
}

function Avatar({ user }: { user: any }) {
  if (user?.avatar) {
    return <img src={user.avatar} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: '50%', display: 'block' }} />;
  }
  const initial = (user?.name?.[0] || '·').toUpperCase();
  return (
    <div
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--accent-wash)',
        color: 'var(--accent-ink)',
        display: 'grid',
        placeItems: 'center',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '-0.01em',
      }}
    >
      {initial}
    </div>
  );
}

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

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden="true"
      style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }}
    >
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.25" />
      <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <line x1="7" y1="2.5" x2="7" y2="11.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2.5" y1="7" x2="11.5" y2="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <line x1="7" y1="9.5" x2="7" y2="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 5.5L7 1.5L11 5.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M8 2.5H3v9h5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M6 7h6.5M10 4.5L13 7l-3 2.5" fill="none" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M7 1.5v1.6M7 10.9v1.6M2.1 7H.5M13.5 7h-1.6M3.4 3.4L2.3 2.3M11.7 11.7l-1.1-1.1M3.4 10.6l-1.1 1.1M11.7 2.3l-1.1 1.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 12,
        height: 12,
        border: '1.25px solid var(--rule-strong)',
        borderTopColor: 'var(--ink)',
        borderRadius: '50%',
        animation: 'lp-spin 640ms linear infinite',
      }}
    />
  );
}

/* Styles */

const brandLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  color: 'var(--ink)',
};

const kickerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 11.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
};

const statsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  marginTop: 14,
  fontSize: 12,
  color: 'var(--ink-faint)',
  alignItems: 'center',
};

const clearSearchStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  right: 10,
  transform: 'translateY(-50%)',
  width: 22,
  height: 22,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  color: 'var(--ink-faint)',
  borderRadius: 2,
};

const avatarButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  padding: 3,
  background: 'transparent',
  border: '1px solid var(--rule-hair)',
  borderRadius: '50%',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
};

const fabStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  right: 24,
  width: 52,
  height: 52,
  background: 'var(--accent)',
  color: 'var(--paper)',
  border: 0,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  boxShadow: 'var(--shadow-raise)',
  zIndex: 20,
};
