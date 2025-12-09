import { io, Socket } from 'socket.io-client';

interface PatchBase { version: number; }
interface ElementPatch extends PatchBase { slideId: string; elementId: string; changes: Record<string, any>; }
interface SlidePatch extends PatchBase { slideId: string; changes: Record<string, any>; }
export type PresentationPatch = ElementPatch | SlidePatch;

type Callback = (ack: { ok: boolean; serverVersion: number; conflict?: boolean }) => void;

class CollaborationService {
  private socket: Socket | null = null;
  private presentationId: string | null = null;
  private version = 0;
  private token: string | null = null;
  private listeners: { remote_patch: ((p: any) => void)[]; presence: ((p: any) => void)[]; cursor_update: ((p: any) => void)[]; ppt_progress: ((p: any) => void)[] } = { remote_patch: [], presence: [], cursor_update: [], ppt_progress: [] };

  onInitialState(cb: (data: { slides: any[]; version: number }) => void) {
    if (this.socket) {
      this.socket.on('initial_state', cb);
    }
  }

  connect(token: string) {
    this.token = token;
    if (this.socket) return;
    const base = (import.meta as any).env?.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001';
    this.socket = io(base, { auth: { token } });
    this.socket.on('initial_state', (data) => { this.version = data.version; });
    this.socket.on('remote_patch', (patch: any) => {
      if (typeof patch.serverVersion === 'number') {
        // Advance local version to stay in sync so subsequent patches aren't rejected
        this.version = patch.serverVersion;
      }
      this.listeners.remote_patch.forEach(l => l(patch));
    });
    this.socket.on('presence', (data) => this.listeners.presence.forEach(l => l(data)));
    this.socket.on('cursor_update', (data) => this.listeners.cursor_update.forEach(l => l(data)));
    this.socket.on('ppt_conversion_progress', (data) => this.listeners.ppt_progress.forEach(l => l(data)));
  }

  joinPresentation(presentationId: string) {
    if (!this.socket) return;
    this.presentationId = presentationId;
    this.socket.emit('join_presentation', { presentationId });
  }

  leavePresentation() {
    if (this.socket && this.presentationId) {
      this.socket.emit('leave_presentation', { presentationId: this.presentationId });
      this.presentationId = null;
    }
  }

  onRemotePatch(cb: (patch: any) => void) { this.listeners.remote_patch.push(cb); }
  onPresence(cb: (presence: any) => void) { this.listeners.presence.push(cb); }
  onCursor(cb: (cursor: any) => void) { this.listeners.cursor_update.push(cb); }

  /**
   * Listen for PPT conversion progress events
   * Used for streaming slide-by-slide updates during PPT upload
   */
  onPPTProgress(cb: (event: {
    type: 'init' | 'slide' | 'complete' | 'error';
    presentationId?: string;
    totalSlides?: number;
    slideIndex?: number;
    slide?: any;
    error?: string;
    targetUserId?: string;
  }) => void) {
    this.listeners.ppt_progress.push(cb);
  }

  sendElementPatch(slideId: string, elementId: string, changes: Record<string, any>, cb?: Callback, _retry = false) {
    if (!this.socket) return;
    const patch: ElementPatch = { slideId, elementId, changes, version: this.version };
    this.socket.emit('patch', patch, (ack: any) => {
      if (ack.ok) {
        this.version = ack.serverVersion;
      } else if (ack.conflict && !_retry) {
        // Update version then retry once
        this.version = ack.serverVersion;
        this.sendElementPatch(slideId, elementId, changes, cb, true);
        return;
      }
      cb?.(ack);
    });
  }

  sendSlidePatch(slideId: string, changes: Record<string, any>, cb?: Callback, _retry = false) {
    if (!this.socket) return;
    const patch: SlidePatch = { slideId, changes, version: this.version };
    this.socket.emit('patch', patch, (ack: any) => {
      if (ack.ok) {
        this.version = ack.serverVersion;
      } else if (ack.conflict && !_retry) {
        this.version = ack.serverVersion;
        this.sendSlidePatch(slideId, changes, cb, true);
        return;
      }
      cb?.(ack);
    });
  }

  updateCursor(slideId: string, x: number, y: number) {
    if (!this.socket) return;
    this.socket.emit('cursor', { slideId, x, y });
  }
}

export const collaborationService = new CollaborationService();
export default collaborationService;
