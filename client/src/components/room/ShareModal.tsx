import { useState, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
}

export function ShareModal({ isOpen, onClose, roomCode }: ShareModalProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  }, [roomCode]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [shareUrl]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Room">
      <div className="space-y-6">
        {/* Room Code */}
        <div>
          <label className="block text-sm text-[#a0a0a0] mb-2">Room Code</label>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-4 py-3 text-center font-mono text-2xl tracking-widest text-white select-all">
              {roomCode}
            </div>
            <Button
              variant={codeCopied ? 'secondary' : 'primary'}
              size="md"
              onClick={handleCopyCode}
              className="flex-shrink-0 min-w-[100px]"
            >
              {codeCopied ? 'Copied!' : 'Copy Code'}
            </Button>
          </div>
        </div>

        {/* Share URL */}
        <div>
          <label className="block text-sm text-[#a0a0a0] mb-2">Share Link</label>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-4 py-3 text-sm text-[#a0a0a0] truncate select-all">
              {shareUrl}
            </div>
            <Button
              variant={linkCopied ? 'secondary' : 'primary'}
              size="md"
              onClick={handleCopyLink}
              className="flex-shrink-0 min-w-[100px]"
            >
              {linkCopied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
