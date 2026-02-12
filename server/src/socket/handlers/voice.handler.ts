/**
 * Voice Channel Socket Handlers
 * Handles voice channel events with push-to-talk support
 */
import { Server, Socket } from 'socket.io';
import { voiceChannelService, VoiceChannelState } from '../../services/voiceChannel';
import { getRoomBySocket } from '../roomState';
import { logger } from '../../utils/logger';

// Types for voice events
interface VoiceChannelInfo {
  id: string;
  roomId: string;
  name: string;
  position: number;
  bitrate: number;
  createdAt: Date;
}

interface VoiceParticipantInfo {
  channelId: string;
  userId: string;
  displayName: string;
  socketId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isPushingToTalk: boolean;
  joinedAt: Date;
}

interface VoiceChannelStateEvent {
  channel: VoiceChannelInfo;
  participants: VoiceParticipantInfo[];
}

type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

export function registerVoiceHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Get all voice channels for the current room
   */
  socket.on('voice:get-channels', async () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('voice:error', { message: 'Not in a room' });
        return;
      }

      const channels = await voiceChannelService.getChannelsForRoom(room.dbRoomId);
      
      // Create default channel if none exist
      if (channels.length === 0) {
        const defaultChannel = await voiceChannelService.createDefaultChannel(room.dbRoomId);
        channels.push(defaultChannel);
      }

      // Get participants for each channel
      const channelsWithParticipants = await Promise.all(
        channels.map(async (channel) => {
          const participants = voiceChannelService.getParticipants(channel.id);
          return {
            channel,
            participants,
          };
        })
      );

      socket.emit('voice:channels', channelsWithParticipants);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get voice channels';
      socket.emit('voice:error', { message });
      logger.error('voice:get-channels error', { error: message });
    }
  });

  /**
   * Create a new voice channel
   */
  socket.on('voice:create-channel', async (data: { name: string; bitrate?: number }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('voice:error', { message: 'Not in a room' });
        return;
      }

      // Only host can create channels
      if (room.hostId !== user.userId) {
        socket.emit('voice:error', { message: 'Only the host can create voice channels' });
        return;
      }

      const channel = await voiceChannelService.createChannel(
        room.dbRoomId,
        data.name,
        0, // position
        data.bitrate ?? 64000,
      );

      // Notify all room participants
      io.to(room.code).emit('voice:channel-created', { channel });

      logger.info(`Voice channel created: ${channel.name}`, { roomId: room.dbRoomId, channelId: channel.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create voice channel';
      socket.emit('voice:error', { message });
      logger.error('voice:create-channel error', { error: message });
    }
  });

  /**
   * Join a voice channel
   */
  socket.on('voice:join-channel', async (data: { channelId: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('voice:error', { message: 'Not in a room' });
        return;
      }

      const state = await voiceChannelService.joinChannel(
        data.channelId,
        user.userId,
        user.displayName,
        socket.id,
      );

      // Join the socket room for this voice channel
      socket.join(`voice:${data.channelId}`);

      // Get full channel info
      const channel = await voiceChannelService.getChannel(data.channelId);
      if (channel) {
        state.channel = channel;
      }

      // Notify everyone in the room about the new participant
      io.to(room.code).emit('voice:user-joined', {
        channelId: data.channelId,
        participant: {
          channelId: data.channelId,
          userId: user.userId,
          displayName: user.displayName,
          socketId: socket.id,
          isMuted: true,
          isDeafened: false,
          isPushingToTalk: false,
          joinedAt: new Date(),
        },
      });

      // Send current channel state to the joiner
      socket.emit('voice:joined', state);

      logger.info(`User joined voice channel`, { 
        userId: user.userId, 
        channelId: data.channelId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join voice channel';
      socket.emit('voice:error', { message });
      logger.error('voice:join-channel error', { error: message });
    }
  });

  /**
   * Leave a voice channel
   */
  socket.on('voice:leave-channel', async () => {
    try {
      const room = getRoomBySocket(socket.id);
      
      const result = await voiceChannelService.leaveChannel(socket.id);
      
      if (result) {
        // Leave the socket room
        socket.leave(`voice:${result.channelId}`);

        // Notify room participants
        if (room) {
          io.to(room.code).emit('voice:user-left', {
            channelId: result.channelId,
            userId: user.userId,
          });
        }

        logger.info(`User left voice channel`, { 
          userId: user.userId, 
          channelId: result.channelId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave voice channel';
      socket.emit('voice:error', { message });
      logger.error('voice:leave-channel error', { error: message });
    }
  });

  /**
   * Push-to-talk activation
   */
  socket.on('voice:push-to-talk-start', async () => {
    try {
      const result = await voiceChannelService.setPushToTalk(socket.id, true);
      
      if (result) {
        const room = getRoomBySocket(socket.id);
        
        // Notify channel participants
        io.to(`voice:${result.channelId}`).emit('voice:user-speaking', {
          channelId: result.channelId,
          userId: result.userId,
          isSpeaking: true,
        });

        // Also notify room for UI updates
        if (room) {
          io.to(room.code).emit('voice:user-speaking', {
            channelId: result.channelId,
            userId: result.userId,
            isSpeaking: true,
          });
        }
      }
    } catch (error) {
      logger.error('voice:push-to-talk-start error', { error: String(error) });
    }
  });

  /**
   * Push-to-talk deactivation
   */
  socket.on('voice:push-to-talk-stop', async () => {
    try {
      const result = await voiceChannelService.setPushToTalk(socket.id, false);
      
      if (result) {
        const room = getRoomBySocket(socket.id);
        
        // Notify channel participants
        io.to(`voice:${result.channelId}`).emit('voice:user-speaking', {
          channelId: result.channelId,
          userId: result.userId,
          isSpeaking: false,
        });

        // Also notify room for UI updates
        if (room) {
          io.to(room.code).emit('voice:user-speaking', {
            channelId: result.channelId,
            userId: result.userId,
            isSpeaking: false,
          });
        }
      }
    } catch (error) {
      logger.error('voice:push-to-talk-stop error', { error: String(error) });
    }
  });

  /**
   * Toggle mute
   */
  socket.on('voice:toggle-mute', async () => {
    try {
      const channelId = voiceChannelService.getChannelForSocket(socket.id);
      if (!channelId) return;

      const room = getRoomBySocket(socket.id);
      const participants = voiceChannelService.getParticipants(channelId);
      const participant = participants.find(p => p.socketId === socket.id);
      
      if (!participant) return;

      const result = await voiceChannelService.setMute(socket.id, !participant.isMuted);
      
      if (result && room) {
        io.to(room.code).emit('voice:user-muted', {
          channelId: result.channelId,
          userId: result.userId,
          isMuted: result.isMuted,
        });
      }
    } catch (error) {
      logger.error('voice:toggle-mute error', { error: String(error) });
    }
  });

  /**
   * Toggle deafen
   */
  socket.on('voice:toggle-deafen', async () => {
    try {
      const channelId = voiceChannelService.getChannelForSocket(socket.id);
      if (!channelId) return;

      const room = getRoomBySocket(socket.id);
      const participants = voiceChannelService.getParticipants(channelId);
      const participant = participants.find(p => p.socketId === socket.id);
      
      if (!participant) return;

      const result = await voiceChannelService.setDeafen(socket.id, !participant.isDeafened);
      
      if (result && room) {
        io.to(room.code).emit('voice:user-deafened', {
          channelId: result.channelId,
          userId: result.userId,
          isDeafened: result.isDeafened,
        });
      }
    } catch (error) {
      logger.error('voice:toggle-deafen error', { error: String(error) });
    }
  });

  /**
   * Delete a voice channel
   */
  socket.on('voice:delete-channel', async (data: { channelId: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('voice:error', { message: 'Not in a room' });
        return;
      }

      // Only host can delete channels
      if (room.hostId !== user.userId) {
        socket.emit('voice:error', { message: 'Only the host can delete voice channels' });
        return;
      }

      await voiceChannelService.deleteChannel(data.channelId);

      // Notify all room participants
      io.to(room.code).emit('voice:channel-deleted', { channelId: data.channelId });

      logger.info(`Voice channel deleted`, { channelId: data.channelId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete voice channel';
      socket.emit('voice:error', { message });
      logger.error('voice:delete-channel error', { error: message });
    }
  });

  /**
   * Handle disconnect - leave voice channel
   */
  socket.on('disconnect', async () => {
    try {
      const room = getRoomBySocket(socket.id);
      const channelIds = await voiceChannelService.leaveAllChannels(socket.id);
      
      if (channelIds.length > 0 && room) {
        for (const channelId of channelIds) {
          socket.leave(`voice:${channelId}`);
          io.to(room.code).emit('voice:user-left', {
            channelId,
            userId: user.userId,
          });
        }
      }
    } catch (error) {
      logger.error('Voice disconnect error', { error: String(error) });
    }
  });
}
