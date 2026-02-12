/**
 * Mediasoup SFU Service
 * Handles WebRTC routing for scalable video calls
 */
import * as mediasoup from 'mediasoup';
import { Server as SocketServer } from 'socket.io';
import { logger } from '../utils/logger';

// Types
interface RoomRouter {
  router: mediasoup.types.Router;
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
  peers: Map<string, PeerData>;
}

interface PeerData {
  userId: string;
  socketId: string;
  transports: Map<string, mediasoup.types.WebRtcTransport>;
  producers: Map<string, mediasoup.types.Producer>;
  consumers: Map<string, mediasoup.types.Consumer>;
}

// Codec configurations
const mediaCodecs = [
  {
    kind: 'audio' as const,
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    parameters: {
      useinbandfec: 1,
      usedtx: 1,
    },
  },
  {
    kind: 'video' as const,
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video' as const,
    mimeType: 'video/VP9',
    clockRate: 90000,
    parameters: {
      'profile-id': 2,
      'x-google-start-bitrate': 1000,
    },
  },
  {
    kind: 'video' as const,
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '4d0032',
      'level-asymmetry-allowed': 1,
      'x-google-start-bitrate': 1000,
    },
  },
];

class MediasoupService {
  private workers: mediasoup.types.Worker[] = [];
  private nextWorkerIndex = 0;
  private rooms: Map<string, RoomRouter> = new Map();
  private io: SocketServer | null = null;

