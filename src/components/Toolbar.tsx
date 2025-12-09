import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useStore } from '../store';
import {
  Bars3Icon,
  DocumentIcon,
  ArrowsPointingOutIcon,
  PencilIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  EyeIcon,
  HomeIcon,
  ShareIcon,
  ChevronDownIcon,
  StarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import ShareButton from './ShareButton';
import collaborationService from '../services/CollaborationService';

export function Toolbar() {
  const { 
    addSlide, 
    removeSlide, 
    currentSlide, 
    setCurrentSlide, 
    slides,
    undo,
    redo,
    canUndo,
    canRedo
  } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showResizeMenu, setShowResizeMenu] = useState(false);
  const [showEditingMenu, setShowEditingMenu] = useState(false);
  const [collaboratorCount, setCollaboratorCount] = useState(1);
  
  // Try to extract presentation id from URL (editor route /editor/:id)
  const match = location.pathname.match(/editor\/(.+)$/);
  const presentationId = match ? match[1] : localStorage.getItem('currentPresentationId');
  const presentationTitle = localStorage.getItem('currentPresentationTitle') || 'Grey Minimalist Professional Project Presentation';
  const token = (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const handlePresent = () => {
    if (presentationId) {
      navigate(`/present/${presentationId}`);
    }
  };

  const handleHome = () => {
    navigate('/');
  };

  const handleUndo = () => {
    if (canUndo) {
      undo();
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      redo();
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z for redo
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [canUndo, canRedo]);

  useEffect(() => {
    const handlePresence = (data: { users: any[] }) => {
      setCollaboratorCount(data.users.length);
    };
    collaborationService.onPresence(handlePresence);
    if (presentationId && token) {
      collaborationService.connect(token);
      collaborationService.joinPresentation(presentationId);
    }
    return () => {
      // No off/unsubscribe in current service, so nothing to clean up
    };
  }, [presentationId, token]);

  return (
    <div className="h-16 flex items-center justify-between px-4 bg-gradient-to-r from-purple-600 via-blue-600 to-teal-500 text-white shadow-lg relative">
      {/* Left section - Menu and Actions */}
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <Bars3Icon className="w-6 h-6" />
        </button>

        {/* Home */}
        <button 
          onClick={handleHome}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          title="Home"
          aria-label="Go to Home"
        >
          <HomeIcon className="w-5 h-5" />
        </button>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 ml-4">
          <button 
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-2 rounded-lg transition-colors ${
              canUndo 
                ? 'hover:bg-white/10 text-white' 
                : 'text-white/40 cursor-not-allowed'
            }`} 
            title="Undo (Ctrl+Z)"
          >
            <ArrowUturnLeftIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={handleRedo}
            disabled={!canRedo}
            className={`p-2 rounded-lg transition-colors ${
              canRedo 
                ? 'hover:bg-white/10 text-white' 
                : 'text-white/40 cursor-not-allowed'
            }`} 
            title="Redo (Ctrl+Y)"
          >
            <ArrowUturnRightIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center section - Presentation Title */}
      <div className="flex-1 flex justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold truncate max-w-md">{presentationTitle}</h1>
        </div>
      </div>

      {/* Right section - Actions */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-white/70">
          <span className="font-bold">{collaboratorCount}</span>
          <span>editing</span>
        </div>
        
        <button 
          onClick={handlePresent}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          disabled={!presentationId}
        >
          <EyeIcon className="w-4 h-4" />
          Present
        </button>
        
        {presentationId && (
          <ShareButton presentationId={presentationId} token={token} />
        )}

        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-sm font-semibold">
          DV
        </div>
      </div>
    </div>
  );
}