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
  // Thread/Reply fields
  parentId?: string;
  threadId?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
  editedAt?: Date;
}

export interface ChatMessage extends Message {
  user: { displayName: string };
  reactions?: MessageReaction[];
  embeds?: MessageEmbed[];
  replyCount?: number;
  isEditing?: boolean; // Client-only
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
  'presence:data': (data: { presence: UserPresence }) => void;
  // Notification events
  'notification:new': (data: { notification: Notification }) => void;
  'notification:read': (data: { notificationId: number }) => void;
  'notification:unread-count': (data: { count: number }) => void;
  'notification:list': (data: { notifications: Notification[] }) => void;
  // DM events
  'dm:channels': (data: { channels: DirectMessageChannel[] }) => void;
  'dm:channel-opened': (data: { channel: DirectMessageChannel }) => void;
  'dm:message': (data: { message: DirectMessage }) => void;
  'dm:history': (data: { channelId: string; messages: DirectMessage[] }) => void;
  'dm:typing': (data: { channelId: string; userId: string; isTyping: boolean }) => void;
  'dm:error': (data: { message: string }) => void;
  // Chat edit/delete events
  'message:edited': (data: { messageId: string; content: string; editedAt: Date }) => void;
  'message:deleted': (data: { messageId: string }) => void;
  // Thread events
  'thread:opened': (data: { thread: MessageThread }) => void;
  'thread:reply': (data: { reply: ChatMessage; replyCount: number }) => void;
  'thread:replies': (data: { replies: ChatMessage[]; hasMore: boolean }) => void;
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
  'presence:status': (data: { status: PresenceStatus }) => void;
  'presence:custom': (data: { customStatus: string | null; statusEmoji?: string | null }) => void;
  'presence:activity': (data: { activity: UserActivity | null }) => void;
  'presence:get': (data: { userId: string }) => void;
  'presence:set': (data: { status: PresenceStatus }) => void;
  'presence:custom-status': (data: { customStatus: string | null }) => void;
  'presence:request': (data: { userIds: string[] }) => void;
  // Notification events
  'notification:get': (data: { limit?: number; offset?: number }) => void;
  'notification:mark-read': (data: { notificationId: number }) => void;
  'notification:mark-all-read': () => void;
  'notification:get-unread-count': () => void;
  // DM events
  'dm:get-channels': () => void;
  'dm:open': (data: { targetUserId: string }) => void;
  'dm:send': (data: { channelId: string; content: string }) => void;
  'dm:history': (data: { channelId: string; cursor?: string; limit?: number }) => void;
  'dm:typing-start': (data: { channelId: string }) => void;
  'dm:typing-stop': (data: { channelId: string }) => void;
  // Message edit/delete events
  'message:edit': (data: { messageId: string; content: string }) => void;
  'message:delete': (data: { messageId: string }) => void;
  // Thread events
  'message:reply': (data: { content: string; parentId: string }) => void;
  'thread:open': (data: { parentMessageId: string }) => void;
  'thread:close': () => void;
  'thread:load-replies': (data: { threadId: string; limit?: number; before?: string }) => void;
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

export type ActivityType = 'watching' | 'playing' | 'listening' | 'streaming';

export interface UserActivity {
  type: ActivityType;
  name: string;
  startedAt?: string;
}

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  customStatus?: string | null;
  statusEmoji?: string | null;
  lastActivity?: UserActivity | null;
  lastSeenAt: Date;
}

export interface UserStatusData {
  userId: string;
  status: PresenceStatus;
  customStatus?: string;
  statusEmoji?: string;
  lastActivity?: UserActivity;
}

