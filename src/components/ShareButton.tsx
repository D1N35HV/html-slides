import React, { useCallback, useEffect, useRef, useState } from 'react';
import apiService from '../services/ApiService';
import { collaborationService } from '../services/CollaborationService';

interface ShareButtonProps { presentationId: string; token: string; }

// Redesigned share button & popup to match modern UI (toolbar dark background, elevated white panel)
const ShareButton: React.FC<ShareButtonProps> = ({ presentationId, token }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const toggle = () => {
    setOpen(o => !o);
  };

  const connectRealtime = useCallback(() => {
    collaborationService.connect(token);
    collaborationService.joinPresentation(presentationId);
  }, [token, presentationId]);

  // Add collaborator with minimal validation
  const addCollaborator = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setStatus(null);
    try {
      const res = await apiService.addCollaborator(presentationId, email.trim());
      setStatus(res.message || 'Collaborator added');
      setEmail('');
      // Keep realtime active
      connectRealtime();
    } catch (e: any) {
      setStatus(e.message || 'Failed to add');
    } finally {
      setIsLoading(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Enter' && document.activeElement === emailInputRef.current) {
        e.preventDefault();
        addCollaborator();
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, email]);

  // Focus email field when opening
  useEffect(() => {
    if (open && emailInputRef.current) {
      setTimeout(() => emailInputRef.current?.focus(), 10);
    }
  }, [open]);

  const openPanel = () => {
    if (!open) {
      connectRealtime();
      toggle();
    } else {
      toggle();
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={openPanel}
        className="group flex items-center gap-1 px-4 h-9 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 focus:ring-offset-transparent"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg className="w-4 h-4 text-blue-300 group-hover:text-blue-200 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M8 16l4-4m0 0l4-4m-4 4v12" /></svg>
        <span>Share</span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Share presentation"
          className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl border border-gray-200 bg-white shadow-elevated p-5 z-50 animate-fade-in"
        >
          <div className="flex items-start justify-between mb-3">
            <h4 className="font-semibold text-gray-900 text-base">Share Presentation</h4>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Close share panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Invite Section */}
            <div>
              <label className="text-xs font-medium text-gray-600 tracking-wide uppercase mb-1 block">Invite collaborator</label>
              <div className="flex gap-2">
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Collaborator email"
                  disabled={isLoading}
                />
                <button
                  onClick={addCollaborator}
                  disabled={!email.trim() || isLoading}
                  className={`px-3 py-2 rounded-md text-sm font-medium text-white transition-colors ${!email.trim() || isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}`}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-1">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      <span className="sr-only">Adding...</span>
                      Add
                    </div>
                  ) : 'Add'}
                </button>
              </div>
              {status && <p className="text-xs mt-2 text-gray-600" role="status">{status}</p>}
            </div>

            {/* Share Link (placeholder implementation) */}
            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs font-medium text-gray-600 tracking-wide uppercase mb-1 block">Share link</label>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={`${window.location.origin}/presentations/${presentationId}`}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700 focus:outline-none"
                  aria-label="Shareable link"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/presentations/${presentationId}`);
                    setStatus('Link copied');
                  }}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareButton;