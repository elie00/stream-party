import { useState, useRef, useEffect } from 'react';
import { PresenceStatus, UserActivity, ActivityType } from '@stream-party/shared';
import { usePresenceStore, PRESENCE_COLORS, PRESENCE_LABELS } from '../../stores/presenceStore';
import { Avatar } from './Avatar';

interface StatusSelectorProps {
  userName: string;
  onStatusChange?: (status: PresenceStatus) => void;
  onCustomStatusChange?: (customStatus: string | null, emoji?: string | null) => void;
  onActivityChange?: (activity: UserActivity | null) => void;
}

const STATUS_OPTIONS: PresenceStatus[] = ['online', 'idle', 'dnd', 'offline'];

const ACTIVITY_OPTIONS: { type: ActivityType; label: string; icon: string }[] = [
  { type: 'playing', label: 'Joue à', icon: '🎮' },
  { type: 'watching', label: 'Regarde', icon: '👀' },
  { type: 'listening', label: 'Écoute', icon: '🎧' },
  { type: 'streaming', label: 'Streame', icon: '📺' },
];

const STATUS_EMOJIS = ['🎮', '🎨', '🎵', '🎬', '📚', '💻', '🎯', '⚽', '🍕', '☕', '🎉', '✨'];

export function StatusSelector({ 
  userName, 
  onStatusChange,
  onCustomStatusChange,
  onActivityChange 
}: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStatusInput, setCustomStatusInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showActivityInput, setShowActivityInput] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('playing');
  const [activityName, setActivityName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activityInputRef = useRef<HTMLInputElement>(null);

  const { myStatus, myCustomStatus, myStatusEmoji, myActivity, setMyStatus, setMyCustomStatus, setMyActivity } = usePresenceStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomInput(false);
        setShowActivityInput(false);
        setShowEmojiPicker(false);
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

  // Focus input when showing activity input
  useEffect(() => {
    if (showActivityInput && activityInputRef.current) {
      activityInputRef.current.focus();
    }
  }, [showActivityInput]);

  const handleStatusSelect = (status: PresenceStatus) => {
    setMyStatus(status);
    onStatusChange?.(status);
    setIsOpen(false);
  };

  const handleCustomStatusSubmit = () => {
    const trimmedStatus = customStatusInput.trim();
    const newStatus = trimmedStatus || null;
    setMyCustomStatus(newStatus, selectedEmoji);
    onCustomStatusChange?.(newStatus, selectedEmoji);
    setShowCustomInput(false);
    setCustomStatusInput('');
    setSelectedEmoji(null);
  };

  const handleActivitySubmit = () => {
    const trimmedActivity = activityName.trim();
    if (trimmedActivity) {
      const activity: UserActivity = {
        type: selectedActivity,
        name: trimmedActivity,
        startedAt: new Date().toISOString(),
      };
      setMyActivity(activity);
      onActivityChange?.(activity);
    }
    setShowActivityInput(false);
    setActivityName('');
  };

  const handleClearActivity = () => {
    setMyActivity(null);
    onActivityChange?.(null);
    setShowActivityInput(false);
  };

  const handleClearCustomStatus = () => {
    setMyCustomStatus(null, null);
    onCustomStatusChange?.(null, null);
    setShowCustomInput(false);
    setCustomStatusInput('');
    setSelectedEmoji(null);
  };

  // Get activity display text
  const getActivityDisplay = () => {
    if (!myActivity) return null;
    const activityOption = ACTIVITY_OPTIONS.find(a => a.type === myActivity.type);
    return `${activityOption?.icon || ''} ${activityOption?.label || myActivity.type} ${myActivity.name}`;
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
        <div className="flex-1 text-left min-w-0">
          <div className="text-sm font-medium text-white truncate">{userName}</div>
          <div className="text-xs text-gray-400 truncate flex items-center gap-1">
            {myStatusEmoji && <span>{myStatusEmoji}</span>}
            {myCustomStatus || getActivityDisplay() || PRESENCE_LABELS[myStatus]}
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
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden z-50">
          {/* Status options */}
          {!showCustomInput && !showActivityInput ? (
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

              {/* Activity */}
              <div className="p-1">
                <button
                  onClick={() => setShowActivityInput(true)}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-left hover:bg-gray-700 transition-colors"
                >
                  <span className="text-gray-400">🎮</span>
                  <span className="text-sm text-gray-300">
                    {myActivity ? 'Modifier l\'activité' : 'Définir une activité'}
                  </span>
                </button>
                
                {myActivity && (
                  <button
                    onClick={handleClearActivity}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-left hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-red-400">✕</span>
                    <span className="text-sm text-red-400">Effacer l\'activité</span>
                  </button>
                )}
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
          ) : showActivityInput ? (
            /* Activity input */
            <div className="p-2">
              <div className="flex gap-1 mb-2">
                {ACTIVITY_OPTIONS.map((activity) => (
                  <button
                    key={activity.type}
                    onClick={() => setSelectedActivity(activity.type)}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                      selectedActivity === activity.type 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {activity.icon} {activity.label}
                  </button>
                ))}
              </div>
              <input
                ref={activityInputRef}
                type="text"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleActivitySubmit();
                  } else if (e.key === 'Escape') {
                    setShowActivityInput(false);
                    setActivityName('');
                  }
                }}
                placeholder={`${ACTIVITY_OPTIONS.find(a => a.type === selectedActivity)?.label || 'Activité'}...`}
                maxLength={100}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    setShowActivityInput(false);
                    setActivityName('');
                  }}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleActivitySubmit}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          ) : (
            /* Custom status input */
            <div className="p-2">
              {/* Emoji picker */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="px-3 py-1.5 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors text-lg"
                >
                  {selectedEmoji || '😊'}
                </button>
                {showEmojiPicker && (
                  <div className="flex flex-wrap gap-1 max-w-48">
                    {STATUS_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setSelectedEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="px-1 py-1 hover:bg-gray-700 rounded transition-colors text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                    setSelectedEmoji(null);
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
                    setSelectedEmoji(null);
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
