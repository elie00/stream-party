import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  participants?: Array<{ userId: string; displayName: string }>;
  // Edit/Reply props
  editingMessage?: { id: string; content: string } | null;
  replyingToMessage?: { id: string; userName: string } | null;
  onCancelEdit?: () => void;
  onCancelReply?: () => void;
  onSubmitEdit?: (messageId: string, content: string) => void;
  onSubmitReply?: (content: string, parentId: string) => void;
}

export function ChatInput({ 
  onSend, 
  onTypingStart, 
  onTypingStop, 
  participants = [],
  editingMessage,
  replyingToMessage,
  onCancelEdit,
  onCancelReply,
  onSubmitEdit,
  onSubmitReply,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionsRef = useRef<HTMLDivElement>(null);

  // Set initial value when editing a message
  useEffect(() => {
    if (editingMessage) {
      setValue(editingMessage.content);
    }
  }, [editingMessage]);

  // Set initial value when replying to a message
  useEffect(() => {
    if (replyingToMessage && !editingMessage) {
      // Keep current value but will show reply indicator
    }
  }, [replyingToMessage, editingMessage]);

  // Filter participants based on mention query
  const filteredParticipants = useMemo(() => {
    if (!mentionQuery) return participants;
    const query = mentionQuery.toLowerCase();
    return participants.filter(p => 
      p.displayName.toLowerCase().includes(query)
    );
  }, [participants, mentionQuery]);

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

  const insertMention = useCallback((displayName: string) => {
    if (mentionStartIndex === -1) return;
    
    const beforeMention = value.slice(0, mentionStartIndex);
    const afterMention = value.slice(inputRef.current?.selectionStart || 0);
    const newValue = `${beforeMention}@${displayName} ${afterMention}`;
    
    setValue(newValue);
    setShowMentions(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
    setSelectedMentionIndex(0);
    
    // Focus input and move cursor after mention
    setTimeout(() => {
      inputRef.current?.focus();
      const cursorPos = beforeMention.length + displayName.length + 2;
      inputRef.current?.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }, [value, mentionStartIndex]);

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    const hasFiles = pendingFiles.length > 0;

    if (!trimmed && !hasFiles) return;

    // Handle edit mode
    if (editingMessage && onSubmitEdit) {
      onSubmitEdit(editingMessage.id, trimmed);
      setValue('');
      onCancelEdit?.();
      return;
    }

    // Handle reply mode
    if (replyingToMessage && onSubmitReply) {
      onSubmitReply(trimmed, replyingToMessage.id);
      setValue('');
      onCancelReply?.();
    }

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
    setShowMentions(false);

    // Stop typing indicator immediately
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop();
    }
  }, [value, pendingFiles, onSend, onTypingStop, editingMessage, replyingToMessage, onSubmitEdit, onCancelEdit, onSubmitReply, onCancelReply]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle mention list navigation
      if (showMentions && filteredParticipants.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedMentionIndex(prev => 
            prev < filteredParticipants.length - 1 ? prev + 1 : 0
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedMentionIndex(prev => 
            prev > 0 ? prev - 1 : filteredParticipants.length - 1
          );
          return;
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault();
          insertMention(filteredParticipants[selectedMentionIndex].displayName);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowMentions(false);
          setMentionQuery('');
          setMentionStartIndex(-1);
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend, showMentions, filteredParticipants, selectedMentionIndex, insertMention],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      
      if (newValue.length <= MAX_CHAT_MESSAGE_LENGTH) {
        setValue(newValue);
        
        // Check for @ mentions
        const lastAtIndex = newValue.lastIndexOf('@', cursorPos - 1);
        
        if (lastAtIndex !== -1) {
          // Check if there's a space between @ and cursor (which would end the mention)
          const textAfterAt = newValue.slice(lastAtIndex + 1, cursorPos);
          
          if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
            // Show mentions dropdown
            setMentionStartIndex(lastAtIndex);
            setMentionQuery(textAfterAt);
            setShowMentions(true);
            setSelectedMentionIndex(0);
          } else {
            setShowMentions(false);
            setMentionQuery('');
            setMentionStartIndex(-1);
          }
        } else {
          setShowMentions(false);
          setMentionQuery('');
          setMentionStartIndex(-1);
        }
        
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

  // Close mentions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionsRef.current &&
        !mentionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowMentions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      {/* Edit/Reply indicator */}
      {(editingMessage || replyingToMessage) && (
        <div className="mb-2 flex items-center justify-between bg-[#252525] rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            {editingMessage ? (
              <>
                <svg className="w-4 h-4 text-[#7c3aed]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="text-sm text-white">Modifier le message</span>
              </>
            ) : replyingToMessage ? (
              <>
                <svg className="w-4 h-4 text-[#7c3aed]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="text-sm text-white">
                  Répondre à <span className="font-medium">{replyingToMessage.userName}</span>
                </span>
              </>
            ) : null}
          </div>
          <button
            onClick={() => {
              if (editingMessage) {
                onCancelEdit?.();
                setValue('');
              }
              if (replyingToMessage) {
                onCancelReply?.();
              }
            }}
            className="text-[#a0a0a0] hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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

      <div className="flex items-center gap-2 relative">
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

        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Send a message... (@ pour mentionner)"
            maxLength={MAX_CHAT_MESSAGE_LENGTH}
            className="w-full bg-[#252525] text-white text-sm rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[#7c3aed] transition-colors placeholder:text-[#606060]"
          />

          {/* Mentions dropdown */}
          {showMentions && filteredParticipants.length > 0 && (
            <div
              ref={mentionsRef}
              className="absolute bottom-full left-0 mb-1 w-full max-h-48 overflow-y-auto bg-[#1a1a1a] rounded-lg border border-[#333] shadow-lg z-10"
            >
              {filteredParticipants.map((participant, index) => (
                <button
                  key={participant.userId}
                  onClick={() => insertMention(participant.displayName)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                    index === selectedMentionIndex
                      ? 'bg-[#7c3aed] text-white'
                      : 'text-white hover:bg-[#333]'
                  }`}
                >
                  <span className="text-[#a0a0a0]">@</span>
                  <span>{participant.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
