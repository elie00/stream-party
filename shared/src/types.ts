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
  reactions?: MessageReaction[];
  embeds?: MessageEmbed[];
}

// ===== Message Reaction =====
export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
}

// ===== Message Embed =====
export type EmbedType = 'link' | 'image' | 'video' | 'article';

export interface MessageEmbed {
  id: string;
  messageId: string;
  type: EmbedType;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  createdAt: Date;
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
  // SFU events
  'sfu:joined': (data: { rtpCapabilities: unknown; producers: SfuProducerInfo[] }) => void;
  'sfu:transport-created': (data: SfuTransportData) => void;
  'sfu:transport-connected': (data: { transportId: string }) => void;
  'sfu:produced': (data: { producerId: string }) => void;
  'sfu:consumed': (data: SfuConsumerData) => void;
  'sfu:consumer-resumed': (data: { consumerId: string }) => void;
  'sfu:consumer-paused': (data: { consumerId: string }) => void;
  'sfu:producer-closed': (data: { producerId: string }) => void;
  'sfu:new-producer': (data: SfuProducerInfo) => void;
  'sfu:peer-left': (data: { userId: string }) => void;
  'sfu:error': (data: { message: string }) => void;
  // Voice channel events
  'voice:channels': (data: VoiceChannelWithParticipants[]) => void;
  'voice:channel-created': (data: { channel: VoiceChannel }) => void;
  'voice:channel-deleted': (data: { channelId: string }) => void;
  'voice:joined': (data: VoiceChannelWithParticipants) => void;
  'voice:user-joined': (data: { channelId: string; participant: VoiceChannelParticipant }) => void;
  'voice:user-left': (data: { channelId: string; userId: string }) => void;
  'voice:user-speaking': (data: { channelId: string; userId: string; isSpeaking: boolean }) => void;
  'voice:user-muted': (data: { channelId: string; userId: string; isMuted: boolean }) => void;
  'voice:user-deafened': (data: { channelId: string; userId: string; isDeafened: boolean }) => void;
  'voice:error': (data: { message: string }) => void;
  // Reaction events
  'reaction:added': (data: { messageId: string; reaction: MessageReaction }) => void;
  'reaction:removed': (data: { messageId: string; reactionId: string }) => void;
  // Embed events
  'embed:generated': (data: { messageId: string; embed: MessageEmbed }) => void;
  // Server events
  'server:joined': (data: ServerWithDetails) => void;
  'server:left': (data: { serverId: string }) => void;
  'server:member-joined': (data: { serverId: string; member: ServerMemberWithUser }) => void;
  'server:member-left': (data: { serverId: string; userId: string }) => void;
  'server:channel-created': (data: { serverId: string; channel: Channel }) => void;
  'server:channel-deleted': (data: { serverId: string; channelId: string }) => void;
  'server:error': (data: { message: string }) => void;
  // YouTube events
  'youtube:source': (data: { videoId: string | null }) => void;
  'youtube:time': (data: { time: number }) => void;
  'youtube:play': () => void;
  'youtube:pause': () => void;
  'youtube:seek': (data: { time: number }) => void;
  'youtube:state': (state: YouTubeSyncState) => void;
  // Queue events
  'queue:add': (data: { video: VideoQueueItem }) => void;
  'queue:remove': (data: { videoId: string }) => void;
  'queue:vote': (data: { videoId: string; userId: string; votes: string[] }) => void;
  'queue:sync': (data: { queue: VideoQueueItem[] }) => void;
  // Presence events
  'presence:update': (data: { userId: string; presence: UserPresence }) => void;
  'presence:bulk': (data: { presences: Record<string, UserPresence> }) => void;
  // Notification events
  'notification:new': (data: { notification: Notification }) => void;
  'notification:read': (data: { notificationId: number }) => void;
  'notification:unread-count': (data: { count: number }) => void;
  'notification:list': (data: { notifications: Notification[] }) => void;
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
  // SFU events
  'sfu:join': () => void;
  'sfu:leave': () => void;
  'sfu:create-transport': () => void;
  'sfu:connect-transport': (data: { transportId: string; dtlsParameters: unknown }) => void;
  'sfu:produce': (data: { transportId: string; kind: 'audio' | 'video'; rtpParameters: unknown; appData?: unknown }) => void;
  'sfu:consume': (data: { transportId: string; producerId: string; rtpCapabilities: unknown }) => void;
  'sfu:resume-consumer': (data: { consumerId: string }) => void;
  'sfu:pause-consumer': (data: { consumerId: string }) => void;
  'sfu:close-producer': (data: { producerId: string }) => void;
  // Voice channel events
  'voice:get-channels': () => void;
  'voice:create-channel': (data: { name: string; bitrate?: number }) => void;
  'voice:delete-channel': (data: { channelId: string }) => void;
  'voice:join-channel': (data: { channelId: string }) => void;
  'voice:leave-channel': () => void;
  'voice:push-to-talk-start': () => void;
  'voice:push-to-talk-stop': () => void;
  'voice:toggle-mute': () => void;
  'voice:toggle-deafen': () => void;
  // Reaction events
  'reaction:add': (data: { messageId: string; emoji: string }) => void;
  'reaction:remove': (data: { messageId: string; reactionId: string }) => void;
  // Embed events
  'embed:generate': (data: { messageId: string; url: string }) => void;
  // Server events
  'server:join': (data: { serverId: string }, cb: (res: { success: boolean; error?: string }) => void) => void;
  'server:leave': (data: { serverId: string }) => void;
  // YouTube events
  'youtube:source': (data: { videoId: string | null }) => void;
  'youtube:time': (data: { time: number }) => void;
  'youtube:play': () => void;
  'youtube:pause': () => void;
  'youtube:seek': (data: { time: number }) => void;
  'youtube:state': (state: YouTubeSyncState) => void;
  'youtube:request': () => void;
  // Queue events
  'queue:add': (data: { video: Omit<VideoQueueItem, 'position' | 'votes'> }) => void;
  'queue:remove': (data: { videoId: string }) => void;
  'queue:vote': (data: { videoId: string }) => void;
  'queue:request': () => void;
  // Presence events
  'presence:set': (data: { status: PresenceStatus }) => void;
  'presence:custom-status': (data: { customStatus: string | null }) => void;
  'presence:request': (data: { userIds: string[] }) => void;
  // Notification events
  'notification:get': (data: { limit?: number; offset?: number }) => void;
  'notification:mark-read': (data: { notificationId: number }) => void;
  'notification:mark-all-read': () => void;
  'notification:get-unread-count': () => void;
}

