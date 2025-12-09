import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Presentation from '../models/Presentation';
import { Types } from 'mongoose';
import { ElementPatch, PresentationPatch, SlidePatch } from '../types/collaboration';

interface AuthUser { id: string; name?: string; email?: string; }

interface RoomState {
  version: number;
  // Keep minimal state for quick merges (could optimize with per-slide map)
  slides: any[];
  // Presence map
  users: Map<string, { socketId: string; lastActive: number; name?: string; color: string }>;
}

const COLOR_POOL = ['#ff5555', '#50fa7b', '#8be9fd', '#bd93f9', '#ff79c6', '#ffb86c', '#69ff94', '#f1fa8c'];

export class CollaborationServer {
  private io: Server;
  private rooms: Map<string, RoomState> = new Map();

  constructor(server: HttpServer, corsOrigins: string[]) {
    this.io = new Server(server, {
      cors: { origin: corsOrigins, credentials: true }
    });
    this.setup();
  }

  private setup() {
    this.io.on('connection', (socket: any) => {
      let authUser: AuthUser | null = null;
      try {
        const token = socket.handshake.auth?.token;
        if (token) {
          const decoded: any = jwt.verify(token, process.env['JWT_SECRET'] || 'secret');
          authUser = { id: decoded.id, name: decoded.name, email: decoded.email };
        }
      } catch (e) {
        socket.emit('error', { message: 'Authentication failed', code: 'AUTH' });
        socket.disconnect();
        return;
      }

      socket.on('join_presentation', async ({ presentationId }: { presentationId: string }) => {
        if (!authUser) return;
        const hasAccess = await this.userHasAccess(presentationId, authUser.id);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied', code: 'NO_ACCESS' });
          return;
        }
        await this.ensureRoomLoaded(presentationId);
        socket.join(presentationId);
        const room = this.rooms.get(presentationId)!;
        const color = this.assignColor(room);
        room.users.set(authUser.id, { socketId: socket.id, lastActive: Date.now(), name: authUser.name || '', color });
        socket.emit('initial_state', { presentationId, version: room.version, slides: room.slides });
        this.io.to(presentationId).emit('presence', { users: Array.from(room.users.entries()).map(([userId, u]) => ({ userId, name: u.name || 'User', color: u.color, lastActive: u.lastActive })) });
      });

      socket.on('patch', async (patch: PresentationPatch, ack: (ack: any) => void) => {
        if (!authUser) return;
        const presentationId = this.findRoomForSocket(socket.id);
        if (!presentationId) return ack({ ok: false, serverVersion: -1 });
        const room = this.rooms.get(presentationId);
        if (!room) return ack({ ok: false, serverVersion: -1 });

        // Basic version check
        if (patch.version !== room.version) {
          return ack({ ok: false, serverVersion: room.version, conflict: true });
        }

        let changed = false;
        if ('elementId' in patch) {
          const elementPatch = patch as ElementPatch;
          const slide = room.slides.find(s => s.id === elementPatch.slideId);
          if (slide) {
            const element = slide.elements.find((e: any) => e.id === elementPatch.elementId);
            if (element) {
              Object.assign(element, elementPatch.changes);
              changed = true;
            }
          }
        } else {
          const slidePatch = patch as SlidePatch;
          const slide = room.slides.find(s => s.id === slidePatch.slideId);
          if (slide) {
            Object.assign(slide, slidePatch.changes);
            changed = true;
          }
        }

        if (changed) {
          room.version += 1;
          // Persist minimal changes (optimistic: update full document portion)
          this.persistRoomDebounced(presentationId);
          this.io.to(presentationId).except(socket.id).emit('remote_patch', { ...patch, serverVersion: room.version });
          ack({ ok: true, serverVersion: room.version });
        } else {
          ack({ ok: false, serverVersion: room.version });
        }
      });

      socket.on('cursor', (pos: any) => {
        if (!authUser) return;
        const presentationId = this.findRoomForSocket(socket.id);
        if (!presentationId) return;
        this.io.to(presentationId).emit('cursor_update', { userId: authUser.id, cursor: pos });
      });

      socket.on('disconnect', () => {
        if (!authUser) return;
        for (const [presentationId, room] of this.rooms.entries()) {
          const user = room.users.get(authUser.id);
          if (user && user.socketId === socket.id) {
            room.users.delete(authUser.id);
            this.io.to(presentationId).emit('presence', { users: Array.from(room.users.entries()).map(([userId, u]) => ({ userId, name: u.name || 'User', color: u.color, lastActive: u.lastActive })) });
            break;
          }
        }
      });
    });
  }

  private async userHasAccess(presentationId: string, userId: string) {
    if (!Types.ObjectId.isValid(presentationId) || !Types.ObjectId.isValid(userId)) return false;
    const doc: any = await Presentation.findById(presentationId).select('createdBy collaborators slides version');
    if (!doc) return false;
    const uid = new Types.ObjectId(userId).toString();
    const createdBy = doc.createdBy.toString();
    const collaborators = (doc.collaborators || []).map((c: any) => c.toString());
    return uid === createdBy || collaborators.includes(uid);
  }

  private async ensureRoomLoaded(presentationId: string) {
    if (this.rooms.has(presentationId)) return;
    const doc: any = await Presentation.findById(presentationId).lean();
    if (!doc) throw new Error('Presentation not found');
    this.rooms.set(presentationId, {
      version: doc.version || 1,
      slides: doc.slides || [],
      users: new Map()
    });
  }

  private findRoomForSocket(socketId: string): string | null {
    for (const [roomId, room] of this.rooms.entries()) {
      for (const u of room.users.values()) {
        if (u.socketId === socketId) return roomId;
      }
    }
    return null;
  }

  private assignColor(room: RoomState): string {
    const used = new Set(Array.from(room.users.values()).map(u => u.color));
    for (const c of COLOR_POOL) if (!used.has(c)) return c;
    return COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)] || '#999999';
  }

  private persistTimers: Map<string, NodeJS.Timeout> = new Map();
  private persistRoomDebounced(presentationId: string) {
    if (this.persistTimers.has(presentationId)) clearTimeout(this.persistTimers.get(presentationId)!);
    this.persistTimers.set(presentationId, setTimeout(() => this.persistRoom(presentationId), 750));
  }

  private async persistRoom(presentationId: string) {
    const room = this.rooms.get(presentationId);
    if (!room) return;
    try {
      await Presentation.updateOne({ _id: presentationId }, { $set: { slides: room.slides, version: room.version, lastModified: new Date() } });
    } catch (e) {
      console.error('Failed to persist presentation', presentationId, e);
    }
  }

  /**
   * Emit PPT conversion progress to a specific user
   * Used for streaming slide-by-slide updates during PPT upload
   */
  emitPPTProgress(userId: string, event: {
    type: 'init' | 'slide' | 'complete' | 'error';
    presentationId?: string;
    theme?: any;
    totalSlides?: number;
    slideIndex?: number;
    slide?: any;
    error?: string;
  }) {
    // Find socket by user ID in any room
    for (const [, room] of this.rooms.entries()) {
      const user = room.users.get(userId);
      if (user) {
        this.io.to(user.socketId).emit('ppt_conversion_progress', event);
        return;
      }
    }
    // If user not in a room, broadcast with targetUserId for filtering on client
    // This handles the case where user is on dashboard, not in a presentation
    this.io.emit('ppt_conversion_progress', { ...event, targetUserId: userId });
  }

  /**
   * Get the socket.io server instance
   */
  getIO() {
    return this.io;
  }
}

export default CollaborationServer;

