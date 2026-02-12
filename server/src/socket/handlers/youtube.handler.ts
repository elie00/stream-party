import { Server, Socket } from 'socket.io';
import type { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  YouTubeSyncState,
  VideoQueueItem 
} from '@stream-party/shared';
import { getRoomBySocket, getRoom } from '../roomState';
import { logger } from '../../utils/logger';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Store YouTube state per room
const youTubeStates = new Map<string, YouTubeSyncState>();

// Store video queues per room
const videoQueues = new Map<string, VideoQueueItem[]>();

// Vote skip threshold (percentage of participants needed to skip)
const VOTE_SKIP_THRESHOLD = 0.5;

/**
 * Get YouTube state for a room
 */
export function getYouTubeState(roomCode: string): YouTubeSyncState | undefined {
  return youTubeStates.get(roomCode);
}

/**
 * Get video queue for a room
 */
export function getVideoQueue(roomCode: string): VideoQueueItem[] {
  return videoQueues.get(roomCode) || [];
}

/**
 * Register YouTube and Queue event handlers
 */
export function registerYouTubeHandlers(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  // ===== YouTube Source Events =====

  // Host changes YouTube video source
  socket.on('youtube:source', (data: { videoId: string | null }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;

    const state: YouTubeSyncState = {
      videoId: data.videoId,
      currentTime: 0,
      isPlaying: false,
      timestamp: Date.now(),
    };

    youTubeStates.set(room.code, state);

    // Broadcast to everyone else in the room
    socket.to(room.code).emit('youtube:source', { videoId: data.videoId });
    
    logger.debug(`YouTube source changed in room ${room.code}: ${data.videoId}`);
  });

  // Host broadcasts YouTube sync state
  socket.on('youtube:state', (state: YouTubeSyncState) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;

    youTubeStates.set(room.code, state);
    socket.to(room.code).emit('youtube:state', state);
  });

  // Host plays YouTube video
  socket.on('youtube:play', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;

    // Update state
    const state = youTubeStates.get(room.code);
    if (state) {
      state.isPlaying = true;
      state.timestamp = Date.now();
      youTubeStates.set(room.code, state);
    }

    socket.to(room.code).emit('youtube:play');
    logger.debug(`YouTube play in room ${room.code}`);
  });

  // Host pauses YouTube video
  socket.on('youtube:pause', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;

    // Update state
    const state = youTubeStates.get(room.code);
    if (state) {
      state.isPlaying = false;
      state.timestamp = Date.now();
      youTubeStates.set(room.code, state);
    }

    socket.to(room.code).emit('youtube:pause');
    logger.debug(`YouTube pause in room ${room.code}`);
  });

  // Host seeks in YouTube video
  socket.on('youtube:seek', (data: { time: number }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== user.userId) return;

    // Update state
    const state = youTubeStates.get(room.code);
    if (state) {
      state.currentTime = data.time;
      state.timestamp = Date.now();
      youTubeStates.set(room.code, state);
    }

    socket.to(room.code).emit('youtube:seek', { time: data.time });
    logger.debug(`YouTube seek in room ${room.code} to ${data.time}`);
  });

  // Late joiner requests current YouTube state
  socket.on('youtube:request', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const state = youTubeStates.get(room.code);
    if (state) {
      socket.emit('youtube:state', state);
    }
  });

  // ===== Queue Events =====

  // Add video to queue
  socket.on('queue:add', (data: { video: Omit<VideoQueueItem, 'position' | 'votes'> }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    let queue = videoQueues.get(room.code) || [];
    
    const newItem: VideoQueueItem = {
      ...data.video,
      position: queue.length,
      votes: [],
    };

    queue.push(newItem);
    videoQueues.set(room.code, queue);

    // Broadcast to entire room
    io.to(room.code).emit('queue:add', { video: newItem });
    logger.debug(`Video added to queue in room ${room.code}: ${data.video.id}`);
  });

  // Remove video from queue
  socket.on('queue:remove', (data: { videoId: string }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    let queue = videoQueues.get(room.code) || [];
    const index = queue.findIndex(v => v.id === data.videoId);
    
    if (index !== -1) {
      queue.splice(index, 1);
      // Re-index positions
      queue = queue.map((v, i) => ({ ...v, position: i }));
      videoQueues.set(room.code, queue);

      // Broadcast to entire room
      io.to(room.code).emit('queue:remove', { videoId: data.videoId });
      logger.debug(`Video removed from queue in room ${room.code}: ${data.videoId}`);
    }
  });

  // Vote to skip video
  socket.on('queue:vote', (data: { videoId: string }) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const queue = videoQueues.get(room.code) || [];
    const videoIndex = queue.findIndex(v => v.id === data.videoId);
    
    if (videoIndex === -1) return;

    const video = queue[videoIndex];
    const participantCount = room.participants.size;
    
    // Toggle vote
    const voteIndex = video.votes.indexOf(user.userId);
    if (voteIndex === -1) {
      video.votes.push(user.userId);
    } else {
      video.votes.splice(voteIndex, 1);
    }

    // Check if skip threshold reached
    const votesNeeded = Math.ceil(participantCount * VOTE_SKIP_THRESHOLD);
    if (video.votes.length >= votesNeeded && videoIndex === 0) {
      // Skip current video - remove from queue
      queue.shift();
      const updatedQueue = queue.map((v, i) => ({ ...v, position: i }));
      videoQueues.set(room.code, updatedQueue);
      
      // Broadcast queue sync
      io.to(room.code).emit('queue:sync', { queue: updatedQueue });
      logger.debug(`Video skipped in room ${room.code} by vote: ${data.videoId}`);
    } else {
      // Just broadcast vote update
      videoQueues.set(room.code, [...queue]);
      io.to(room.code).emit('queue:vote', { 
        videoId: data.videoId, 
        userId: user.userId, 
        votes: video.votes 
      });
    }
  });

  // Request current queue state
  socket.on('queue:request', () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;

    const queue = videoQueues.get(room.code) || [];
    socket.emit('queue:sync', { queue });
  });
}

/**
 * Clean up YouTube state when room is deleted
 */
export function cleanupYouTubeState(roomCode: string): void {
  youTubeStates.delete(roomCode);
  videoQueues.delete(roomCode);
  logger.debug(`Cleaned up YouTube state for room ${roomCode}`);
}
