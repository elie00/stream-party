import { z } from 'zod';

// ===== User =====
export interface User {
  id: string;
  displayName: string;
  isGuest: boolean;
  createdAt: Date;
}

export const guestAuthSchema = z.object({
  displayName: z.string().min(1).max(30).trim(),
});

// ===== Room =====
export interface Room {
  id: string;
  code: string;
  name: string;
  hostId: string;
  magnetUri: string | null;
  selectedFileIndex: number | null;
  isActive: boolean;
  maxParticipants: number;
  createdAt: Date;
}

export const createRoomSchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

export const joinRoomSchema = z.object({
  code: z.string().length(6),
});

// ===== Message =====
export interface Message {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface ChatMessage extends Message {
  user: { displayName: string };
}

// ===== Sync =====
export interface SyncState {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  timestamp: number; // Date.now() when state was captured
  magnetUri: string | null;
  selectedFileIndex: number | null;
}

// ===== Socket Events =====
export interface ServerToClientEvents {
  'room:state': (room: RoomState) => void;
  'room:user-joined': (user: RoomParticipant) => void;
  'room:user-left': (userId: string) => void;
  'room:host-changed': (hostId: string) => void;
  'room:magnet-changed': (data: { magnetUri: string; selectedFileIndex: number | null }) => void;
  'room:file-selected': (fileIndex: number) => void;
  'sync:state': (state: SyncState) => void;
  'sync:play': (time: number) => void;
  'sync:pause': (time: number) => void;
  'sync:seek': (time: number) => void;
  'sync:buffer': (isBuffering: boolean) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:history': (messages: ChatMessage[]) => void;
  'chat:typing': (data: { userId: string; isTyping: boolean }) => void;
  'rtc:offer': (data: { from: string; signal: unknown }) => void;
  'rtc:answer': (data: { from: string; signal: unknown }) => void;
  'rtc:ice-candidate': (data: { from: string; signal: unknown }) => void;
  'rtc:user-joined-call': (userId: string) => void;
  'rtc:user-left-call': (userId: string) => void;
  'error': (message: string) => void;
}

export interface ClientToServerEvents {
  'room:join': (data: { code: string }, cb: (res: { success: boolean; error?: string }) => void) => void;
  'room:leave': () => void;
  'room:set-magnet': (data: { magnetUri: string }) => void;
  'room:select-file': (data: { fileIndex: number }) => void;
  'sync:state': (state: SyncState) => void;
  'sync:play': (time: number) => void;
  'sync:pause': (time: number) => void;
  'sync:seek': (time: number) => void;
  'sync:buffer': (isBuffering: boolean) => void;
  'sync:request': () => void;
  'chat:message': (data: { content: string }) => void;
  'chat:history': (data: { cursor?: string; limit?: number }) => void;
  'chat:typing-start': () => void;
  'chat:typing-stop': () => void;
  'rtc:offer': (data: { to: string; signal: unknown }) => void;
  'rtc:answer': (data: { to: string; signal: unknown }) => void;
  'rtc:ice-candidate': (data: { to: string; signal: unknown }) => void;
  'rtc:join-call': () => void;
  'rtc:leave-call': () => void;
}

export interface RoomParticipant {
  userId: string;
  displayName: string;
  joinedAt: Date;
  isHost: boolean;
  inCall: boolean;
}

export interface RoomState {
  code: string;
  name: string;
  hostId: string;
  magnetUri: string | null;
  selectedFileIndex: number | null;
  participants: RoomParticipant[];
}

// ===== Constants =====
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
export const ROOM_CODE_LENGTH = 6;
export const MAX_PARTICIPANTS = 6;
export const SYNC_INTERVAL_MS = 1500;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const CHAT_RATE_LIMIT = { maxMessages: 5, windowMs: 3000 };
