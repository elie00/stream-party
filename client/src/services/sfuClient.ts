/**
 * Mediasoup SFU Client Service
 * Handles WebRTC connections to the SFU server
 */
import * as mediasoupClient from 'mediasoup-client';
import { getSocket } from './socket';
import { logger } from '../utils/logger';

interface TransportData {
  transportId: string;
  iceParameters: mediasoupClient.types.IceParameters;
  iceCandidates: mediasoupClient.types.IceCandidate[];
  dtlsParameters: mediasoupClient.types.DtlsParameters;
}

interface ProducerInfo {
  producerId: string;
  kind: 'audio' | 'video';
  userId: string;
}

interface ConsumerData {
  consumerId: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: mediasoupClient.types.RtpParameters;
}

type ProducerCallback = (producerId: string) => void;
type ConsumerCallback = (userId: string, stream: MediaStream) => void;
type ProducerClosedCallback = (producerId: string) => void;
type PeerLeftCallback = (userId: string) => void;

// Use any for socket to avoid strict typing issues with SFU events
type AnySocket = {
  emit: (event: string, ...args: any[]) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  once: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
};

class SfuClient {
  private device: mediasoupClient.types.Device | null = null;
  private sendTransport: mediasoupClient.types.Transport | null = null;
  private recvTransport: mediasoupClient.types.Transport | null = null;
  private producers: Map<string, mediasoupClient.types.Producer> = new Map();
  private consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  private localStream: MediaStream | null = null;
  private joined = false;

  // Callbacks
  private onNewProducer: ProducerCallback | null = null;
  private onNewConsumer: ConsumerCallback | null = null;
  private onProducerClosed: ProducerClosedCallback | null = null;
  private onPeerLeft: PeerLeftCallback | null = null;

  /**
   * Set event callbacks
   */
  setCallbacks(
    onNewProducer: ProducerCallback,
    onNewConsumer: ConsumerCallback,
    onProducerClosed: ProducerClosedCallback,
    onPeerLeft: PeerLeftCallback,
  ): void {
    this.onNewProducer = onNewProducer;
    this.onNewConsumer = onNewConsumer;
    this.onProducerClosed = onProducerClosed;
    this.onPeerLeft = onPeerLeft;
  }

