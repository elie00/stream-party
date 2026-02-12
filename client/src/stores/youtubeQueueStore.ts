/**
 * YouTube Queue Store
 * Manages the video queue state for YouTube playback
 */
import { create } from 'zustand';
import type { VideoQueueItem } from '@stream-party/shared';

interface YouTubeQueueState {
  // Current video being played
  currentVideo: VideoQueueItem | null;
  // Queue of upcoming videos
  queue: VideoQueueItem[];
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  // Video source state
  videoId: string | null;

  // Actions
  setCurrentVideo: (video: VideoQueueItem | null) => void;
  setVideoId: (videoId: string | null) => void;
  addToQueue: (video: VideoQueueItem) => void;
  removeFromQueue: (videoId: string) => void;
  vote: (videoId: string, userId: string) => void;
  playNext: () => VideoQueueItem | null;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setQueue: (queue: VideoQueueItem[]) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
}

export const useYouTubeQueueStore = create<YouTubeQueueState>((set, get) => ({
  currentVideo: null,
  queue: [],
  isPlaying: false,
  currentTime: 0,
  videoId: null,

  setCurrentVideo: (video) => {
    set({
      currentVideo: video,
      videoId: video?.id ?? null,
      currentTime: 0,
      isPlaying: video !== null,
    });
  },

  setVideoId: (videoId) => {
    set({ videoId });
  },

  addToQueue: (video) => {
    set((state) => {
      // Check if video already exists in queue
      const exists = state.queue.some((v) => v.id === video.id);
      if (exists) return state;

      // If no current video, set this as current
      if (!state.currentVideo) {
        return {
          currentVideo: video,
          videoId: video.id,
          currentTime: 0,
          isPlaying: true,
        };
      }

      // Otherwise add to queue
      const position = state.queue.length;
      return {
        queue: [...state.queue, { ...video, position }],
      };
    });
  },

  removeFromQueue: (videoId) => {
    set((state) => {
      const newQueue = state.queue
        .filter((v) => v.id !== videoId)
        .map((v, index) => ({ ...v, position: index }));

      // If removing current video, play next
      if (state.currentVideo?.id === videoId) {
        const nextVideo = newQueue[0] ?? null;
        return {
          currentVideo: nextVideo,
          videoId: nextVideo?.id ?? null,
          queue: nextVideo ? newQueue.slice(1) : [],
          currentTime: 0,
          isPlaying: nextVideo !== null,
        };
      }

      return { queue: newQueue };
    });
  },

  vote: (videoId, userId) => {
    set((state) => {
      const updateVotes = (video: VideoQueueItem): VideoQueueItem => {
        if (video.id !== videoId) return video;
        const votes = video.votes.includes(userId)
          ? video.votes.filter((id) => id !== userId)
          : [...video.votes, userId];
        return { ...video, votes };
      };

      // Check current video
      if (state.currentVideo?.id === videoId) {
        return {
          currentVideo: updateVotes(state.currentVideo),
        };
      }

      // Check queue
      return {
        queue: state.queue.map(updateVotes),
      };
    });
  },

  playNext: () => {
    const state = get();
    if (state.queue.length === 0) {
      set({
        currentVideo: null,
        videoId: null,
        currentTime: 0,
        isPlaying: false,
      });
      return null;
    }

    const [nextVideo, ...remainingQueue] = state.queue;
    set({
      currentVideo: nextVideo,
      videoId: nextVideo.id,
      queue: remainingQueue.map((v, index) => ({ ...v, position: index })),
      currentTime: 0,
      isPlaying: true,
    });

    return nextVideo;
  },

  setIsPlaying: (playing) => {
    set({ isPlaying: playing });
  },

  setCurrentTime: (time) => {
    set({ currentTime: time });
  },

  setQueue: (queue) => {
    set({ queue });
  },

  clearQueue: () => {
    set({
      currentVideo: null,
      videoId: null,
      queue: [],
      isPlaying: false,
      currentTime: 0,
    });
  },

  reorderQueue: (fromIndex, toIndex) => {
    set((state) => {
      if (fromIndex < 0 || fromIndex >= state.queue.length) return state;
      if (toIndex < 0 || toIndex >= state.queue.length) return state;

      const newQueue = [...state.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);

      // Update positions
      return {
        queue: newQueue.map((v, index) => ({ ...v, position: index })),
      };
    });
  },
}));

// Selectors for computed values
export const useQueueLength = () => useYouTubeQueueStore((state) => state.queue.length);
export const useHasQueue = () => useYouTubeQueueStore((state) => state.queue.length > 0);
export const useCurrentVideoId = () => useYouTubeQueueStore((state) => state.videoId);
export const useIsYouTubePlaying = () => useYouTubeQueueStore((state) => state.isPlaying);
