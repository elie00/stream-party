import { useEffect, useCallback } from 'react';
import { FileAttachment, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } from '@stream-party/shared';

interface FilePreviewProps {
  attachment: FileAttachment;
  onClose: () => void;
}

export function FilePreview({ attachment, onClose }: FilePreviewProps) {
  const isImage = IMAGE_MIME_TYPES.includes(attachment.mimeType);
  const isVideo = VIDEO_MIME_TYPES.includes(attachment.mimeType);
  const isPdf = attachment.mimeType === 'application/pdf';

  const getFileUrl = (): string => {
    return `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}${attachment.url}`;
  };

  const getDownloadUrl = (): string => {
    return `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/files/${attachment.id}/download`;
  };

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        aria-label="Close preview"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* File info */}
      <div className="absolute top-4 left-4 text-white/70 text-sm max-w-[calc(100%-120px)] truncate">
        {attachment.originalName}
      </div>

      {/* Content */}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {isImage && (
          <img
            src={getFileUrl()}
            alt={attachment.originalName}
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        )}

        {isVideo && (
          <video
            src={getFileUrl()}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
          >
            Your browser does not support the video tag.
          </video>
        )}

        {isPdf && (
          <iframe
            src={getFileUrl()}
            title={attachment.originalName}
            className="w-[90vw] h-[90vh] rounded-lg shadow-2xl bg-white"
          />
        )}

        {!isImage && !isVideo && !isPdf && (
          <div className="text-center text-white">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-[#333] flex items-center justify-center">
              <svg className="w-12 h-12 text-[#606060]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-lg mb-2">{attachment.originalName}</p>
            <p className="text-[#606060] mb-4">Preview not available for this file type</p>
            <a
              href={getDownloadUrl()}
              download={attachment.originalName}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download file
            </a>
          </div>
        )}
      </div>

      {/* Download button for previewable files */}
      {(isImage || isVideo) && (
        <a
          href={getDownloadUrl()}
          download={attachment.originalName}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download
        </a>
      )}

      {/* Navigation hint */}
      <div className="absolute bottom-4 left-4 text-white/50 text-xs">
        Press ESC to close
      </div>
    </div>
  );
}
