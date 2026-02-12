/**
 * Video Queue Component
 * Displays a list of queued videos with voting functionality
 */
import type { VideoQueueItem } from '@stream-party/shared';

interface VideoQueueProps {
  queue: VideoQueueItem[];
  currentVideo: VideoQueueItem | null;
  currentUserId: string;
  onVote: (videoId: string) => void;
  onRemove: (videoId: string) => void;
  isHost?: boolean;
}

// Format duration from seconds to mm:ss or hh:mm:ss
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function VideoQueue({
  queue,
  currentVideo,
  currentUserId,
  onVote,
  onRemove,
  isHost = false,
}: VideoQueueProps) {
  if (queue.length === 0 && !currentVideo) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4">
        <div className="text-center text-[#666] text-sm">
          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
          No videos in queue
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-white text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z" />
          </svg>
          Queue
          <span className="text-[#666] text-xs">({queue.length} videos)</span>
        </h3>
      </div>

      {/* Current Video */}
      {currentVideo && (
        <div className="p-2 border-b border-[#333] bg-[#222]">
          <div className="flex gap-2">
            <div className="relative flex-shrink-0">
              <img
                src={currentVideo.thumbnail}
                alt={currentVideo.title}
                className="w-24 h-14 object-cover rounded"
              />
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                {formatDuration(currentVideo.duration)}
              </span>
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium line-clamp-2 mb-0.5">
                {currentVideo.title}
              </p>
              <p className="text-[#888] text-xs">{currentVideo.channel}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="bg-[#7c3aed] text-white text-xs px-1.5 py-0.5 rounded">
                  Now Playing
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="max-h-64 overflow-y-auto">
        {queue.map((video, index) => {
          const hasVoted = video.votes.includes(currentUserId);
          const voteCount = video.votes.length;

          return (
            <div
              key={video.id}
              className="p-2 border-b border-[#333] last:border-b-0 hover:bg-[#222] transition-colors group"
            >
              <div className="flex gap-2">
                {/* Position */}
                <div className="flex-shrink-0 w-6 flex items-center justify-center">
                  <span className="text-[#666] text-xs font-medium">
                    {index + 1}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="relative flex-shrink-0">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-20 h-12 object-cover rounded"
                  />
                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-xs px-1 rounded">
                    {formatDuration(video.duration)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium line-clamp-2 mb-0.5">
                    {video.title}
                  </p>
                  <p className="text-[#666] text-xs">
                    {video.channel} • {formatRelativeTime(video.addedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {/* Vote Button */}
                  <button
                    onClick={() => onVote(video.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      hasVoted
                        ? 'bg-[#7c3aed] text-white'
                        : 'bg-[#333] text-[#888] hover:bg-[#444] hover:text-white'
                    }`}
                    title={hasVoted ? 'Voted' : 'Vote to skip'}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4l-8 8h6v8h4v-8h6z" />
                    </svg>
                    {voteCount > 0 && <span>{voteCount}</span>}
                  </button>

                  {/* Remove Button (host only) */}
                  {isHost && (
                    <button
                      onClick={() => onRemove(video.id)}
                      className="p-1 rounded text-[#666] hover:text-red-400 hover:bg-[#333] transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from queue"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {queue.length > 0 && (
        <div className="px-4 py-2 border-t border-[#333] bg-[#222]">
          <p className="text-[#666] text-xs text-center">
            Vote to skip • Most votes plays next
          </p>
        </div>
      )}
    </div>
  );
}

export default VideoQueue;
