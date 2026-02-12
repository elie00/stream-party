import { useState, useEffect, useCallback } from 'react';
import { webtorrentService, TorrentStats } from '../../services/webtorrent';

interface TorrentDownloadProps {
  magnetUri: string;
  filename: string;
  size: number;
  onComplete?: (url: string) => void;
  onError?: (error: string) => void;
}

export function TorrentDownload({
  magnetUri,
  filename,
  size,
  onComplete,
  onError,
}: TorrentDownloadProps) {
  const [status, setStatus] = useState<'connecting' | 'downloading' | 'complete' | 'error'>('connecting');
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<TorrentStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const startDownload = useCallback(async () => {
    try {
      setStatus('connecting');
      setError(null);

      const torrent = await webtorrentService.addTorrent(magnetUri);
      setStatus('downloading');

      // Update progress periodically
      const interval = setInterval(() => {
        const currentStats = webtorrentService.getStats();
        if (currentStats) {
          setStats(currentStats);
          setProgress(currentStats.progress * 100);

          if (currentStats.progress >= 1) {
            clearInterval(interval);
            setStatus('complete');
            // Get the file URL
            const files = webtorrentService.getFiles();
            if (files.length > 0) {
              webtorrentService.getStreamUrl(0).then((url) => {
                onComplete?.(url);
              });
            }
          }
        }
      }, 500);

      // Cleanup interval on unmount
      return () => clearInterval(interval);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start download';
      setError(errorMessage);
      setStatus('error');
      onError?.(errorMessage);
    }
  }, [magnetUri, onComplete, onError]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const init = async () => {
      cleanup = await startDownload();
    };

    init();

    return () => {
      cleanup?.();
    };
  }, [startDownload]);

  const handleRetry = () => {
    startDownload();
  };

  return (
    <div className="bg-[#252525] rounded-lg p-3 border border-[#333] max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded bg-[#7c3aed]/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-[#7c3aed]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{filename}</p>
          <p className="text-xs text-[#606060]">{formatFileSize(size)}</p>
        </div>
      </div>

      {/* Status indicator */}
      {status === 'connecting' && (
        <div className="flex items-center gap-2 text-[#606060] text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Connecting to peers...
        </div>
      )}

      {status === 'downloading' && (
        <>
          {/* Progress bar */}
          <div className="mb-2">
            <div className="h-2 bg-[#333] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#7c3aed] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex items-center justify-between text-xs text-[#606060]">
              <span>{progress.toFixed(1)}%</span>
              <span>{formatSpeed(stats.downloadSpeed)}</span>
              <span>{stats.numPeers} peers</span>
            </div>
          )}
        </>
      )}

      {status === 'complete' && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Download complete
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error || 'Download failed'}
          </div>
          <button
            onClick={handleRetry}
            className="text-xs text-[#7c3aed] hover:text-[#6d28d9] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Torrent info */}
      <div className="mt-2 pt-2 border-t border-[#333]">
        <p className="text-[10px] text-[#606060] truncate">
          magnet:?xt=urn:btih:{magnetUri.substring(0, 20)}...
        </p>
      </div>
    </div>
  );
}
