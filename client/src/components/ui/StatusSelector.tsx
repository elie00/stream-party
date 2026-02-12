import { useState, useRef, useEffect } from 'react';
import { PresenceStatus } from '@stream-party/shared';
import { usePresenceStore, PRESENCE_COLORS, PRESENCE_LABELS } from '../../stores/presenceStore';
import { Avatar } from './Avatar';

interface StatusSelectorProps {
  userName: string;
  onStatusChange?: (status: PresenceStatus) => void;
  onCustomStatusChange?: (customStatus: string | null) => void;
}

const STATUS_OPTIONS: PresenceStatus[] = ['online', 'idle', 'dnd', 'offline'];

export function StatusSelector({ 
  userName, 
  onStatusChange,
  onCustomStatusChange 
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStatusInput, setCustomStatusInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { myStatus, myCustomStatus, setMyStatus, setMyCustomStatus } = usePresenceStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomInput(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when showing custom input
  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  const handleStatusSelect = (status: PresenceStatus) => {
    setMyStatus(status);
    onStatusChange?.(status);
    setIsOpen(false);
  };

  const handleCustomStatusSubmit = () => {
    const trimmedStatus = customStatusInput.trim();
    const newStatus = trimmedStatus || null;
    setMyCustomStatus(newStatus);
    onCustomStatusChange?.(newStatus);
    setShowCustomInput(false);
    setCustomStatusInput('');
  };

  const handleClearCustomStatus = () => {
    setMyCustomStatus(null);
    onCustomStatusChange?.(null);
    setShowCustomInput(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-700 transition-colors w-full"
      >
        <Avatar 
          name={userName} 
          size="sm" 
          status={myStatus} 
          showStatus 
        />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-white truncate">{userName}</div>
          <div className="text-xs text-gray-400 truncate">
            {myCustomStatus || PRESENCE_LABELS[myStatus]}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden z-50">
          {/* Status options */}
          {!showCustomInput ? (
            <>
              <div className="p-1">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusSelect(status)}
                    className={`
                      flex items-center gap-3 w-full px-3 py-2 rounded-md text-left
                      transition-colors
                      ${myStatus === status ? 'bg-gray-700' : 'hover:bg-gray-700'}
                    `}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PRESENCE_COLORS[status] }}
                    />
                    <span className="text-sm text-white">{PRESENCE_LABELS[status]}</span>
                    {myStatus === status && (
                      <svg className="w-4 h-4 ml-auto text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-700 my-1" />

              {/* Custom status */}
              <div className="p-1">
                <button
                  onClick={() => setShowCustomInput(true)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-left hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span className="text-sm text-gray-300">
                    {myCustomStatus ? 'Modifier le statut' : 'Définir un statut personnalisé'}
                  </span>
                </button>

                {myCustomStatus && (
                  <button
                    onClick={handleClearCustomStatus}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-left hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-sm text-red-400">Effacer le statut</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Custom status input */
            <div className="p-2">
              <input
                ref={inputRef}
                type="text"
                value={customStatusInput}
                onChange={(e) => setCustomStatusInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomStatusSubmit();
                  } else if (e.key === 'Escape') {
                    setShowCustomInput(false);
                    setCustomStatusInput('');
                  }
                }}
                placeholder="Quel faites-vous ?"
                maxLength={100}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setShowCustomInput(false);
                    setCustomStatusInput('');
                  }}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCustomStatusSubmit}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
