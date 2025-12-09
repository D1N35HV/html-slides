import React, { useEffect, useMemo, useState, useRef } from 'react';
import apiService from '../services/ApiService';
import { Link, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { MagnifyingGlassIcon, PlusIcon, TagIcon } from '@heroicons/react/24/outline';
import PresentationCard, { PresentationSummary } from './ui/PresentationCard';
import SkeletonCard from './ui/SkeletonCard';
import EmptyState from './ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { ArrowRightOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/solid';

// (Moved PresentationSummary to reusable component)

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presentations, setPresentations] = useState<PresentationSummary[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const { user, isAuthenticated, logout, isLoading: authLoading } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  // close user menu on outside click
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

  // derive tag list from currently loaded presentations
  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    presentations.forEach(p => p.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort().slice(0, 25); // limit to avoid overflow
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
      setError(e.message?.split('\n')[0] || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresentations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  // simple debounce for search input
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

  // keyboard shortcut for new presentation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        window.location.href = '/create';
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleTag = (tag: string) => {
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const filtered = useMemo(() => {
    if (activeTags.length === 0) return presentations;
    return presentations.filter(p => p.tags?.some(t => activeTags.includes(t)));
  }, [presentations, activeTags]);

  const presentationCards = filtered.map(p => (
    <PresentationCard
      key={p._id}
      data={p}
      onDeleted={(id) => setPresentations(prev => prev.filter(x => x._id === id ? false : true))}
      onDuplicated={(_, newItem: any) => setPresentations(prev => [newItem, ...prev])}
    />
  ));

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-surface-subtle via-white to-brand-50">
      {/* Top Bar */}
      <header className="h-16 backdrop-blur-xs bg-white/70 border-b border-white/40 flex items-center px-6 sticky top-0 z-30">
        <div className="flex items-center gap-6 flex-1">
          <h1 className="text-xl font-semibold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-brand-500">Dashboard</h1>
          <form onSubmit={onSearchSubmit} className="relative w-full max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
            <input
              value={searchInput}
              onChange={e=>setSearchInput(e.target.value)}
              placeholder="Search presentations..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/70 border border-white/70 shadow-inner focus:outline-none focus:ring-2 focus:ring-brand-400 text-sm"
            />
          </form>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/create" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium shadow hover:bg-brand-500 focus:ring-2 focus:ring-brand-400">
            <PlusIcon className="w-5 h-5" /> New
          </Link>
          {/* User Panel */}
          {isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/70 border border-white/60 hover:bg-white shadow-sm transition"
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-sm font-semibold">
                    {user?.name?.[0]?.toUpperCase() || <UserCircleIcon className="w-6 h-6" />}
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">{user?.name || 'User'}</span>
                <svg className={`w-4 h-4 text-slate-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.188l3.71-3.957a.75.75 0 111.08 1.04l-4.25 4.53a.75.75 0 01-1.08 0l-4.25-4.53a.75.75 0 01.02-1.06z" /></svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg p-2 z-40 animate-in fade-in slide-in-from-top-1">
                  <div className="px-2 py-2 border-b border-slate-100 mb-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      setUserMenuOpen(false);
                      navigate('/login');
                    }}
                    disabled={authLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-red-50 text-red-600 font-medium disabled:opacity-50"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5" /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand-600">Sign In</Link>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden md:flex w-60 border-r border-white/40 bg-white/50 backdrop-blur-xs flex-col p-5 gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1"><TagIcon className="w-4 h-4"/> Tags</h3>
            <div className="flex flex-wrap gap-2">
              {tagOptions.length === 0 && <span className="text-[11px] text-slate-400">No tags</span>}
              {tagOptions.map(tag => {
                const active = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 rounded-full text-[11px] font-medium transition border ${active ? 'bg-brand-100 text-brand-700 border-brand-300 shadow-sm' : 'bg-white/70 text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  >{tag}</button>
                );
              })}
            </div>
          </div>
          {activeTags.length > 0 && (
            <button onClick={() => setActiveTags([])} className="self-start text-[11px] text-slate-500 hover:text-slate-800 underline">Clear filters</button>
          )}
        </aside>

        {/* Content area */}
        <section className="flex-1 overflow-y-auto scrollbar-thin px-6 py-8">
          {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
          {loading && presentations.length === 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_,i)=><SkeletonCard key={i} />)}
            </div>
          ) : presentations.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {activeTags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2 items-center text-xs">
                  <span className="font-medium text-slate-600">Filtering by:</span>
                  {activeTags.map(t => (
                    <button key={t} onClick={()=>toggleTag(t)} className="px-2 py-1 rounded-full bg-brand-100 text-brand-700 font-medium hover:bg-brand-200">{t} ✕</button>
                  ))}
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {presentationCards}
              </div>
            </>
          )}
          {/* Pagination */}
          <div className="flex gap-2 mt-10 justify-center">
            <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-4 py-2 text-sm rounded-lg border bg-white/70 shadow-sm disabled:opacity-40 hover:bg-white">Prev</button>
            <button disabled={!hasNextPage} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 text-sm rounded-lg border bg-white/70 shadow-sm disabled:opacity-40 hover:bg-white">Next</button>
          </div>
        </section>
      </main>

      {/* Floating Action Button */}
      <Link to="/create" className="fixed bottom-6 right-6 md:hidden inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-600 text-white shadow-elevated hover:bg-brand-500 focus:ring-2 focus:ring-brand-400">
        <PlusIcon className="w-7 h-7" />
      </Link>

      <Toaster position="bottom-right" />
    </div>
  );
};

export default Dashboard;