import type { TorrentFileInfo } from '../../services/webtorrent';

interface FileSelectorProps {
  files: TorrentFileInfo[];
  onSelect: (fileIndex: number) => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function FileSelector({ files, onSelect, onClose }: FileSelectorProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <h2 className="text-lg font-semibold">Select a Video File</h2>
          <button
            onClick={onClose}
            className="text-[#a0a0a0] hover:text-white transition-colors text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* File list */}
        <div className="max-h-80 overflow-y-auto p-2">
          {files.length === 0 ? (
            <div className="text-center text-[#a0a0a0] py-8 text-sm">
              No video files found in this torrent.
            </div>
          ) : (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.index}>
                  <button
                    onClick={() => onSelect(file.index)}
                    className="w-full text-left px-4 py-3 rounded-lg hover:bg-[#2a2a2a] transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white group-hover:text-[#a78bfa] truncate mr-4">
                        {file.name}
                      </span>
                      <span className="text-xs text-[#666] whitespace-nowrap">
                        {formatBytes(file.length)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
