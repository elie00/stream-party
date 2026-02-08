import SimplePeer from 'simple-peer';
import { getSocket } from './socket';

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

  createPeer(userId: string, initiator: boolean): SimplePeer.Instance {
    // Destroy existing peer for this user if any
    this.destroyPeer(userId);

    const peer = new SimplePeer({
      initiator,
      stream: this.localStream || undefined,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
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
      console.error(`Peer error with ${userId}:`, err);
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
  handleUserJoinedCall(userId: string): void {
    this.createPeer(userId, true);
  }

  handleUserLeftCall(userId: string): void {
    this.destroyPeer(userId);
    this.onRemoteStreamRemoved?.(userId);
  }

  /**
   * Handle an incoming offer from a remote peer.
   * Create a non-initiator peer and feed the offer signal.
   */
  handleOffer(userId: string, signal: unknown): void {
    const peer = this.createPeer(userId, false);
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
