/**
 * Custom hook for managing WebTorrent operations
 */
import { useState, useCallback } from 'react';
import { webtorrentService } from '../services/webtorrent';
import type { TorrentFileInfo } from '../services/webtorrent';
import { useToastStore } from '../components/ui/Toast';

interface UseTorrentOptions {
  isHost: boolean;
  onFileSelectNeeded?: (files: TorrentFileInfo[]) => void;
}

interface UseTorrentReturn {
  videoSrc: string | null;
  torrentFiles: TorrentFileInfo[];
  showFileSelector: boolean;
  torrentActive: boolean;
  torrentLoading: boolean;
  torrentError: string | null;
  loadTorrent: (magnetUri: string, fileIndex: number | null) => Promise<void>;
  handleFileSelect: (fileIndex: number) => Promise<void>;
  closeFileSelector: () => void;
  clearTorrent: () => void;
}

export function useTorrent(options: UseTorrentOptions): UseTorrentReturn {
  const { isHost, onFileSelectNeeded } = options;
  const addToast = useToastStore((state) => state.addToast);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [torrentFiles, setTorrentFiles] = useState<TorrentFileInfo[]>([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [torrentActive, setTorrentActive] = useState(false);
  const [torrentLoading, setTorrentLoading] = useState(false);
  const [torrentError, setTorrentError] = useState<string | null>(null);

  const loadTorrent = useCallback(
    async (magnetUri: string, fileIndex: number | null) => {
      setTorrentLoading(true);
      setTorrentError(null);
      setVideoSrc(null);
      setTorrentActive(false);

      try {
        await webtorrentService.addTorrent(magnetUri);
        setTorrentActive(true);

        const videoFiles = webtorrentService.getVideoFiles();

        if (videoFiles.length === 0) {
          setTorrentError('No video files found in this torrent.');
          setTorrentLoading(false);
          return;
        }

        // If fileIndex provided, use it directly
        if (fileIndex !== null) {
          const url = await webtorrentService.getStreamUrl(fileIndex);
          setVideoSrc(url);
          setTorrentLoading(false);
          return;
        }

        // Auto-select if only one video file
        if (videoFiles.length === 1) {
          const url = await webtorrentService.getStreamUrl(videoFiles[0].index);
          setVideoSrc(url);
          setTorrentLoading(false);

          // If host, notify server of file selection
          if (isHost) {
            const { getSocket } = await import('../services/socket');
            const socket = getSocket();
            socket.emit('room:select-file', { fileIndex: videoFiles[0].index });
          }
          return;
        }

        // Multiple files: show selector (host) or wait for host selection (non-host)
        setTorrentFiles(videoFiles);
        if (isHost) {
          setShowFileSelector(true);
          onFileSelectNeeded?.(videoFiles);
        }
        setTorrentLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load torrent';
        setTorrentError(message);
        addToast('Failed to load torrent', 'error');
        setTorrentLoading(false);
      }
    },
    [isHost, addToast, onFileSelectNeeded]
  );

  const handleFileSelect = useCallback(
    async (fileIndex: number) => {
      setShowFileSelector(false);
      setTorrentLoading(true);

      try {
        const url = await webtorrentService.getStreamUrl(fileIndex);
        setVideoSrc(url);

        if (isHost) {
          const { getSocket } = await import('../services/socket');
          const socket = getSocket();
          socket.emit('room:select-file', { fileIndex });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load file';
        setTorrentError(message);
        addToast(message, 'error');
      }

      setTorrentLoading(false);
    },
    [isHost, addToast]
  );

  const closeFileSelector = useCallback(() => {
    setShowFileSelector(false);
  }, []);

  const clearTorrent = useCallback(() => {
    webtorrentService.removeTorrent();
    setVideoSrc(null);
    setTorrentFiles([]);
    setShowFileSelector(false);
    setTorrentActive(false);
    setTorrentLoading(false);
    setTorrentError(null);
  }, []);

  return {
    videoSrc,
    torrentFiles,
    showFileSelector,
    torrentActive,
    torrentLoading,
    torrentError,
    loadTorrent,
    handleFileSelect,
    closeFileSelector,
    clearTorrent,
  };
}
