import { pgTable, text, boolean, timestamp, integer, uuid, serial, jsonb, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
  isGuest: boolean('is_guest').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  hostId: uuid('host_id').notNull().references(() => users.id),
  magnetUri: text('magnet_uri'),
  selectedFileIndex: integer('selected_file_index'),
  isActive: boolean('is_active').notNull().default(true),
  maxParticipants: integer('max_participants').notNull().default(6),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Thread/Reply fields
  parentId: uuid('parent_id'), // Pour les replies
  threadId: uuid('thread_id'), // Pour identifier le thread
  isDeleted: boolean('is_deleted').default(false), // Soft delete
  deletedAt: timestamp('deleted_at'),
  editedAt: timestamp('edited_at'),
});

export const messageReactions = pgTable('message_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  emoji: text('emoji').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const messageEmbeds = pgTable('message_embeds', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'link', 'image', 'video', 'article'
  url: text('url').notNull(),
  title: text('title'),
  description: text('description'),
  image: text('image'),
  siteName: text('site_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ===== Message Threads =====
export const messageThreads = pgTable('message_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  parentMessageId: uuid('parent_message_id').notNull().references(() => messages.id),
  lastReplyAt: timestamp('last_reply_at').defaultNow(),
  replyCount: integer('reply_count').default(0),
});

export const roomParticipants = pgTable('room_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
});

