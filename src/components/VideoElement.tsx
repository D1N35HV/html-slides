import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store/index';
import { resolveMediaUrl } from '../lib/utils';

interface VideoElementProps {
  elementId: string;
  videoUrl?: string;
}

// Helper to detect if URL is an embed URL (YouTube, Vimeo, etc.)
function isEmbedUrl(url: string): boolean {
  if (!url) return false;
  
  const embedPatterns = [
    /youtube\.com\/embed\//i,
    /youtube-nocookie\.com\/embed\//i,
    /player\.vimeo\.com\/video\//i,
    /dailymotion\.com\/embed\//i,
    /player\.twitch\.tv/i,
    /streamable\.com\/[eos]\//i,
    /facebook\.com\/plugins\/video/i,
    /iframe/i,
  ];
  
  return embedPatterns.some(pattern => pattern.test(url));
}

// Helper to detect if URL is a direct video file
function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
  const urlLower = url.toLowerCase().split('?')[0]; // Remove query params for extension check
  
  return videoExtensions.some(ext => urlLower.endsWith(ext));
}

// Helper to convert watch URLs to embed URLs for known platforms
function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  
  // YouTube watch URL to embed
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }
  
  // Vimeo URL to embed
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  
  return null;
}

export function VideoElement({ elementId, videoUrl }: VideoElementProps) {
  const [currentVideoUrl, setCurrentVideoUrl] = useState(resolveMediaUrl(videoUrl) || '');
  const { setSelectedElement } = useStore();

  useEffect(() => {
    setCurrentVideoUrl(resolveMediaUrl(videoUrl) || '');
  }, [videoUrl]);

  const handleVideoClick = () => {
    setSelectedElement(elementId);
  };

  // Determine how to render the video
  const videoRenderInfo = useMemo(() => {
    if (!currentVideoUrl) {
      return { type: 'none' as const };
    }
    
    // Check if it's a direct video file
    if (isDirectVideoUrl(currentVideoUrl)) {
      return { type: 'video' as const, url: currentVideoUrl };
    }
    
    // Check if it's already an embed URL
    if (isEmbedUrl(currentVideoUrl)) {
      return { type: 'iframe' as const, url: currentVideoUrl };
    }
    
    // Try to convert to embed URL (for YouTube/Vimeo watch URLs)
    const embedUrl = getEmbedUrl(currentVideoUrl);
    if (embedUrl) {
      return { type: 'iframe' as const, url: embedUrl };
    }
    
    // Default: treat as direct video (for uploaded files, etc.)
    return { type: 'video' as const, url: currentVideoUrl };
  }, [currentVideoUrl]);

  const renderVideoContent = () => {
    switch (videoRenderInfo.type) {
      case 'video':
        return (
          <video
            src={videoRenderInfo.url}
            className="w-full h-full object-cover"
            controls
            playsInline
            preload="metadata"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        );
      
      case 'iframe':
        return (
          <iframe
            src={videoRenderInfo.url}
            className="w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Video content"
          />
        );
      
      default:
        return (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl text-gray-400 mb-2">🎥</div>
              <div className="text-sm text-gray-500">Select to edit in sidebar</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div 
      className="w-full h-full cursor-pointer group relative overflow-hidden rounded-lg border-2 border-transparent hover:border-blue-200 transition-all duration-200"
      onClick={handleVideoClick}
    >
      {renderVideoContent()}
      
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-xs text-white bg-black bg-opacity-75 px-2 py-1 rounded transition-opacity duration-200">
        Select to edit
      </div>
    </div>
  );
}
