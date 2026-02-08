import SimplePeer from 'simple-peer';
import { getSocket } from './socket';
import { getIceServers } from './api';
import { logger } from '../utils/logger';

interface PeerConnection {
  peer: SimplePeer.Instance;
  userId: string;
  stream: MediaStream | null;
}

type StreamHandler = (userId: string, stream: MediaStream | null) => void;

class PeerManager {
  private peers: Map<string, PeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private onRemoteStream: StreamHandler | null = null;
  private onRemoteStreamRemoved: ((userId: string) => void) | null = null;
  private audioEnabled = true;
  private videoEnabled = true;
  private cachedIceServers: RTCIceServer[] | null = null;
  private iceServersFetchPromise: Promise<RTCIceServer[]> | null = null;

  setCallbacks(
    onStream: StreamHandler,
    onStreamRemoved: (userId: string) => void,
  ): void {
    this.onRemoteStream = onStream;
    this.onRemoteStreamRemoved = onStreamRemoved;
  }

  async getLocalStream(): Promise<MediaStream> {
    if (this.localStream) return this.localStream;

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 15, max: 24 },
      },
    });

    return this.localStream;
  }

  getLocalStreamSync(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Fetch ICE servers from API (with caching)
   */
  private async fetchIceServers(): Promise<RTCIceServer[]> {
    // Return cached if available
    if (this.cachedIceServers) {
      return this.cachedIceServers;
    }

    // Avoid duplicate fetches
    if (this.iceServersFetchPromise) {
      return this.iceServersFetchPromise;
    }

    this.iceServersFetchPromise = (async () => {
      try {
        const { iceServers } = await getIceServers();
        this.cachedIceServers = iceServers as RTCIceServer[];
        logger.info('Fetched ICE servers', { count: iceServers.length });
        return this.cachedIceServers;
      } catch (err) {
        logger.warn('Failed to fetch ICE servers, using STUN only', err);
        // Fallback to STUN only
        return [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ];
      } finally {
        this.iceServersFetchPromise = null;
      }
    })();

    return this.iceServersFetchPromise;
  }

  async createPeer(userId: string, initiator: boolean): Promise<SimplePeer.Instance> {
    // Destroy existing peer for this user if any
    this.destroyPeer(userId);

    // Fetch ICE servers dynamically
    const iceServers = await this.fetchIceServers();

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream || undefined,
      trickle: true,
      config: {
        iceServers,
      },
    });

    peer.on('signal', (signal) => {
      const socket = getSocket();
      const signalData = signal as SimplePeer.SignalData & { type?: string; candidate?: unknown };

      if (signalData.type === 'offer') {
        socket.emit('rtc:offer', { to: userId, signal });
      } else if (signalData.type === 'answer') {
        socket.emit('rtc:answer', { to: userId, signal });
      } else {
        // ICE candidate
        socket.emit('rtc:ice-candidate', { to: userId, signal });
      }
    });

    peer.on('stream', (stream) => {
      const conn = this.peers.get(userId);
      if (conn) conn.stream = stream;
      this.onRemoteStream?.(userId, stream);
    });

    peer.on('close', () => {
      this.onRemoteStreamRemoved?.(userId);
      this.peers.delete(userId);
    });

    peer.on('error', (err) => {
      logger.error(`Peer connection failed with ${userId}`, {
        error: err.message,
        code: (err as Error & { code?: string }).code,
      });
      this.destroyPeer(userId);
      this.onRemoteStreamRemoved?.(userId);
    });

    this.peers.set(userId, { peer, userId, stream: null });
    return peer;
  }

  handleSignal(userId: string, signal: unknown): void {
    const conn = this.peers.get(userId);
    if (conn) {
      conn.peer.signal(signal as SimplePeer.SignalData);
    }
  }

  /**
   * When a new user joins the call, existing call participants initiate
   * a peer connection to them.
   */
  async handleUserJoinedCall(userId: string): Promise<void> {
    await this.createPeer(userId, true);
  }

  handleUserLeftCall(userId: string): void {
    this.destroyPeer(userId);
    this.onRemoteStreamRemoved?.(userId);
  }

  /**
   * Handle an incoming offer from a remote peer.
   * Create a non-initiator peer and feed the offer signal.
   */
  async handleOffer(userId: string, signal: unknown): Promise<void> {
    const peer = await this.createPeer(userId, false);
    peer.signal(signal as SimplePeer.SignalData);
  }

  /**
   * Handle an incoming answer from a remote peer.
   */
  handleAnswer(userId: string, signal: unknown): void {
    this.handleSignal(userId, signal);
  }

  /**
   * Handle an incoming ICE candidate from a remote peer.
   */
  handleIceCandidate(userId: string, signal: unknown): void {
    this.handleSignal(userId, signal);
  }

  toggleAudio(): boolean {
    this.audioEnabled = !this.audioEnabled;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = this.audioEnabled;
      });
    }
    return this.audioEnabled;
  }

  toggleVideo(): boolean {
    this.videoEnabled = !this.videoEnabled;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.videoEnabled;
      });
    }
    return this.videoEnabled;
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }
  isVideoEnabled(): boolean {
    return this.videoEnabled;
  }

  getRemoteStream(userId: string): MediaStream | null {
    return this.peers.get(userId)?.stream || null;
  }

  private destroyPeer(userId: string): void {
    const conn = this.peers.get(userId);
    if (conn) {
      conn.peer.destroy();
      this.peers.delete(userId);
    }
  }

  destroyAll(): void {
    this.peers.forEach((conn) => conn.peer.destroy());
    this.peers.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.audioEnabled = true;
    this.videoEnabled = true;
  }
}

export const peerManager = new PeerManager();