export const voiceChannels = pgTable('voice_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  name: text('name').notNull(),
  position: integer('position').default(0),
  bitrate: integer('bitrate').default(64000),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const voiceChannelParticipants = pgTable('voice_channel_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => voiceChannels.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  socketId: text('socket_id').notNull(),
  isMuted: boolean('is_muted').notNull().default(true),
  isDeafened: boolean('is_deafened').notNull().default(false),
  isPushingToTalk: boolean('is_pushing_to_talk').notNull().default(false),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

// ===== Servers / Communities =====
export const servers = pgTable('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  icon: text('icon'), // URL de l'icône
  description: text('description'),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const serverMembers = pgTable('server_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: text('role').notNull().default('member'), // 'owner', 'admin', 'moderator', 'member'
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'text', 'voice'
  position: integer('position').default(0),
  topic: text('topic'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ===== File Attachments =====
export const fileAttachments = pgTable('file_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
  uploaderId: uuid('uploader_id').notNull().references(() => users.id),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(), // en bytes
  type: text('type').notNull(), // 'upload', 'torrent'
  url: text('url'), // URL pour les uploads directs
  magnetUri: text('magnet_uri'), // Magnet URI pour WebTorrent
  thumbnailPath: text('thumbnail_path'), // Chemin vers la miniature
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ===== YouTube Video Queue =====
export const videoQueue = pgTable('video_queue', {
  id: serial('id').primaryKey(),
  roomId: uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  videoId: varchar('video_id', { length: 20 }).notNull(), // YouTube video ID
  title: varchar('title', { length: 255 }).notNull(),
  thumbnail: text('thumbnail'),
  duration: integer('duration'), // in seconds
  channel: varchar('channel', { length: 255 }),
  addedBy: uuid('added_by').notNull().references(() => users.id),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  position: integer('position').notNull(),
  votes: jsonb('votes').$type<string[]>().default([]),
  isPlaying: boolean('is_playing').notNull().default(false),
});

// ===== User Presence =====
export const userPresence = pgTable('user_presence', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  status: varchar('status', { length: 20 }).default('online'), // online, idle, dnd, offline
  customStatus: varchar('custom_status', { length: 100 }),
  lastSeenAt: timestamp('last_seen_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ===== Notifications =====
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // mention, reply, reaction, join, file, system
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  data: jsonb('data').$type<Record<string, unknown>>(),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===== Moderation - Roles =====
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  serverId: uuid('server_id').references(() => servers.id).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  color: varchar('color', { length: 7 }).default('#99AAB5'),
  position: integer('position').default(0),
  permissions: jsonb('permissions').$type<string[]>().default([]),
  isDefault: boolean('is_default').default(false),
});

// ===== Moderation - Channel Permissions =====
export const channelPermissions = pgTable('channel_permissions', {
  id: serial('id').primaryKey(),
  channelId: uuid('channel_id').references(() => channels.id).notNull(),
  roleId: integer('role_id').references(() => roles.id).notNull(),
  allow: jsonb('allow').$type<string[]>().default([]),
  deny: jsonb('deny').$type<string[]>().default([]),
});

// ===== Moderation - Logs =====
export const moderationLogs = pgTable('moderation_logs', {
  id: serial('id').primaryKey(),
  serverId: uuid('server_id').references(() => servers.id).notNull(),
  action: varchar('action', { length: 20 }).notNull(), // warn, mute, kick, ban
  targetUserId: uuid('target_user_id').notNull(),
  moderatorId: uuid('moderator_id').notNull(),
  reason: text('reason'),
  duration: integer('duration'), // pour mute temporaire (en minutes)
  createdAt: timestamp('created_at').defaultNow(),
});

// ===== Moderation - Muted Users =====
export const mutedUsers = pgTable('muted_users', {
  id: serial('id').primaryKey(),
  serverId: uuid('server_id').references(() => servers.id).notNull(),
  userId: uuid('user_id').notNull(),
  mutedBy: uuid('muted_by').notNull(),
  reason: text('reason'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===== Moderation - Banned Users =====
export const bannedUsers = pgTable('banned_users', {
  id: serial('id').primaryKey(),
  serverId: uuid('server_id').references(() => servers.id).notNull(),
  userId: uuid('user_id').notNull(),
  bannedBy: uuid('banned_by').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ===== Moderation - Auto-Mod Config =====
export const autoModConfig = pgTable('auto_mod_config', {
  id: serial('id').primaryKey(),
  serverId: uuid('server_id').references(() => servers.id).notNull().unique(),
  enableSpamProtection: boolean('enable_spam_protection').default(true),
  enableLinkFilter: boolean('enable_link_filter').default(false),
  enableWordFilter: boolean('enable_word_filter').default(false),
  bannedWords: jsonb('banned_words').$type<string[]>().default([]),
  spamThreshold: integer('spam_threshold').default(5), // messages en 10 secondes
  muteDuration: integer('mute_duration').default(10), // minutes
});

// ===== Direct Messages =====
export const directMessageChannels = pgTable('direct_message_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const directMessageParticipants = pgTable('direct_message_participants', {
  id: serial('id').primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => directMessageChannels.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
});

export const directMessages = pgTable('direct_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => directMessageChannels.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  editedAt: timestamp('edited_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ===== Notification Preferences =====
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  enableDesktop: boolean('enable_desktop').default(true),
  enableSound: boolean('enable_sound').default(true),
  enableMentions: boolean('enable_mentions').default(true),
  enableDirectMessages: boolean('enable_direct_messages').default(true),
  mutedServers: jsonb('muted_servers').$type<string[]>().default([]),
  mutedChannels: jsonb('muted_channels').$type<string[]>().default([]),
});

// ===== Relations =====
export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  voiceChannelParticipants: many(voiceChannelParticipants),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  messages: many(messages),
  voiceChannels: many(voiceChannels),
  videoQueue: many(videoQueue),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
  reactions: many(messageReactions),
  embeds: many(messageEmbeds),
  attachments: many(fileAttachments),
  parent: one(messages, {
    fields: [messages.parentId],
    references: [messages.id],
  }),
  replies: many(messages, {
    references: [(messages) => messages.parentId],
  }),
}));

export const messageReactionsRelations = relations(messageReactions, ({ one }) => ({
  message: one(messages, {
    fields: [messageReactions.messageId],
    references: [messages.id],
  }),
  user: one(users, {
    fields: [messageReactions.userId],
    references: [users.id],
  }),
}));

export const messageEmbedsRelations = relations(messageEmbeds, ({ one }) => ({
  message: one(messages, {
    fields: [messageEmbeds.messageId],
    references: [messages.id],
  }),
}));

// Message Threads relations
export const messageThreadsRelations = relations(messageThreads, ({ one }) => ({
  room: one(rooms, {
    fields: [messageThreads.roomId],
    references: [rooms.id],
  }),
  parentMessage: one(messages, {
    fields: [messageThreads.parentMessageId],
    references: [messages.id],
  }),
}));

export const voiceChannelsRelations = relations(voiceChannels, ({ one, many }) => ({
  room: one(rooms, {
    fields: [voiceChannels.roomId],
    references: [rooms.id],
  }),
  participants: many(voiceChannelParticipants),
}));

export const voiceChannelParticipantsRelations = relations(voiceChannelParticipants, ({ one }) => ({
  channel: one(voiceChannels, {
    fields: [voiceChannelParticipants.channelId],
    references: [voiceChannels.id],
  }),
  user: one(users, {
    fields: [voiceChannelParticipants.userId],
    references: [users.id],
  }),
}));

// Server relations
export const serversRelations = relations(servers, ({ one, many }) => ({
  owner: one(users, {
    fields: [servers.ownerId],
    references: [users.id],
  }),
  members: many(serverMembers),
  channels: many(channels),
}));

export const serverMembersRelations = relations(serverMembers, ({ one }) => ({
  server: one(servers, {
    fields: [serverMembers.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [serverMembers.userId],
    references: [users.id],
  }),
}));

export const channelsRelations = relations(channels, ({ one }) => ({
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
}));

// File Attachments relations
export const fileAttachmentsRelations = relations(fileAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [fileAttachments.messageId],
    references: [messages.id],
  }),
  uploader: one(users, {
    fields: [fileAttachments.uploaderId],
    references: [users.id],
  }),
}));

// Video Queue relations
export const videoQueueRelations = relations(videoQueue, ({ one }) => ({
  room: one(rooms, {
    fields: [videoQueue.roomId],
    references: [rooms.id],
  }),
  addedByUser: one(users, {
    fields: [videoQueue.addedBy],
    references: [users.id],
  }),
}));

// User Presence relations
export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, {
    fields: [userPresence.userId],
    references: [users.id],
  }),
}));

