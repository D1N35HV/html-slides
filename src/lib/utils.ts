// shadcn-style cn utility: merge Tailwind classes safely
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the server base URL for resolving media file paths.
 * Media files are served from the server root, not from /api.
 */
export function getServerUrl(): string {
  const raw = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';
  return String(raw).replace(/\/api$/, '').replace(/\/+$/, '');
}

/**
 * Resolve a media URL. If the URL is a relative path (starts with /),
 * prepend the server URL. Otherwise, return the URL as-is.
 */
export function resolveMediaUrl(url: string | undefined): string {
  if (!url) return '';
  
  // If it's already an absolute URL (http/https/data), return as-is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  
  // If it's a relative path starting with /, prepend server URL
  if (url.startsWith('/')) {
    return `${getServerUrl()}${url}`;
  }
  
  // Otherwise return as-is
  return url;
}
