/**
 * Mediasoup SFU Socket Handlers
 * Handles WebRTC signaling for SFU-based video calls
 */
import { Server, Socket } from 'socket.io';
import { mediasoupService } from '../../services/mediasoup';
import { getRoomBySocket } from '../roomState';
import { logger } from '../../utils/logger';

// Use any for socket types to avoid strict typing issues with SFU events
// SFU events are not part of the main event types yet
type AnySocket = Socket<any, any, any, any>;
type AnyServer = Server<any, any, any, any>;

export function registerSfuHandlers(io: AnyServer, socket: AnySocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  /**
   * Join SFU room and get router capabilities
   */
  socket.on('sfu:join', async () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      // Add peer to mediasoup room
      await mediasoupService.addPeer(room.code, user.userId, socket.id);

      // Get router RTP capabilities
      const rtpCapabilities = mediasoupService.getRouterRtpCapabilities(room.code);

      // Get existing producers in the room
      const producers = mediasoupService.getProducers(room.code, socket.id);

      socket.emit('sfu:joined', {
        rtpCapabilities,
        producers,
      });

      logger.info(`Peer ${user.userId} joined SFU room ${room.code}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join SFU room';
      socket.emit('sfu:error', { message });
      logger.error('sfu:join error', { error: message });
    }
  });

  /**
   * Create WebRTC transport
   */
  socket.on('sfu:create-transport', async () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      const transport = await mediasoupService.createTransport(room.code, socket.id);

      socket.emit('sfu:transport-created', transport);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create transport';
      socket.emit('sfu:error', { message });
      logger.error('sfu:create-transport error', { error: message });
    }
  });

  /**
   * Connect WebRTC transport
   */
  socket.on('sfu:connect-transport', async (data: { transportId: string; dtlsParameters: unknown }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      const { transportId, dtlsParameters } = data;

      await mediasoupService.connectTransport(room.code, socket.id, transportId, dtlsParameters as any);

      socket.emit('sfu:transport-connected', { transportId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect transport';
      socket.emit('sfu:error', { message });
      logger.error('sfu:connect-transport error', { error: message });
    }
  });

  /**
   * Produce a media track
   */
  socket.on('sfu:produce', async (data: { transportId: string; kind: 'audio' | 'video'; rtpParameters: unknown; appData?: unknown }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      const { transportId, kind, rtpParameters, appData } = data;

      const result = await mediasoupService.produce(
        room.code,
        socket.id,
        transportId,
        kind,
        rtpParameters as any,
        appData as Record<string, unknown>,
      );

      socket.emit('sfu:produced', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to produce';
      socket.emit('sfu:error', { message });
      logger.error('sfu:produce error', { error: message });
    }
  });

  /**
   * Consume a media track
   */
  socket.on('sfu:consume', async (data: { transportId: string; producerId: string; rtpCapabilities: unknown }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      const { transportId, producerId, rtpCapabilities } = data;

      const result = await mediasoupService.consume(
        room.code,
        socket.id,
        transportId,
        producerId,
        rtpCapabilities as any,
      );

      socket.emit('sfu:consumed', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to consume';
      socket.emit('sfu:error', { message });
      logger.error('sfu:consume error', { error: message });
    }
  });

  /**
   * Resume a consumer
   */
  socket.on('sfu:resume-consumer', async (data: { consumerId: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      const { consumerId } = data;

      await mediasoupService.resumeConsumer(room.code, socket.id, consumerId);

      socket.emit('sfu:consumer-resumed', { consumerId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resume consumer';
      socket.emit('sfu:error', { message });
      logger.error('sfu:resume-consumer error', { error: message });
    }
  });

  /**
   * Pause a consumer
   */
  socket.on('sfu:pause-consumer', async (data: { consumerId: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      const { consumerId } = data;

      await mediasoupService.pauseConsumer(room.code, socket.id, consumerId);

      socket.emit('sfu:consumer-paused', { consumerId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to pause consumer';
      socket.emit('sfu:error', { message });
      logger.error('sfu:pause-consumer error', { error: message });
    }
  });

  /**
   * Close a producer (e.g., stop screen share)
   */
  socket.on('sfu:close-producer', async (data: { producerId: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) {
        socket.emit('sfu:error', { message: 'Not in a room' });
        return;
      }

      const { producerId } = data;

      await mediasoupService.closeProducer(room.code, socket.id, producerId);

      socket.emit('sfu:producer-closed', { producerId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close producer';
      socket.emit('sfu:error', { message });
      logger.error('sfu:close-producer error', { error: message });
    }
  });

  /**
   * Leave SFU room
   */
  socket.on('sfu:leave', async () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) return;

      await mediasoupService.removePeer(room.code, socket.id);

      // Notify other participants
      io.to(room.code).emit('sfu:peer-left', { userId: user.userId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave SFU room';
      logger.error('sfu:leave error', { error: message });
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', async () => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) return;

      await mediasoupService.removePeer(room.code, socket.id);

      // Notify other participants
      io.to(room.code).emit('sfu:peer-left', { userId: user.userId });
    } catch (error) {
      logger.error('SFU disconnect error', { error });
    }
  });
}
