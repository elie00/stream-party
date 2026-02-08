import type Player from 'video.js/dist/types/player';
import type { SyncState } from '@stream-party/shared';
import { SYNC_INTERVAL_MS } from '@stream-party/shared';
import { getSocket } from './socket';

export class SyncEngine {
  private player: Player | null = null;
  private isHost: boolean = false;
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;
  private ignoreEvents: boolean = false; // Prevent feedback loops
  private speedCorrectionTimeout: ReturnType<typeof setTimeout> | null = null;

  setPlayer(player: Player): void {
    this.player = player;
  }

  setHost(isHost: boolean): void {
    const wasHost = this.isHost;
    this.isHost = isHost;

    if (isHost && !wasHost) {
      this.startBroadcasting();
    } else if (!isHost && wasHost) {
      this.stopBroadcasting();
    }
  }

  // Host: start broadcasting sync state every SYNC_INTERVAL_MS
  private startBroadcasting(): void {
    this.stopBroadcasting();
    this.broadcastInterval = setInterval(() => {
      if (!this.player) return;
      const state: SyncState = {
        currentTime: this.player.currentTime() || 0,
        isPlaying: !this.player.paused(),
        playbackRate: this.player.playbackRate() || 1,
        timestamp: Date.now(),
        magnetUri: null, // filled by room state on server
        selectedFileIndex: null,
      };
      getSocket().emit('sync:state', state);
    }, SYNC_INTERVAL_MS);
  }

  private stopBroadcasting(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }

  // Host: emit discrete events
  emitPlay(): void {
    if (!this.isHost || !this.player) return;
    getSocket().emit('sync:play', this.player.currentTime() || 0);
  }

  emitPause(): void {
    if (!this.isHost || !this.player) return;
    getSocket().emit('sync:pause', this.player.currentTime() || 0);
  }

  emitSeek(time: number): void {
    if (!this.isHost) return;
    getSocket().emit('sync:seek', time);
  }

  // Peer: handle incoming sync state from host
  handleSyncState(state: SyncState): void {
    if (this.isHost || !this.player || this.ignoreEvents) return;

    // Estimate where the host is NOW (accounting for network delay)
    const elapsed = (Date.now() - state.timestamp) / 1000;
    const estimatedHostTime = state.isPlaying
      ? state.currentTime + elapsed
      : state.currentTime;

    const myTime = this.player.currentTime() || 0;
    const drift = Math.abs(myTime - estimatedHostTime);

    if (drift < 0.1) {
      // < 100ms: perfect, do nothing
      this.resetPlaybackRate();
      return;
    }

    if (drift < 0.5) {
      // 100-500ms: gentle speed adjustment
      const rate = myTime < estimatedHostTime ? 1.05 : 0.95;
      this.player.playbackRate(rate);
      // Reset after a bit
      if (this.speedCorrectionTimeout) clearTimeout(this.speedCorrectionTimeout);
      this.speedCorrectionTimeout = setTimeout(() => this.resetPlaybackRate(), 2000);
      return;
    }

    // > 500ms: force seek
    this.ignoreEvents = true;
    this.player.currentTime(estimatedHostTime);
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
    this.resetPlaybackRate();

    // Match play/pause state
    if (state.isPlaying && this.player.paused()) {
      this.player.play();
    } else if (!state.isPlaying && !this.player.paused()) {
      this.player.pause();
    }
  }

  // Peer: handle discrete events
  handlePlay(time: number): void {
    if (this.isHost || !this.player) return;
    this.ignoreEvents = true;
    this.player.currentTime(time);
    this.player.play();
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
  }

  handlePause(time: number): void {
    if (this.isHost || !this.player) return;
    this.ignoreEvents = true;
    this.player.currentTime(time);
    this.player.pause();
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
  }

  handleSeek(time: number): void {
    if (this.isHost || !this.player) return;
    this.ignoreEvents = true;
    this.player.currentTime(time);
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
  }

  // Request current state (for late joiners)
  requestSync(): void {
    getSocket().emit('sync:request');
  }

  isIgnoringEvents(): boolean {
    return this.ignoreEvents;
  }

  private resetPlaybackRate(): void {
    if (this.player && this.player.playbackRate() !== 1) {
      this.player.playbackRate(1);
    }
  }

  destroy(): void {
    this.stopBroadcasting();
    if (this.speedCorrectionTimeout) clearTimeout(this.speedCorrectionTimeout);
    this.player = null;
  }
}

export const syncEngine = new SyncEngine();
