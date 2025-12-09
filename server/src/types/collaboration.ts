export interface CursorPosition {
  slideId: string;
  x: number;
  y: number;
}

export interface UserPresence {
  userId: string;
  name: string;
  color: string; // assigned client-side for differentiation
  lastActive: number;
  cursor?: CursorPosition;
}

export interface ElementPatch {
  slideId: string;
  elementId: string;
  // Minimal patch of changed fields; server merges
  changes: Record<string, any>;
  version: number; // client base version used when editing
}

export interface SlidePatch {
  slideId: string;
  changes: Record<string, any>;
  version: number;
}

export type PresentationPatch = ElementPatch | SlidePatch;

export interface ServerAck {
  ok: boolean;
  serverVersion: number;
  conflict?: boolean;
  resolvedState?: any; // if conflict resolved by server, send authoritative element/slide
}

export interface CollaborationEvents {
  // Client -> Server
  join_presentation: (data: { presentationId: string }) => void;
  leave_presentation: (data: { presentationId: string }) => void;
  patch: (data: PresentationPatch, callback: (ack: ServerAck) => void) => void;
  cursor: (data: CursorPosition) => void;
  presence_ping: () => void;

  // Server -> Client
  initial_state: (data: { presentationId: string; version: number; slides: any[] }) => void;
  presence: (data: { users: UserPresence[] }) => void;
  user_joined: (data: UserPresence) => void;
  user_left: (data: { userId: string }) => void;
  remote_patch: (data: PresentationPatch & { serverVersion: number }) => void;
  cursor_update: (data: { userId: string; cursor: CursorPosition }) => void;
  error: (data: { message: string; code?: string }) => void;
}
