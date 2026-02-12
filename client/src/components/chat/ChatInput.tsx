import { useState, useRef, useCallback, useEffect } from 'react';
import { MAX_CHAT_MESSAGE_LENGTH, MAX_FILE_UPLOAD_SIZE, ALLOWED_FILE_MIME_TYPES } from '@stream-party/shared';
import { FileUpload } from './FileUpload';
import { api } from '../../services/api';

interface PendingFile {
  file: File;
  preview: string | null;
  uploading: boolean;
  error?: string;
  uploadedId?: string;
}

interface ChatInputProps {
  onSend: (content: string, attachments?: string[]) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export function ChatInput({ onSend, onTypingStart, onTypingStop }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator after 300ms of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop();
    }, 300);
  }, [onTypingStart, onTypingStop]);

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/files/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.id;
    } catch (error) {
      console.error('Failed to upload file:', error);
      return null;
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    const hasFiles = pendingFiles.length > 0;

    if (!trimmed && !hasFiles) return;

    // Upload any pending files that haven't been uploaded yet
    const attachmentIds: string[] = [];

    for (const pendingFile of pendingFiles) {
      if (pendingFile.uploadedId) {
        attachmentIds.push(pendingFile.uploadedId);
      } else if (!pendingFile.uploading) {
        // Mark as uploading
        setPendingFiles((prev) =>
          prev.map((pf) =>
            pf.file === pendingFile.file ? { ...pf, uploading: true } : pf
          )
        );

        const uploadedId = await uploadFile(pendingFile.file);
        if (uploadedId) {
          attachmentIds.push(uploadedId);
          setPendingFiles((prev) =>
            prev.map((pf) =>
              pf.file === pendingFile.file ? { ...pf, uploadedId, uploading: false } : pf
            )
          );
        } else {
          setPendingFiles((prev) =>
            prev.map((pf) =>
              pf.file === pendingFile.file
                ? { ...pf, uploading: false, error: 'Failed to upload' }
                : pf
            )
          );
        }
      }
    }

    onSend(trimmed, attachmentIds.length > 0 ? attachmentIds : undefined);
    setValue('');
    setPendingFiles([]);
    setShowFileUpload(false);

    // Stop typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop();
    }
  }, [value, pendingFiles, onSend, onTypingStop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= MAX_CHAT_MESSAGE_LENGTH) {
        setValue(newValue);
        if (newValue.trim()) {
          handleTyping();
        }
      }
    },
    [handleTyping],
  );

  const handleFileSelect = useCallback((file: File) => {
    // Generate preview for images
    let preview: string | null = null;
    if (file.type.startsWith('image/')) {
      preview = URL.createObjectURL(file);
    }

    setPendingFiles((prev) => [...prev, { file, preview, uploading: false }]);
    setShowFileUpload(false);
  }, []);

  const handleRemoveFile = useCallback((file: File) => {
    setPendingFiles((prev) => {
      const pending = prev.find((pf) => pf.file === file);
      if (pending?.preview) {
        URL.revokeObjectURL(pending.preview);
      }
      return prev.filter((pf) => pf.file !== file);
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (ALLOWED_FILE_MIME_TYPES.includes(file.type) && file.size <= MAX_FILE_UPLOAD_SIZE) {
          handleFileSelect(file);
        }
      }
    },
    [handleFileSelect]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Cleanup preview URLs
      for (const pending of pendingFiles) {
        if (pending.preview) {
          URL.revokeObjectURL(pending.preview);
        }
      }
    };
  }, [pendingFiles]);

  const showCharCount = value.length > 400;
  const canSend = value.trim() || pendingFiles.length > 0;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      className="px-3 py-2.5 border-t border-[#333]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingFiles.map((pending, index) => (
            <div
              key={index}
              className="relative group flex items-center gap-2 bg-[#252525] rounded-lg p-2 border border-[#333]"
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded overflow-hidden bg-[#333] flex items-center justify-center flex-shrink-0">
                {pending.preview ? (
                  <img src={pending.preview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-[#606060]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
              </div>

              {/* File info */}
              <div className="min-w-0 max-w-[120px]">
                <p className="text-xs text-white truncate">{pending.file.name}</p>
                <p className="text-[10px] text-[#606060]">{formatFileSize(pending.file.size)}</p>
              </div>

              {/* Uploading indicator */}
              {pending.uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => handleRemoveFile(pending.file)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Error indicator */}
              {pending.error && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-red-400 bg-red-500/20 px-1 rounded">
                  {pending.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File upload dropdown */}
      {showFileUpload && (
        <div className="mb-2">
          <FileUpload onFileSelect={handleFileSelect} />
        </div>
      )}

      <div className="flex items-center gap-2">
        {/* File upload button */}
        <button
          onClick={() => setShowFileUpload(!showFileUpload)}
          className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
            showFileUpload
              ? 'bg-[#7c3aed] text-white'
              : 'bg-[#252525] text-[#606060] hover:text-white hover:bg-[#333]'
          }`}
          aria-label="Attach file"
          title="Attach file"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>

        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          maxLength={MAX_CHAT_MESSAGE_LENGTH}
          className="flex-1 bg-[#252525] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#7c3aed] transition-colors placeholder:text-[#606060]"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#333] disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors flex-shrink-0"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </div>
      {showCharCount && (
        <div className="text-right mt-1">
          <span
            className={`text-[10px] ${
              value.length >= MAX_CHAT_MESSAGE_LENGTH ? 'text-red-400' : 'text-[#606060]'
            }`}
          >
            {value.length}/{MAX_CHAT_MESSAGE_LENGTH}
          </span>
        </div>
      )}
    </div>
  );
}
