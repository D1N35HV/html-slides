import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EllipsisVerticalIcon, ArrowPathIcon, TrashIcon, DocumentDuplicateIcon, LockClosedIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import apiService from '../../services/ApiService';

export interface PresentationSummary {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  isPublic: boolean;
  slideCount?: number;
  updatedAt?: string;
  createdAt?: string;
  createdBy?: { name: string; email: string };
}

interface Props {
  data: PresentationSummary;
  onDeleted(id: string): void;
  onDuplicated?(originalId: string, newItem: PresentationSummary): void;
}

const formatDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';

const PresentationCard: React.FC<Props> = ({ data, onDeleted, onDuplicated }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<'dup'|'del'|null>(null);

  const handleDuplicate = async () => {
    try {
      setBusy('dup');
      const res = await apiService.duplicatePresentation(data._id);
      if (res.success && res.data) {
        onDuplicated?.(data._id, res.data as any);
      }
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this presentation? This cannot be undone.')) return;
    try {
      setBusy('del');
      const res = await apiService.deletePresentation(data._id);
      if (res.success) onDeleted(data._id);
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  };

  const badgeIcon = data.isPublic ? <GlobeAltIcon className="w-3.5 h-3.5"/> : <LockClosedIcon className="w-3.5 h-3.5"/>;

  return (
    <div className="group relative rounded-xl bg-surface-alt/60 backdrop-blur-xs border border-white/40 shadow-soft hover:shadow-elevated transition-all hover:-translate-y-0.5 overflow-hidden">
      {/* Preview / thumbnail placeholder */}
      <button
        onClick={() => navigate(`/editor/${data._id}`)}
        className="relative w-full aspect-[4/3] bg-gradient-to-br from-brand-50 via-white to-brand-100 flex items-center justify-center overflow-hidden"
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        <div className="text-xs font-medium tracking-wide text-brand-700 group-hover:scale-105 transition-transform px-3 py-1.5 bg-white/70 backdrop-blur-xs rounded-md shadow-inner">
          {data.slideCount ?? 0} Slides
        </div>
      </button>

      {/* Content */}
      <div className="p-3 pb-4 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
              {data.title || 'Untitled'}
            </h3>
          </div>
          <div className="relative">
            <button
              aria-label="More"
              onClick={() => setMenuOpen(o=>!o)}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <EllipsisVerticalIcon className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 rounded-lg bg-white border shadow-lg ring-1 ring-black/5 animate-fade-in z-20">
                <ul className="py-1 text-sm">
                  <li>
                    <button onClick={handleDuplicate} disabled={busy==='dup'} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-50">
                      {busy==='dup' ? <ArrowPathIcon className="w-4 h-4 animate-spin"/> : <DocumentDuplicateIcon className="w-4 h-4"/>}
                      Duplicate
                    </button>
                  </li>
                  <li>
                    <button onClick={handleDelete} disabled={busy==='del'} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-red-600 disabled:opacity-50">
                      {busy==='del' ? <ArrowPathIcon className="w-4 h-4 animate-spin"/> : <TrashIcon className="w-4 h-4"/>}
                      Delete
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {data.tags?.slice(0,3).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-medium text-slate-600">{t}</span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
            {badgeIcon}
            {data.isPublic ? 'Public' : 'Private'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wide">
          <span>{formatDate(data.updatedAt) || formatDate(data.createdAt)}</span>
          <button
            onClick={() => navigate(`/editor/${data._id}`)}
            className="px-2 py-1 rounded-md bg-brand-500 text-white text-[11px] font-semibold shadow hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >Open</button>
        </div>
      </div>
    </div>
  );
};

export default PresentationCard;