// Notification Preferences relations
export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

// Notifications relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Moderation - Roles relations
export const rolesRelations = relations(roles, ({ one, many }) => ({
  server: one(servers, {
    fields: [roles.serverId],
    references: [servers.id],
  }),
  channelPermissions: many(channelPermissions),
}));

// Moderation - Channel Permissions relations
export const channelPermissionsRelations = relations(channelPermissions, ({ one }) => ({
  channel: one(channels, {
    fields: [channelPermissions.channelId],
    references: [channels.id],
  }),
  role: one(roles, {
    fields: [channelPermissions.roleId],
    references: [roles.id],
  }),
}));

// Moderation - Logs relations
export const moderationLogsRelations = relations(moderationLogs, ({ one }) => ({
  server: one(servers, {
    fields: [moderationLogs.serverId],
    references: [servers.id],
  }),
}));

// Moderation - Muted Users relations
export const mutedUsersRelations = relations(mutedUsers, ({ one }) => ({
  server: one(servers, {
    fields: [mutedUsers.serverId],
    references: [servers.id],
  }),
}));

// Moderation - Banned Users relations
export const bannedUsersRelations = relations(bannedUsers, ({ one }) => ({
  server: one(servers, {
    fields: [bannedUsers.serverId],
    references: [servers.id],
  }),
}));

// Moderation - Auto-Mod Config relations
export const autoModConfigRelations = relations(autoModConfig, ({ one }) => ({
  server: one(servers, {
    fields: [autoModConfig.serverId],
    references: [servers.id],
  }),
}));

// Direct Message relations
export const directMessageChannelsRelations = relations(directMessageChannels, ({ many }) => ({
  participants: many(directMessageParticipants),
  messages: many(directMessages),
}));

export const directMessageParticipantsRelations = relations(directMessageParticipants, ({ one }) => ({
  channel: one(directMessageChannels, {
    fields: [directMessageParticipants.channelId],
    references: [directMessageChannels.id],
  }),
  user: one(users, {
    fields: [directMessageParticipants.userId],
    references: [users.id],
  }),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  channel: one(directMessageChannels, {
    fields: [directMessages.channelId],
    references: [directMessageChannels.id],
  }),
  sender: one(users, {
    fields: [directMessages.senderId],
    references: [users.id],
  }),
}));
