import { useState } from 'react';
import { FileAttachment as FileAttachmentType, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from '@stream-party/shared';
import { FilePreview } from './FilePreview';

interface FileAttachmentProps {
  attachment: FileAttachmentType;
  showPreview?: boolean;
}

export function FileAttachment({ attachment, showPreview = true }: FileAttachmentProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const isImage = IMAGE_MIME_TYPES.includes(attachment.mimeType);
  const isVideo = VIDEO_MIME_TYPES.includes(attachment.mimeType);
  const isPreviewable = isImage || isVideo || attachment.mimeType === 'application/pdf';

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = () => {
    if (isImage) {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (isVideo) {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    if (attachment.mimeType === 'application/pdf') {
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    // Default file icon
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const getThumbnailUrl = (): string | null => {
    if (attachment.thumbnailPath) {
      // Construct thumbnail URL from the server
      const filename = attachment.thumbnailPath.split('/').pop();
      return `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/uploads/thumbnails/${filename}`;
    }
    if (isImage && attachment.url) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${attachment.url}`;
    }
    return null;
  };

  const getFileUrl = (): string => {
    if (attachment.type === 'torrent' && attachment.magnetUri) {
      return attachment.magnetUri;
    }
    return `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/files/${attachment.id}/download`;
  };

  const thumbnailUrl = getThumbnailUrl();

  return (
    <>
      <div className="bg-[#252525] rounded-lg overflow-hidden border border-[#333] max-w-md">
        {/* Thumbnail or icon */}
        {thumbnailUrl && showPreview ? (
          <div
            className="relative aspect-video bg-[#1a1a1a] cursor-pointer group"
            onClick={() => isPreviewable && setIsPreviewOpen(true)}
          >
            {isImage ? (
              <img
                src={thumbnailUrl}
                alt={attachment.originalName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <video
                src={thumbnailUrl}
                className="w-full h-full object-cover"
                muted
              />
            )}
            {isPreviewable && (
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#333] flex items-center justify-center text-[#606060]">
              {getFileIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{attachment.originalName}</p>
              <p className="text-xs text-[#606060]">{formatFileSize(attachment.size)}</p>
            </div>
          </div>
        )}

        {/* File info with download button */}
        {thumbnailUrl && (
          <div className="p-2 flex items-center justify-between border-t border-[#333]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-[#606060]">{getFileIcon()}</div>
              <div className="min-w-0">
                <p className="text-xs text-white truncate">{attachment.originalName}</p>
                <p className="text-[10px] text-[#606060]">{formatFileSize(attachment.size)}</p>
              </div>
            </div>
            <a
              href={getFileUrl()}
              download={attachment.originalName}
              className="p-1.5 hover:bg-[#333] rounded transition-colors text-[#606060] hover:text-white"
              title="Download"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          </div>
        )}

        {/* Torrent indicator */}
        {attachment.type === 'torrent' && (
          <div className="px-2 py-1 bg-[#7c3aed]/20 text-[#7c3aed] text-xs flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            WebTorrent
          </div>
        )}
      </div>

      {/* File preview modal */}
      {isPreviewOpen && isPreviewable && (
        <FilePreview
          attachment={attachment}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </>
  );
}