  /**
   * Initialize mediasoup workers
   */
  async initialize(): Promise<void> {
    const numWorkers = Math.max(1, (await this.getNumCpus()) - 1);
    
    logger.info(`Initializing ${numWorkers} mediasoup workers...`);

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
        rtcMinPort: 10000,
        rtcMaxPort: 10100,
      });

      worker.on('died', () => {
        logger.error(`Mediasoup worker ${i} died, exiting...`);
        process.exit(1);
      });

      this.workers.push(worker);
    }

    logger.info('Mediasoup workers initialized successfully');
  }

  /**
   * Set Socket.IO server for broadcasting events
   */
  setSocketServer(io: SocketServer): void {
    this.io = io;
  }

  /**
   * Get next worker in round-robin fashion
   */
  private getNextWorker(): mediasoup.types.Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  /**
   * Get number of CPUs
   */
  private async getNumCpus(): Promise<number> {
    const os = await import('os');
    return os.cpus().length;
  }

  /**
   * Create a new room with router
   */
  async createRoom(roomId: string): Promise<RoomRouter> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const worker = this.getNextWorker();
    const router = await worker.createRouter({ mediaCodecs });

    const room: RoomRouter = {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      peers: new Map(),
    };

    this.rooms.set(roomId, room);
    logger.info(`Created mediasoup room: ${roomId}`);

    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): RoomRouter | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Close a room and clean up resources
   */
  async closeRoom(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Close all peers
    for (const [peerId, peer] of room.peers) {
      for (const transport of peer.transports.values()) {
        transport.close();
      }
      for (const producer of peer.producers.values()) {
        producer.close();
      }
      for (const consumer of peer.consumers.values()) {
        consumer.close();
      }
    }

    room.router.close();
    this.rooms.delete(roomId);
    logger.info(`Closed mediasoup room: ${roomId}`);
  }

  /**
   * Add a peer to a room
   */
  async addPeer(roomId: string, userId: string, socketId: string): Promise<PeerData> {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = await this.createRoom(roomId);
    }

    const peer: PeerData = {
      userId,
      socketId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };

    room.peers.set(socketId, peer);
    logger.info(`Peer ${userId} joined room ${roomId}`);

    return peer;
  }

  /**
   * Remove a peer from a room
   */
  async removePeer(roomId: string, socketId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const peer = room.peers.get(socketId);
    if (!peer) return;

    // Close all peer's transports, producers, and consumers
    for (const transport of peer.transports.values()) {
      transport.close();
    }
    for (const producer of peer.producers.values()) {
      producer.close();
    }
    for (const consumer of peer.consumers.values()) {
      consumer.close();
    }

    room.peers.delete(socketId);

    // Close room if empty
    if (room.peers.size === 0) {
      await this.closeRoom(roomId);
    }

    logger.info(`Peer ${peer.userId} left room ${roomId}`);
  }

  /**
   * Create WebRTC transport for a peer
   */
  async createTransport(
    roomId: string,
    socketId: string,
  ): Promise<{
    transportId: string;
    iceParameters: mediasoup.types.IceParameters;
    iceCandidates: mediasoup.types.IceCandidate[];
    dtlsParameters: mediasoup.types.DtlsParameters;
  }> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const peer = room.peers.get(socketId);
    if (!peer) {
      throw new Error(`Peer ${socketId} not found in room ${roomId}`);
    }

    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });

    peer.transports.set(transport.id, transport);

    logger.info(`Created transport ${transport.id} for peer ${peer.userId}`);

    return {
      transportId: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  /**
   * Connect a transport
   */
  async connectTransport(
    roomId: string,
    socketId: string,
    transportId: string,
    dtlsParameters: mediasoup.types.DtlsParameters,
  ): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const peer = room.peers.get(socketId);
    if (!peer) {
      throw new Error(`Peer ${socketId} not found`);
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    await transport.connect({ dtlsParameters });
    logger.info(`Transport ${transportId} connected for peer ${peer.userId}`);
  }

  /**
   * Produce a media track
   */
  async produce(
    roomId: string,
    socketId: string,
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: mediasoup.types.RtpParameters,
    appData: Record<string, unknown> = {},
  ): Promise<{ producerId: string }> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const peer = room.peers.get(socketId);
    if (!peer) {
      throw new Error(`Peer ${socketId} not found`);
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    const producer = await transport.produce({
      kind,
      rtpParameters,
      appData: {
        ...appData,
        peerId: socketId,
        userId: peer.userId,
      },
    });

    peer.producers.set(producer.id, producer);
    room.producers.set(producer.id, producer);

    // Notify other peers about new producer
    this.notifyPeers(roomId, socketId, 'sfu:new-producer', {
      producerId: producer.id,
      kind: producer.kind,
      userId: peer.userId,
    });

    logger.info(`Producer ${producer.id} created for peer ${peer.userId}`);

    return { producerId: producer.id };
  }

  /**
   * Consume a media track
   */
  async consume(
    roomId: string,
    socketId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities,
  ): Promise<{
    consumerId: string;
    producerId: string;
    kind: 'audio' | 'video';
    rtpParameters: mediasoup.types.RtpParameters;
  }> {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const peer = room.peers.get(socketId);
    if (!peer) {
      throw new Error(`Peer ${socketId} not found`);
    }

    const transport = peer.transports.get(transportId);
    if (!transport) {
      throw new Error(`Transport ${transportId} not found`);
    }

    const producer = room.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} not found`);
    }

    // Check if router can consume
    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Router cannot consume this producer');
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Start paused, resume after client is ready
      appData: {
        ...producer.appData,
        consumerPeerId: socketId,
      },
    });

    peer.consumers.set(consumer.id, consumer);
    room.consumers.set(consumer.id, consumer);

    logger.info(`Consumer ${consumer.id} created for peer ${peer.userId}`);

    return {
      consumerId: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  /**
   * Resume a consumer
   */
  async resumeConsumer(roomId: string, socketId: string, consumerId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const consumer = room.consumers.get(consumerId);
    if (!consumer) return;

    await consumer.resume();
    logger.info(`Consumer ${consumerId} resumed`);
  }

  /**
   * Pause a consumer
   */
  async pauseConsumer(roomId: string, socketId: string, consumerId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const consumer = room.consumers.get(consumerId);
    if (!consumer) return;

    await consumer.pause();
    logger.info(`Consumer ${consumerId} paused`);
  }

  /**
   * Close a producer (e.g., when user stops sharing screen)
   */
  async closeProducer(roomId: string, socketId: string, producerId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const producer = room.producers.get(producerId);
    if (!producer) return;

    producer.close();
    room.producers.delete(producerId);

    const peer = room.peers.get(socketId);
    if (peer) {
      peer.producers.delete(producerId);
    }

    // Notify other peers
    this.notifyPeers(roomId, socketId, 'sfu:producer-closed', { producerId });

    logger.info(`Producer ${producerId} closed`);
  }

  /**
   * Get router RTP capabilities
   */
  getRouterRtpCapabilities(roomId: string): mediasoup.types.RtpCapabilities | null {
    const room = this.rooms.get(roomId);
    return room?.router.rtpCapabilities ?? null;
  }

  /**
   * Get all producers in a room (for new peers to consume)
   */
  getProducers(roomId: string, excludeSocketId?: string): Array<{ producerId: string; kind: 'audio' | 'video'; userId: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const producers: Array<{ producerId: string; kind: 'audio' | 'video'; userId: string }> = [];

    for (const [socketId, peer] of room.peers) {
      if (socketId === excludeSocketId) continue;

      for (const [producerId, producer] of peer.producers) {
        producers.push({
          producerId,
          kind: producer.kind,
          userId: peer.userId,
        });
      }
    }

    return producers;
  }

  /**
   * Notify all peers in a room except sender
   */
  private notifyPeers(roomId: string, excludeSocketId: string, event: string, data: unknown): void {
    if (!this.io) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    for (const socketId of room.peers.keys()) {
      if (socketId !== excludeSocketId) {
        this.io!.to(socketId).emit(event, data);
      }
    }
  }

  /**
   * Close all workers on shutdown
   */
  async close(): Promise<void> {
    for (const worker of this.workers) {
      worker.close();
    }
    this.workers = [];
    this.rooms.clear();
    logger.info('Mediasoup service closed');
  }
}

// Export singleton instance
export const mediasoupService = new MediasoupService();
