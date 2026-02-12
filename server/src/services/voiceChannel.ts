/**
 * Voice Channel Service
 * Manages persistent voice channels with push-to-talk support
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { voiceChannels, voiceChannelParticipants, users } from '../db/schema';
import { mediasoupService } from './mediasoup';
import { logger } from '../utils/logger';

// Types
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

export interface VoiceChannelState {
  channel: VoiceChannel;
  participants: VoiceChannelParticipant[];
}

// In-memory state for active voice channels
// Map<channelId, Map<socketId, ParticipantState>>
const activeVoiceChannels = new Map<string, Map<string, {
  userId: string;
  displayName: string;
  socketId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isPushingToTalk: boolean;
  joinedAt: Date;
}>>();

// Map<socketId, channelId> for quick lookup
const socketToChannel = new Map<string, string>();

class VoiceChannelService {
  /**
   * Create a default voice channel for a room
   */
  async createDefaultChannel(roomId: string): Promise<VoiceChannel> {
    const [channel] = await db.insert(voiceChannels).values({
      roomId,
      name: 'Général',
      position: 0,
      bitrate: 64000,
    }).returning();

    logger.info(`Created default voice channel for room ${roomId}`, { channelId: channel.id });
    
    return {
      id: channel.id,
      roomId: channel.roomId,
      name: channel.name,
      position: channel.position ?? 0,
      bitrate: channel.bitrate ?? 64000,
      createdAt: channel.createdAt,
    };
  }

  /**
   * Create a new voice channel
   */
  async createChannel(roomId: string, name: string, position: number = 0, bitrate: number = 64000): Promise<VoiceChannel> {
    const [channel] = await db.insert(voiceChannels).values({
      roomId,
      name,
      position,
      bitrate,
    }).returning();

    logger.info(`Created voice channel ${name} in room ${roomId}`, { channelId: channel.id });

    return {
      id: channel.id,
      roomId: channel.roomId,
      name: channel.name,
      position: channel.position ?? 0,
      bitrate: channel.bitrate ?? 64000,
      createdAt: channel.createdAt,
    };
  }

  /**
   * Get all voice channels for a room
   */
  async getChannelsForRoom(roomId: string): Promise<VoiceChannel[]> {
    const channels = await db.query.voiceChannels.findMany({
      where: eq(voiceChannels.roomId, roomId),
      orderBy: (channels, { asc }) => [asc(channels.position)],
    });

    return channels.map(channel => ({
      id: channel.id,
      roomId: channel.roomId,
      name: channel.name,
      position: channel.position ?? 0,
      bitrate: channel.bitrate ?? 64000,
      createdAt: channel.createdAt,
    }));
  }

  /**
   * Get a voice channel by ID
   */
  async getChannel(channelId: string): Promise<VoiceChannel | null> {
    const channel = await db.query.voiceChannels.findFirst({
      where: eq(voiceChannels.id, channelId),
    });

    if (!channel) return null;

    return {
      id: channel.id,
      roomId: channel.roomId,
      name: channel.name,
      position: channel.position ?? 0,
      bitrate: channel.bitrate ?? 64000,
      createdAt: channel.createdAt,
    };
  }

  /**
   * Delete a voice channel
   */
  async deleteChannel(channelId: string): Promise<void> {
    // Remove all participants from memory
    activeVoiceChannels.delete(channelId);

    // Delete from database
    await db.delete(voiceChannels).where(eq(voiceChannels.id, channelId));

    logger.info(`Deleted voice channel ${channelId}`);
  }

  /**
   * Join a voice channel
   */
  async joinChannel(
    channelId: string,
    userId: string,
    displayName: string,
    socketId: string,
  ): Promise<VoiceChannelState> {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error(`Voice channel ${channelId} not found`);
    }

    // Initialize channel in memory if needed
    if (!activeVoiceChannels.has(channelId)) {
      activeVoiceChannels.set(channelId, new Map());
    }

    const channelParticipants = activeVoiceChannels.get(channelId)!;

    // Check if user is already in this channel
    const existingParticipant = Array.from(channelParticipants.values())
      .find(p => p.userId === userId);
    
    if (existingParticipant) {
      // Remove old socket connection
      channelParticipants.delete(existingParticipant.socketId);
      socketToChannel.delete(existingParticipant.socketId);
    }

    // Leave any other voice channel first
    await this.leaveAllChannels(socketId);

    // Add participant
    const participant = {
      userId,
      displayName,
      socketId,
      isMuted: true, // Start muted (push-to-talk)
      isDeafened: false,
      isPushingToTalk: false,
      joinedAt: new Date(),
    };

    channelParticipants.set(socketId, participant);
    socketToChannel.set(socketId, channelId);

    // Create mediasoup room for this channel if not exists
    await mediasoupService.createRoom(channelId);
    
    // Add peer to mediasoup
    await mediasoupService.addPeer(channelId, userId, socketId);

    logger.info(`User ${displayName} joined voice channel ${channel.name}`, { channelId, userId, socketId });

    return this.getChannelState(channelId);
  }

  /**
   * Leave a voice channel
   */
  async leaveChannel(socketId: string): Promise<{ channelId: string; state: VoiceChannelState | null } | null> {
    const channelId = socketToChannel.get(socketId);
    if (!channelId) return null;

    const channelParticipants = activeVoiceChannels.get(channelId);
    if (!channelParticipants) return null;

    const participant = channelParticipants.get(socketId);
    if (!participant) return null;

    // Remove from memory
    channelParticipants.delete(socketId);
    socketToChannel.delete(socketId);

    // Remove from mediasoup
    await mediasoupService.removePeer(channelId, socketId);

    logger.info(`User ${participant.displayName} left voice channel`, { channelId, userId: participant.userId });

    // Get updated state
    const state = this.getChannelState(channelId);

    return { channelId, state };
  }

  /**
   * Leave all voice channels (for disconnect)
   */
  async leaveAllChannels(socketId: string): Promise<string[]> {
    const channelId = socketToChannel.get(socketId);
    if (!channelId) return [];

    const result = await this.leaveChannel(socketId);
    return result ? [result.channelId] : [];
  }

  /**
   * Set push-to-talk state
   */
  async setPushToTalk(socketId: string, isPushing: boolean): Promise<{
    channelId: string;
    userId: string;
    isPushingToTalk: boolean;
  } | null> {
    const channelId = socketToChannel.get(socketId);
    if (!channelId) return null;

    const channelParticipants = activeVoiceChannels.get(channelId);
    if (!channelParticipants) return null;

    const participant = channelParticipants.get(socketId);
    if (!participant) return null;

    participant.isPushingToTalk = isPushing;
    
    // When pushing to talk, unmute; when releasing, mute
    participant.isMuted = !isPushing;

    logger.debug(`Push-to-talk ${isPushing ? 'active' : 'inactive'} for user ${participant.displayName}`, {
      channelId,
      userId: participant.userId,
    });

    return {
      channelId,
      userId: participant.userId,
      isPushingToTalk: isPushing,
    };
  }

  /**
   * Set mute state
   */
  async setMute(socketId: string, isMuted: boolean): Promise<{
    channelId: string;
    userId: string;
    isMuted: boolean;
  } | null> {
    const channelId = socketToChannel.get(socketId);
    if (!channelId) return null;

    const channelParticipants = activeVoiceChannels.get(channelId);
    if (!channelParticipants) return null;

    const participant = channelParticipants.get(socketId);
    if (!participant) return null;

    participant.isMuted = isMuted;

    logger.debug(`Mute state changed for user ${participant.displayName}`, {
      channelId,
      userId: participant.userId,
      isMuted,
    });

    return {
      channelId,
      userId: participant.userId,
      isMuted,
    };
  }

  /**
   * Set deafen state
   */
  async setDeafen(socketId: string, isDeafened: boolean): Promise<{
    channelId: string;
    userId: string;
    isDeafened: boolean;
  } | null> {
    const channelId = socketToChannel.get(socketId);
    if (!channelId) return null;

    const channelParticipants = activeVoiceChannels.get(channelId);
    if (!channelParticipants) return null;

    const participant = channelParticipants.get(socketId);
    if (!participant) return null;

    participant.isDeafened = isDeafened;

    logger.debug(`Deafen state changed for user ${participant.displayName}`, {
      channelId,
      userId: participant.userId,
      isDeafened,
    });

    return {
      channelId,
      userId: participant.userId,
      isDeafened,
    };
  }

  /**
   * Get current state of a voice channel
   */
  getChannelState(channelId: string): VoiceChannelState {
    const channelParticipants = activeVoiceChannels.get(channelId);
    
    const participants: VoiceChannelParticipant[] = [];
    
    if (channelParticipants) {
      for (const participant of channelParticipants.values()) {
        participants.push({
          channelId,
          userId: participant.userId,
          displayName: participant.displayName,
          socketId: participant.socketId,
          isMuted: participant.isMuted,
          isDeafened: participant.isDeafened,
          isPushingToTalk: participant.isPushingToTalk,
          joinedAt: participant.joinedAt,
        });
      }
    }

    return {
      channel: {
        id: channelId,
        roomId: '', // Will be filled by caller if needed
        name: '',
        position: 0,
        bitrate: 64000,
        createdAt: new Date(),
      },
      participants,
    };
  }

  /**
   * Get all participants in a channel
   */
  getParticipants(channelId: string): VoiceChannelParticipant[] {
    const channelParticipants = activeVoiceChannels.get(channelId);
    if (!channelParticipants) return [];

    return Array.from(channelParticipants.values()).map(p => ({
      channelId,
      userId: p.userId,
      displayName: p.displayName,
      socketId: p.socketId,
      isMuted: p.isMuted,
      isDeafened: p.isDeafened,
      isPushingToTalk: p.isPushingToTalk,
      joinedAt: p.joinedAt,
    }));
  }

  /**
   * Get channel ID for a socket
   */
  getChannelForSocket(socketId: string): string | undefined {
    return socketToChannel.get(socketId);
  }

  /**
   * Check if a user is in a voice channel
   */
  isUserInChannel(userId: string, channelId: string): boolean {
    const channelParticipants = activeVoiceChannels.get(channelId);
    if (!channelParticipants) return false;

    return Array.from(channelParticipants.values()).some(p => p.userId === userId);
  }

  /**
   * Get all active voice channels for a room (with participants)
   */
  getActiveChannelsForRoom(roomId: string): string[] {
    const activeChannelIds: string[] = [];
    
    for (const [channelId, participants] of activeVoiceChannels) {
      if (participants.size > 0) {
        // Note: We'd need to check if channel belongs to room
        // For now, return all active channels
        activeChannelIds.push(channelId);
      }
    }

    return activeChannelIds;
  }
}

// Export singleton instance
export const voiceChannelService = new VoiceChannelService();