  /**
   * Join SFU room
   */
  async join(): Promise<ProducerInfo[]> {
    if (this.joined) {
      return [];
    }

    const socket = getSocket() as unknown as AnySocket;

    // Get router RTP capabilities from server
    const { rtpCapabilities, producers } = await new Promise<{
      rtpCapabilities: mediasoupClient.types.RtpCapabilities;
      producers: ProducerInfo[];
    }>((resolve, reject) => {
      socket.emit('sfu:join');
      
      const handleJoined = (data: { rtpCapabilities: mediasoupClient.types.RtpCapabilities; producers: ProducerInfo[] }) => {
        socket.off('sfu:error', handleError);
        resolve(data);
      };

      const handleError = (data: { message: string }) => {
        socket.off('sfu:joined', handleJoined);
        reject(new Error(data.message));
      };

      socket.once('sfu:joined', handleJoined);
      socket.once('sfu:error', handleError);
    });

    // Create mediasoup Device
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });

    // Create transports
    await this.createTransports();

    // Set up event listeners
    this.setupEventListeners();

    this.joined = true;
    logger.info('Joined SFU room', { producerCount: producers.length });

    return producers;
  }

  /**
   * Create send and receive transports
   */
  private async createTransports(): Promise<void> {
    const socket = getSocket() as unknown as AnySocket;

    // Create send transport
    const sendTransportData = await this.createTransport();
    this.sendTransport = this.device!.createSendTransport({
      id: sendTransportData.transportId,
      iceParameters: sendTransportData.iceParameters,
      iceCandidates: sendTransportData.iceCandidates,
      dtlsParameters: sendTransportData.dtlsParameters,
    });

    this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.connectTransport(sendTransportData.transportId, dtlsParameters);
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });

    this.sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
      try {
        const { producerId } = await this.produce(
          sendTransportData.transportId,
          kind,
          rtpParameters,
          appData as Record<string, unknown>,
        );
        callback({ id: producerId });
      } catch (error) {
        errback(error as Error);
      }
    });

    // Create receive transport
    const recvTransportData = await this.createTransport();
    this.recvTransport = this.device!.createRecvTransport({
      id: recvTransportData.transportId,
      iceParameters: recvTransportData.iceParameters,
      iceCandidates: recvTransportData.iceCandidates,
      dtlsParameters: recvTransportData.dtlsParameters,
    });

    this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {
        await this.connectTransport(recvTransportData.transportId, dtlsParameters);
        callback();
      } catch (error) {
        errback(error as Error);
      }
    });
  }

  /**
   * Create a transport on the server
   */
  private async createTransport(): Promise<TransportData> {
    const socket = getSocket() as unknown as AnySocket;

    return new Promise((resolve, reject) => {
      socket.emit('sfu:create-transport');

      const handleCreated = (data: TransportData) => {
        socket.off('sfu:error', handleError);
        resolve(data);
      };

      const handleError = (data: { message: string }) => {
        socket.off('sfu:transport-created', handleCreated);
        reject(new Error(data.message));
      };

      socket.once('sfu:transport-created', handleCreated);
      socket.once('sfu:error', handleError);
    });
  }

  /**
   * Connect a transport
   */
  private async connectTransport(
    transportId: string,
    dtlsParameters: mediasoupClient.types.DtlsParameters,
  ): Promise<void> {
    const socket = getSocket() as unknown as AnySocket;

    return new Promise((resolve, reject) => {
      socket.emit('sfu:connect-transport', { transportId, dtlsParameters });

      const handleConnected = () => {
        socket.off('sfu:error', handleError);
        resolve();
      };

      const handleError = (data: { message: string }) => {
        socket.off('sfu:transport-connected', handleConnected);
        reject(new Error(data.message));
      };

      socket.once('sfu:transport-connected', handleConnected);
      socket.once('sfu:error', handleError);
    });
  }

  /**
   * Produce a track
   */
  private async produce(
    transportId: string,
    kind: 'audio' | 'video',
    rtpParameters: mediasoupClient.types.RtpParameters,
    appData: Record<string, unknown>,
  ): Promise<{ producerId: string }> {
    const socket = getSocket() as unknown as AnySocket;

    return new Promise((resolve, reject) => {
      socket.emit('sfu:produce', { transportId, kind, rtpParameters, appData });

      const handleProduced = (data: { producerId: string }) => {
        socket.off('sfu:error', handleError);
        resolve(data);
      };

      const handleError = (data: { message: string }) => {
        socket.off('sfu:produced', handleProduced);
        reject(new Error(data.message));
      };

      socket.once('sfu:produced', handleProduced);
      socket.once('sfu:error', handleError);
    });
  }

  /**
   * Start producing audio and video
   */
  async startProducing(
    audio: boolean = true,
    video: boolean = true,
    screenShare: boolean = false,
  ): Promise<MediaStream> {
    if (!this.sendTransport) {
      throw new Error('Send transport not created');
    }

    // Get user media
    const constraints: MediaStreamConstraints = {
      audio: audio ? {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } : false,
      video: video ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      } : false,
    };

    if (screenShare) {
      // Get display media for screen sharing
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
    } else {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    }

    // Produce tracks
    const tracks = this.localStream.getTracks();

    for (const track of tracks) {
      const producer = await this.sendTransport.produce({
        track,
        appData: {
          source: screenShare ? 'screen' : 'webcam',
        },
      });

      this.producers.set(producer.id, producer);
      this.onNewProducer?.(producer.id);

      logger.info(`Producing ${track.kind} track`, { producerId: producer.id });
    }

    return this.localStream;
  }

  /**
   * Stop producing
   */
  stopProducing(): void {
    const socket = getSocket() as unknown as AnySocket;

    for (const [producerId, producer] of this.producers) {
      producer.close();
      socket.emit('sfu:close-producer', { producerId });
    }

    this.producers.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Consume a producer
   */
  async consume(producerInfo: ProducerInfo): Promise<MediaStream> {
    if (!this.recvTransport || !this.device) {
      throw new Error('Receive transport not created');
    }

    const socket = getSocket() as unknown as AnySocket;

    // Request to consume
    const consumerData = await new Promise<ConsumerData>((resolve, reject) => {
      socket.emit('sfu:consume', {
        transportId: this.recvTransport!.id,
        producerId: producerInfo.producerId,
        rtpCapabilities: this.device!.rtpCapabilities,
      });

      const handleConsumed = (data: ConsumerData) => {
        socket.off('sfu:error', handleError);
        resolve(data);
      };

      const handleError = (data: { message: string }) => {
        socket.off('sfu:consumed', handleConsumed);
        reject(new Error(data.message));
      };

      socket.once('sfu:consumed', handleConsumed);
      socket.once('sfu:error', handleError);
    });

    // Create consumer
    const consumer = await this.recvTransport.consume({
      id: consumerData.consumerId,
      producerId: consumerData.producerId,
      kind: consumerData.kind,
      rtpParameters: consumerData.rtpParameters,
    });

    this.consumers.set(consumer.id, consumer);

    // Resume consumer
    await new Promise<void>((resolve, reject) => {
      socket.emit('sfu:resume-consumer', { consumerId: consumer.id });

      const handleResumed = () => {
        socket.off('sfu:error', handleError);
        resolve();
      };

      const handleError = (data: { message: string }) => {
        socket.off('sfu:consumer-resumed', handleResumed);
        reject(new Error(data.message));
      };

      socket.once('sfu:consumer-resumed', handleResumed);
      socket.once('sfu:error', handleError);
    });

    // Create media stream
    const stream = new MediaStream([consumer.track]);
    this.onNewConsumer?.(producerInfo.userId, stream);

    logger.info(`Consuming ${consumer.kind} track`, { consumerId: consumer.id, userId: producerInfo.userId });

    return stream;
  }

  /**
   * Set up event listeners for server events
   */
  private setupEventListeners(): void {
    const socket = getSocket() as unknown as AnySocket;

    // New producer from another peer
    socket.on('sfu:new-producer', async (data: ProducerInfo) => {
      logger.info('New producer available', { producerId: data.producerId, kind: data.kind });
      this.onNewProducer?.(data.producerId);

      // Auto-consume new producers
      try {
        await this.consume(data);
      } catch (error) {
        logger.error('Failed to consume new producer', { error: String(error) });
      }
    });

    // Producer closed
    socket.on('sfu:producer-closed', (data: { producerId: string }) => {
      const consumer = Array.from(this.consumers.values()).find(
        (c) => c.producerId === data.producerId,
      );

      if (consumer) {
        consumer.close();
        this.consumers.delete(consumer.id);
      }

      this.onProducerClosed?.(data.producerId);
      logger.info('Producer closed', { producerId: data.producerId });
    });

    // Peer left
    socket.on('sfu:peer-left', (data: { userId: string }) => {
      this.onPeerLeft?.(data.userId);
      logger.info('Peer left SFU room', { userId: data.userId });
    });
  }

  /**
   * Leave SFU room
   */
  leave(): void {
    const socket = getSocket() as unknown as AnySocket;

    // Stop producing
    this.stopProducing();

    // Close all consumers
    for (const consumer of this.consumers.values()) {
      consumer.close();
    }
    this.consumers.clear();

    // Close transports
    this.sendTransport?.close();
    this.recvTransport?.close();
    this.sendTransport = null;
    this.recvTransport = null;

    // Leave SFU room
    socket.emit('sfu:leave');

    // Remove event listeners
    socket.off('sfu:new-producer');
    socket.off('sfu:producer-closed');
    socket.off('sfu:peer-left');

    this.joined = false;
    this.device = null;

    logger.info('Left SFU room');
  }

  /**
   * Get local stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Toggle audio
   */
  toggleAudio(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }

    return false;
  }

  /**
   * Toggle video
   */
  toggleVideo(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }

    return false;
  }

  /**
   * Check if joined
   */
  isJoined(): boolean {
    return this.joined;
  }
}

// Export singleton instance
export const sfuClient = new SfuClient();
export type { ProducerInfo };