// SFU Types
export interface SfuProducerInfo {
  producerId: string;
  kind: 'audio' | 'video';
  userId: string;
}

export interface SfuTransportData {
  transportId: string;
  iceParameters: unknown;
  iceCandidates: unknown[];
  dtlsParameters: unknown;
}

export interface SfuConsumerData {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: unknown;
}

// Voice Channel Types
export interface VoiceChannel {
  id: string;
  roomId: string;
  name: string;
  position: number;
  bitrate: number;
  createdAt: Date;
}

export interface VoiceChannelParticipant {
  channelId: string;
  userId: string;
  displayName: string;
  socketId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isPushingToTalk: boolean;
  joinedAt: Date;
}

export interface VoiceChannelWithParticipants {
  channel: VoiceChannel;
  participants: VoiceChannelParticipant[];
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
export const MAX_REACTIONS_PER_MESSAGE = 20;

// Common emoji list for reaction picker
export const REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀'];

// ===== Server / Community =====
export interface Server {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  ownerId: string;
  inviteCode: string;
  createdAt: Date;
}

export type ServerRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface ServerMember {
  id: string;
  serverId: string;
  userId: string;
  role: ServerRole;
  joinedAt: Date;
}

export interface ServerMemberWithUser extends ServerMember {
  user: { displayName: string };
}

export type ChannelType = 'text' | 'voice';

export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  position: number;
  topic: string | null;
  createdAt: Date;
}

export interface ServerWithDetails extends Server {
  members: ServerMemberWithUser[];
  channels: Channel[];
}

// ===== Server Validation Schemas =====
export const createServerSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  icon: z.string().url().optional(),
  description: z.string().max(200).optional(),
});

export const joinServerSchema = z.object({
  inviteCode: z.string().length(8),
});

export const createChannelSchema = z.object({
  name: z.string().min(1).max(30).trim(),
  type: z.enum(['text', 'voice']),
  topic: z.string().max(100).optional(),
});

// ===== Server Constants =====
export const SERVER_INVITE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
export const SERVER_INVITE_CODE_LENGTH = 8;

// ===== File Attachment =====
export type FileAttachmentType = 'upload' | 'torrent';

export interface FileAttachment {
  id: string;
  messageId: string | null;
  uploaderId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: FileAttachmentType;
  url: string | null;
  magnetUri: string | null;
  thumbnailPath: string | null;
  createdAt: Date;
}

export interface FileAttachmentWithUploader extends FileAttachment {
  uploader: { displayName: string };
}

// ===== File Upload Constants =====
export const MAX_FILE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

// ===== YouTube Types =====
export type VideoSource = 'torrent' | 'file' | 'youtube';

export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  channel: string;
  addedBy: string;
  addedAt: number;
}

export interface VideoQueueItem extends YouTubeVideo {
  position: number;
  votes: string[]; // user IDs
}

export interface YouTubeMetadata {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  channel: string;
  viewCount: number;
}

export interface YouTubeStream {
  url: string;
  quality: string;
  mimeType: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  channel: string;
  viewCount: number;
}

// ===== YouTube Sync Events =====
export interface YouTubeSyncState {
  videoId: string | null;
  currentTime: number;
  isPlaying: boolean;
  timestamp: number;
}

export interface YouTubeSyncEvents {
  'youtube:source': { videoId: string; roomId: string };
  'youtube:time': { time: number; roomId: string };
  'youtube:play': { roomId: string };
  'youtube:pause': { roomId: string };
  'youtube:seek': { time: number; roomId: string };
}

export interface QueueSyncEvents {
  'queue:add': { video: VideoQueueItem; roomId: string };
  'queue:remove': { videoId: string; roomId: string };
  'queue:vote': { videoId: string; userId: string; roomId: string };
  'queue:sync': { queue: VideoQueueItem[]; roomId: string };
}

// ===== Presence Types =====
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string | null;
  lastSeenAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  enableDesktop: boolean;
  enableSound: boolean;
  enableMentions: boolean;
  enableDirectMessages: boolean;
  mutedServers: string[];
  mutedChannels: string[];
}

// ===== Notification Types =====
export type NotificationType = 'mention' | 'reply' | 'reaction' | 'join' | 'file' | 'system';

export interface Notification {
  id: number;
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  content?: string;
  data?: Record<string, unknown>;
}