export interface NotificationPreferences {
  userId: string;
  allMessages: boolean;
  mentions: boolean;
  directMessages: boolean;
  serverInvites: boolean;
  friendRequests: boolean;
  sounds: boolean;
  desktopNotifications: boolean;
  notificationDuration: number;
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

// ===== Moderation Types =====
export type ModAction = 'warn' | 'mute' | 'kick' | 'ban';

export type Permission = 
  | 'admin' 
  | 'manage_channels' 
  | 'manage_roles' 
  | 'kick_members' 
  | 'ban_members' 
  | 'mute_members' 
  | 'manage_messages'
  | 'view_audit_log'
  | 'manage_server';

// Permissions au niveau du canal
export type ChannelPermission = 
  | 'view_channel'
  | 'manage_channel'
  | 'manage_permissions'
  | 'send_messages'
  | 'manage_messages'
  | 'embed_links'
  | 'attach_files'
  | 'read_message_history'
  | 'use_slash_commands'
  | 'use_voice'
  | 'connect'
  | 'speak'
  | 'mute_members'
  | 'deafen_members'
  | 'move_members'
  | 'stream'
  | 'priority_speaker';

export interface ChannelPermissionOverride {
  id: number;
  channelId: string;
  roleId?: number;
  userId?: string;
  allow: ChannelPermission[];
  deny: ChannelPermission[];
}

export interface Role {
  id: number;
  serverId: string;
  name: string;
  color: string;
  position: number;
  permissions: Permission[];
  isDefault: boolean;
}

export interface ChannelPermission {
  id: number;
  channelId: string;
  roleId: number;
  allow: Permission[];
  deny: Permission[];
}

export interface ModerationLog {
  id: number;
  serverId: string;
  action: ModAction;
  targetUserId: string;
  moderatorId: string;
  reason?: string;
  duration?: number;
  createdAt: Date;
}

export interface ModerationLogWithUsers extends ModerationLog {
  targetUser: { displayName: string };
  moderator: { displayName: string };
}

export interface MutedUser {
  id: number;
  serverId: string;
  userId: string;
  mutedBy: string;
  reason?: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface MutedUserWithDetails extends MutedUser {
  user: { displayName: string };
  mutedByUser: { displayName: string };
}

export interface BannedUser {
  id: number;
  serverId: string;
  userId: string;
  bannedBy: string;
  reason?: string;
  createdAt: Date;
}

export interface BannedUserWithDetails extends BannedUser {
  user: { displayName: string };
  bannedByUser: { displayName: string };
}

export interface AutoModConfig {
  id: number;
  serverId: string;
  enableSpamProtection: boolean;
  enableLinkFilter: boolean;
  enableWordFilter: boolean;
  bannedWords: string[];
  spamThreshold: number;
  muteDuration: number;
}

// ===== Direct Message Types =====
export interface DirectMessageChannel {
  id: string;
  participants: { userId: string; displayName: string }[];
  lastMessage?: DirectMessage;
  createdAt: Date;
}

export interface DirectMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  editedAt?: Date;
  createdAt: Date;
}

// ===== Search Types =====
export interface SearchResult {
  type: 'message' | 'user';
  id: string;
  content?: string;
  displayName?: string;
  serverId?: string;
  channelId?: string;
  roomId?: string;
  createdAt?: Date;
  score: number;
}

export interface SearchFilters {
  query: string;
  servers?: string[];
  channels?: string[];
  users?: string[];
  dateRange?: { from: Date; to: Date };
  hasAttachment?: boolean;
  fromUser?: string;
  inChannel?: string;
  isPinned?: boolean;
  sortBy?: 'relevance' | 'date_desc' | 'date_asc';
}

export interface SearchParams {
  query: string;
  serverId?: string;
  channelId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

// ===== Moderation Socket Events =====
export interface ModerationSocketEvents {
  'mod:warn': (data: { serverId: string; targetId: string; reason: string }) => void;
  'mod:mute': (data: { serverId: string; targetId: string; reason: string; duration?: number }) => void;
  'mod:unmute': (data: { serverId: string; targetId: string }) => void;
  'mod:kick': (data: { serverId: string; targetId: string; reason: string }) => void;
  'mod:ban': (data: { serverId: string; targetId: string; reason: string }) => void;
  'mod:unban': (data: { serverId: string; targetId: string }) => void;
  'mod:get-logs': (data: { serverId: string; limit?: number }) => void;
  'mod:get-muted': (data: { serverId: string }) => void;
  'mod:get-banned': (data: { serverId: string }) => void;
  'mod:get-config': (data: { serverId: string }) => void;
  'mod:update-config': (data: { serverId: string; config: Partial<AutoModConfig> }) => void;
}

export interface ModerationServerEvents {
  'mod:warned': (data: { log: ModerationLogWithUsers }) => void;
  'mod:muted': (data: { mutedUser: MutedUserWithDetails }) => void;
  'mod:unmuted': (data: { serverId: string; userId: string }) => void;
  'mod:kicked': (data: { serverId: string; userId: string; reason: string }) => void;
  'mod:banned': (data: { bannedUser: BannedUserWithDetails }) => void;
  'mod:unbanned': (data: { serverId: string; userId: string }) => void;
  'mod:logs': (data: { logs: ModerationLogWithUsers[] }) => void;
  'mod:muted-users': (data: { mutedUsers: MutedUserWithDetails[] }) => void;
  'mod:banned-users': (data: { bannedUsers: BannedUserWithDetails[] }) => void;
  'mod:config': (data: { config: AutoModConfig }) => void;
  'mod:config-updated': (data: { config: AutoModConfig }) => void;
  'mod:error': (data: { message: string }) => void;
}

// ===== Search Socket Events =====
export interface SearchSocketEvents {
  'search:messages': (data: SearchParams) => void;
  'search:users': (data: { query: string; serverId?: string }) => void;
}

export interface SearchServerEvents {
  'search:results': (data: { results: SearchResult[] }) => void;
  'search:users-results': (data: { users: { id: string; displayName: string }[] }) => void;
  'search:error': (data: { message: string }) => void;
}

// ===== Message Thread Types =====
export interface MessageThread {
  id: string;
  roomId: string;
  parentMessage: ChatMessage;
  replies: ChatMessage[];
  lastReplyAt: Date;
  replyCount: number;
}

// ===== Chat Socket Events (Edit/Delete/Threads) =====
export interface ChatSocketEvents {
  // Existing
  'chat:message': (data: { content: string }) => void;
  'chat:history': (data: { cursor?: string; limit?: number }) => void;
  'chat:typing-start': () => void;
  'chat:typing-stop': () => void;
  
  // New - Edit/Delete
  'message:edit': (data: { messageId: string; content: string }) => void;
  'message:delete': (data: { messageId: string }) => void;
  
  // New - Threads/Replies
  'message:reply': (data: { channelId: string; content: string; parentId: string }) => void;
  'thread:open': (data: { parentMessageId: string }) => void;
  'thread:close': () => void;
  'thread:load-replies': (data: { threadId: string; limit: number; before?: string }) => void;
}

export interface ChatServerEvents {
  // Existing
  'chat:message': (message: ChatMessage) => void;
  'chat:history': (messages: ChatMessage[]) => void;
  'chat:typing': (data: { userId: string; isTyping: boolean }) => void;
  
  // New - Edit/Delete
  'message:edited': (data: { messageId: string; content: string; editedAt: Date }) => void;
  'message:deleted': (data: { messageId: string }) => void;
  
  // New - Threads/Replies
  'thread:opened': (data: { thread: MessageThread }) => void;
  'thread:reply': (data: { reply: ChatMessage; replyCount: number }) => void;
  'thread:replies': (data: { replies: ChatMessage[]; hasMore: boolean }) => void;
}
