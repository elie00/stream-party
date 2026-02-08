import { useState, useEffect } from 'react';
import { webtorrentService } from '../../services/webtorrent';
import type { TorrentStats } from '../../services/webtorrent';

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '0 KB/s';
  const k = 1024;
  if (bytesPerSecond < k * k) {
    return `${(bytesPerSecond / k).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSecond / (k * k)).toFixed(1)} MB/s`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function TorrentStatus() {
  const [stats, setStats] = useState<TorrentStats | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(webtorrentService.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const progressPercent = Math.round(stats.progress * 100);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-[#1a1a1a] border-t border-[#333] text-xs text-[#a0a0a0]">
      {/* Progress bar */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7c3aed] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="whitespace-nowrap">{progressPercent}%</span>
      </div>

      {/* Download/Upload */}
      <div className="flex items-center gap-3 whitespace-nowrap">
        <span title="Download speed">
          ↓ {formatSpeed(stats.downloadSpeed)}
        </span>
        <span title="Upload speed">
          ↑ {formatSpeed(stats.uploadSpeed)}
        </span>
      </div>

      {/* Peers */}
      <span title="Connected peers" className="whitespace-nowrap">
        {stats.numPeers} {stats.numPeers === 1 ? 'peer' : 'peers'}
      </span>

      {/* Downloaded / Total */}
      <span className="whitespace-nowrap">
        {formatBytes(stats.downloaded)} / {formatBytes(stats.total)}
      </span>
    </div>
  );
}
