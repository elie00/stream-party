import { useState, useCallback, useRef } from 'react';
import {
  MAX_FILE_UPLOAD_SIZE,
  ALLOWED_FILE_MIME_TYPES,
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
} from '@stream-party/shared';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
}

interface FilePreview {
  file: File;
  preview: string | null;
  error?: string;
}

export function FileUpload({
  onFileSelect,
  onFilesSelect,
  disabled = false,
  multiple = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_UPLOAD_SIZE) {
      return `File size exceeds ${(MAX_FILE_UPLOAD_SIZE / 1024 / 1024).toFixed(0)}MB limit`;
    }
    if (!ALLOWED_FILE_MIME_TYPES.includes(file.type)) {
      return `File type ${file.type} is not allowed`;
    }
    return null;
  };

  const generatePreview = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      if (IMAGE_MIME_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string | null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      } else if (VIDEO_MIME_TYPES.includes(file.type)) {
        const url = URL.createObjectURL(file);
        resolve(url);
      } else {
        resolve(null);
      }
    });
  };

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);

      if (fileArray.length === 0) return;

      const validFiles: File[] = [];
      const newPreviews: FilePreview[] = [];

      for (const file of fileArray) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        validFiles.push(file);
        const preview = await generatePreview(file);
        newPreviews.push({ file, preview });
      }

      if (validFiles.length > 0) {
        setPreviews(newPreviews);
        if (multiple && onFilesSelect) {
          onFilesSelect(validFiles);
        } else {
          onFileSelect(validFiles[0]);
        }
      }
    },
    [onFileSelect, onFilesSelect, multiple],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      processFiles(files);
    },
    [disabled, processFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles],
  );

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const clearPreviews = useCallback(() => {
    setPreviews([]);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="relative">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging
            ? 'border-[#7c3aed] bg-[#7c3aed]/10'
            : 'border-[#444] hover:border-[#666] bg-[#252525]'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          onChange={handleInputChange}
          accept={ALLOWED_FILE_MIME_TYPES.join(',')}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2">
          <svg
            className={`w-8 h-8 ${isDragging ? 'text-[#7c3aed]' : 'text-[#606060]'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm text-[#888]">
            {isDragging ? 'Drop file here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-xs text-[#606060]">
            Max size: {(MAX_FILE_UPLOAD_SIZE / 1024 / 1024).toFixed(0)}MB
          </p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* File previews */}
      {previews.length > 0 && (
        <div className="mt-3 space-y-2">
          {previews.map((preview, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-2 bg-[#252525] rounded-lg"
            >
              {/* Thumbnail */}
              <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-[#333] flex items-center justify-center">
                {preview.preview ? (
                  IMAGE_MIME_TYPES.includes(preview.file.type) ? (
                    <img
                      src={preview.preview}
                      alt={preview.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={preview.preview}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <svg
                    className="w-6 h-6 text-[#606060]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
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
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{preview.file.name}</p>
                <p className="text-xs text-[#606060]">{formatFileSize(preview.file.size)}</p>
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearPreviews();
                }}
                className="p-1 hover:bg-[#333] rounded transition-colors"
              >
                <svg
                  className="w-4 h-4 text-[#606060] hover:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
