import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/index.ts';
import { CloudArrowUpIcon, CheckIcon, ExclamationTriangleIcon, UserIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.ts';
import { LoginModal } from './LoginModal.tsx';
import { apiService } from '../services/ApiService.ts';

interface SaveButtonProps {
  className?: string;
  minimal?: boolean; // compact header mode
}

export function SaveButton({ className = '', minimal = false }: SaveButtonProps) {
  const store = useStore();
  const slides = store.slides;
  const getRemotePatch = store.getRemotePatch;
  const { isAuthenticated, user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [statusText, setStatusText] = useState('');
  const lastSignatureRef = useRef<string>('');
  const autoTimerRef = useRef<number | null>(null);
  const inflightRef = useRef<Promise<any> | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const computeSignature = (data: any) => {
    try {
      return JSON.stringify(data);
    } catch {
      return Math.random().toString(36);
    }
  };

  // Build presentation payload (shared)
  const buildPayload = () => {
    const existingTitle = localStorage.getItem('currentPresentationTitle');
    return {
      title: existingTitle || `Presentation ${new Date().toLocaleDateString()}`,
      description: existingTitle ? 'Updated with Slide Builder' : 'Created with Slide Builder',
      slides: slides.map((slide, index) => ({
        id: slide.id,
        title: `Slide ${index + 1}`,
        elements: slide.elements || [],
        backgroundColor: slide.backgroundColor || '#ffffff',
        backgroundImage: slide.backgroundImage || undefined,
        transition: (slide as any).transition || 'slide',
        transitionSpeed: (slide as any).transitionSpeed || 'default',
        order: index
      })),
      theme: 'default',
      isPublic: false,
      tags: ['presentation', 'slides']
    };
  };

  const handleSave = useCallback(async () => {
    if (isSaving) return;

    // Check authentication first
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setStatusText('Saving…');

    try {
      const presentationData = buildPayload();

      // Call API to save presentation
      const result = await apiService.createPresentation(presentationData);
      
  setLastSaved(new Date());
  setDirty(false);
  setStatusText('');

      // Store the presentation ID for future updates
      if (result.data?._id) {
        localStorage.setItem('currentPresentationId', result.data._id);
      }

    } catch (error) {
      console.error('Save error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSaveError(errorMessage);
      setStatusText('Save failed');
      
      toast.error(`Failed to save: ${errorMessage}`, {
        duration: 5000,
        position: 'top-right',
        icon: '❌'
      });
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, isSaving, slides]);

  const handleUpdate = useCallback(async () => {
    const presentationId = localStorage.getItem('currentPresentationId');
    if (!presentationId) {
      // If no ID, create new presentation
      await handleSave();
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setStatusText('Saving…');

    try {
      const presentationData = buildPayload();

      const result = await apiService.updatePresentation(presentationId, presentationData as any);

      if (!result.success) {
        throw new Error(result.message || 'Failed to update presentation');
      }

  setLastSaved(new Date());
  setDirty(false);
  setStatusText('');

      // Persist title once we have it
      if (result.data?.title) {
        localStorage.setItem('currentPresentationTitle', result.data.title);
      }

    } catch (error) {
      console.error('Update error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setSaveError(errorMessage);
      setStatusText('Save failed');
      
      toast.error(`Failed to update: ${errorMessage}`, {
        duration: 5000,
        position: 'top-right',
        icon: '❌'
      });
    } finally {
      setIsSaving(false);
    }
  }, [slides, handleSave]);

  // Auto-save logic (debounced like Canva)
  useEffect(() => {
  if (!isAuthenticated) return; // don't autosave when not logged in
  if (getRemotePatch && getRemotePatch()) return; // skip autosave for remote changes
    const signature = computeSignature(slides);
    if (signature !== lastSignatureRef.current) {
      lastSignatureRef.current = signature;
      setDirty(true);
      setStatusText('Unsaved changes…');
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = window.setTimeout(async () => {
        if (isSaving) return; // skip if a save in progress
        try {
          if (inflightRef.current) return; // a queued save already
          const hasId = !!localStorage.getItem('currentPresentationId');
          inflightRef.current = hasId ? handleUpdate() : handleSave();
          await inflightRef.current;
        } finally {
          inflightRef.current = null;
        }
      }, 2000); // 2s idle
    }
    return () => {
      if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
    };
  }, [slides, isAuthenticated, handleUpdate, handleSave, isSaving, getRemotePatch]);

  // Periodic safety save every 60s if dirty but user keeps typing
  useEffect(() => {
  if (!isAuthenticated) return;
  if (getRemotePatch && getRemotePatch()) return; // skip periodic save for remote changes
    const interval = window.setInterval(() => {
      if (dirty && !isSaving) {
        const hasId = !!localStorage.getItem('currentPresentationId');
        hasId ? handleUpdate() : handleSave();
      }
    }, 60000);
    return () => window.clearInterval(interval);
  }, [dirty, isSaving, isAuthenticated, handleUpdate, handleSave, getRemotePatch]);

  const getSaveButtonContent = () => {
    if (isSaving) {
      return (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          <span>Saving...</span>
        </>
      );
    }

    if (saveError) {
      const hasId = !!localStorage.getItem('currentPresentationId');
      return (
        <>
          <ExclamationTriangleIcon className="w-4 h-4" />
          <span>{hasId ? 'Retry Update' : 'Retry Save'}</span>
        </>
      );
    }

    if (lastSaved) {
      return (
        <>
          <CheckIcon className="w-4 h-4" />
          <span>Update</span>
        </>
      );
    }

    return (
      <>
        <CloudArrowUpIcon className="w-4 h-4" />
        <span>Save to Cloud</span>
      </>
    );
  };

  const handleClick = () => {
    // Check authentication first
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    const presentationId = localStorage.getItem('currentPresentationId');
    // Always try update if we have an ID (even after an error) to avoid duplicate creations
    if (presentationId) {
      handleUpdate();
      return;
    }
    handleSave();
  };

  return (
    <>
  <div className={`flex items-center gap-3 ${className}`}>
        <button
          onClick={handleClick}
          disabled={isSaving}
          className={`
            flex items-center gap-2 px-3 h-9 rounded-md font-medium text-sm transition
            border shadow-sm
            ${isSaving
              ? 'bg-blue-500 text-white border-blue-500 cursor-wait'
              : saveError
              ? 'bg-red-50 text-red-600 border-red-300 hover:bg-red-100'
              : dirty
              ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}
            focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400
          `}
          title={
            !isAuthenticated
              ? 'Please log in to save'
              : saveError 
              ? `Error: ${saveError}` 
              : lastSaved 
              ? `Last saved: ${lastSaved.toLocaleTimeString()}`
              : 'Save presentation to MongoDB'
          }
        >
          {minimal ? (
            // In minimal mode show only relevant icon / short label
            <>
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
              ) : saveError ? (
                <ExclamationTriangleIcon className="w-4 h-4" />
              ) : dirty ? (
                <CloudArrowUpIcon className="w-4 h-4" />
              ) : (
                <CheckIcon className="w-4 h-4" />
              )}
              <span className="sr-only">
                {saveError ? 'Save failed' : isSaving ? 'Saving' : dirty ? 'Unsaved changes' : 'All changes saved'}
              </span>
            </>
          ) : (
            getSaveButtonContent()
          )}
        </button>

        {!minimal && (
          <>
            {/* Authentication Status */}
            {!isAuthenticated && (
              <div className="flex items-center gap-1 text-sm text-amber-600">
                <ExclamationCircleIcon className="w-4 h-4" />
                <span>Login required</span>
              </div>
            )}
            <span className={`text-xs ${saveError ? 'text-red-500' : isSaving ? 'text-blue-600' : dirty ? 'text-amber-600' : 'text-gray-500'}`}>
              {statusText || (lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : (dirty ? 'Unsaved changes…' : ''))}
            </span>
          </>
        )}

        {saveError && (
          <span className="text-sm text-red-500" title={saveError}>
            Save failed
          </span>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </>
  );
}
