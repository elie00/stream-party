import type { YouTubeSyncState, VideoQueueItem } from '@stream-party/shared';
import { SYNC_INTERVAL_MS } from '@stream-party/shared';
import { getSocket } from './socket';

/**
 * YouTube Player interface - minimal interface needed for sync
 */
export interface YouTubePlayerAdapter {
  getCurrentTime(): number;
  getVideoId(): string | null;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
  seekTo(time: number): void;
}

/**
 * Event types for YouTube sync callbacks
 */
export type YouTubeSyncEventType = 
  | 'youtube:play'
  | 'youtube:pause'
  | 'youtube:seek'
  | 'youtube:source'
  | 'queue:add'
  | 'queue:remove'
  | 'queue:vote'
  | 'queue:sync';

export interface YouTubeSyncEventHandlers {
  'youtube:play': () => void;
  'youtube:pause': () => void;
  'youtube:seek': (time: number) => void;
  'youtube:source': (videoId: string | null) => void;
  'youtube:state': (state: YouTubeSyncState) => void;
  'queue:add': (video: VideoQueueItem) => void;
  'queue:remove': (videoId: string) => void;
  'queue:vote': (data: { videoId: string; userId: string; votes: string[] }) => void;
  'queue:sync': (queue: VideoQueueItem[]) => void;
}

/**
 * YouTubeSyncEngine handles synchronization for YouTube videos
 * Similar pattern to SyncEngine but adapted for YouTube player
 */
export class YouTubeSyncEngine {
  private player: YouTubePlayerAdapter | null = null;
  private isHost: boolean = false;
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;
  private ignoreEvents: boolean = false;
  private eventHandlers: Partial<YouTubeSyncEventHandlers> = {};

  setPlayer(player: YouTubePlayerAdapter): void {
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

  /**
   * Register event handlers for YouTube sync events
   */
  on<K extends keyof YouTubeSyncEventHandlers>(
    event: K,
    handler: YouTubeSyncEventHandlers[K]
  ): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Unregister event handlers
   */
  off<K extends keyof YouTubeSyncEventHandlers>(event: K): void {
    delete this.eventHandlers[event];
  }

  // Host: start broadcasting sync state every SYNC_INTERVAL_MS
  private startBroadcasting(): void {
    this.stopBroadcasting();
    this.broadcastInterval = setInterval(() => {
      if (!this.player) return;
      
      const videoId = this.player.getVideoId();
      if (!videoId) return;

      const state: YouTubeSyncState = {
        videoId,
        currentTime: this.player.getCurrentTime(),
        isPlaying: this.player.isPlaying(),
        timestamp: Date.now(),
      };
      getSocket().emit('youtube:state', state);
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
    getSocket().emit('youtube:play');
  }

  emitPause(): void {
    if (!this.isHost || !this.player) return;
    getSocket().emit('youtube:pause');
  }

  emitSeek(time: number): void {
    if (!this.isHost) return;
    getSocket().emit('youtube:seek', { time });
  }

  emitSource(videoId: string | null): void {
    if (!this.isHost) return;
    getSocket().emit('youtube:source', { videoId });
  }

  // Queue operations
  emitQueueAdd(video: Omit<VideoQueueItem, 'position' | 'votes'>): void {
    getSocket().emit('queue:add', { video });
  }

  emitQueueRemove(videoId: string): void {
    getSocket().emit('queue:remove', { videoId });
  }

  emitQueueVote(videoId: string): void {
    getSocket().emit('queue:vote', { videoId });
  }

  // Peer: handle incoming sync state from host
  handleSyncState(state: YouTubeSyncState): void {
    if (this.isHost || !this.player || this.ignoreEvents) return;

    // Check if video source changed
    const currentVideoId = this.player.getVideoId();
    if (state.videoId && state.videoId !== currentVideoId) {
      // Trigger source change handler
      this.eventHandlers['youtube:source']?.(state.videoId);
      return;
    }

    // Estimate where the host is NOW (accounting for network delay)
    const elapsed = (Date.now() - state.timestamp) / 1000;
    const estimatedHostTime = state.isPlaying
      ? state.currentTime + elapsed
      : state.currentTime;

    const myTime = this.player.getCurrentTime();
    const drift = Math.abs(myTime - estimatedHostTime);

    if (drift > 0.5) {
      // > 500ms: force seek
      this.ignoreEvents = true;
      this.player.seekTo(estimatedHostTime);
      setTimeout(() => {
        this.ignoreEvents = false;
      }, 500);
    }

    // Match play/pause state
    if (state.isPlaying && !this.player.isPlaying()) {
      this.player.play();
    } else if (!state.isPlaying && this.player.isPlaying()) {
      this.player.pause();
    }
  }

  // Peer: handle discrete events
  handlePlay(): void {
    if (this.isHost || !this.player) return;
    this.ignoreEvents = true;
    this.player.play();
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
  }

  handlePause(): void {
    if (this.isHost || !this.player) return;
    this.ignoreEvents = true;
    this.player.pause();
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
  }

  handleSeek(time: number): void {
    if (this.isHost || !this.player) return;
    this.ignoreEvents = true;
    this.player.seekTo(time);
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
  }

  handleSource(videoId: string | null): void {
    if (this.isHost) return;
    this.eventHandlers['youtube:source']?.(videoId);
  }

  // Queue event handlers
  handleQueueAdd(video: VideoQueueItem): void {
    this.eventHandlers['queue:add']?.(video);
  }

  handleQueueRemove(videoId: string): void {
    this.eventHandlers['queue:remove']?.(videoId);
  }

  handleQueueVote(data: { videoId: string; userId: string; votes: string[] }): void {
    this.eventHandlers['queue:vote']?.(data);
  }

  handleQueueSync(queue: VideoQueueItem[]): void {
    this.eventHandlers['queue:sync']?.(queue);
  }

  // Request current state (for late joiners)
  requestSync(): void {
    getSocket().emit('youtube:request');
  }

  requestQueue(): void {
    getSocket().emit('queue:request');
  }

  isIgnoringEvents(): boolean {
    return this.ignoreEvents;
  }

  destroy(): void {
    this.stopBroadcasting();
    this.player = null;
    this.eventHandlers = {};
  }
}

export const youTubeSyncEngine = new YouTubeSyncEngine();
