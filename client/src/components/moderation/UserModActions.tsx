/**
 * UserModActions Component
 * Actions available for moderating a specific user
 */
import React, { useState } from 'react';
import { socket } from '../../services/socket';
import { ModAction } from '@stream-party/shared';

interface UserModActionsProps {
  serverId: string;
  targetUserId: string;
  targetDisplayName: string;
  currentUserId: string;
  onActionComplete?: (action: ModAction) => void;
  onClose?: () => void;
}

export const UserModActions: React.FC<UserModActionsProps> = ({
  serverId,
  targetUserId,
  targetDisplayName,
  currentUserId,
  onActionComplete,
  onClose,
}) => {
  const [selectedAction, setSelectedAction] = useState<ModAction | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState(10); // minutes
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = () => {
    if (!selectedAction) return;
    if (!reason.trim() && selectedAction !== 'unmute' && selectedAction !== 'unban') {
      setError('Une raison est requise');
      return;
    }

    setIsLoading(true);
    setError(null);

    switch (selectedAction) {
      case 'warn':
        socket.emit('mod:warn', {
          serverId,
          targetId: targetUserId,
          reason: reason.trim(),
        });
        break;
      case 'mute':
        socket.emit('mod:mute', {
          serverId,
          targetId: targetUserId,
          reason: reason.trim(),
          duration,
        });
        break;
      case 'kick':
        socket.emit('mod:kick', {
          serverId,
          targetId: targetUserId,
          reason: reason.trim(),
        });
        break;
      case 'ban':
        socket.emit('mod:ban', {
          serverId,
          targetId: targetUserId,
          reason: reason.trim(),
        });
        break;
    }

    // Listen for response
    const handleSuccess = () => {
      setIsLoading(false);
      onActionComplete?.(selectedAction);
      onClose?.();
    };

    const handleError = (data: { message: string }) => {
      setIsLoading(false);
      setError(data.message);
    };

    socket.once('mod:warned', handleSuccess);
    socket.once('mod:muted', handleSuccess);
    socket.once('mod:kicked', handleSuccess);
    socket.once('mod:banned', handleSuccess);
    socket.once('mod:error', handleError);

    // Timeout after 5 seconds
    setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setError('Délai d\'attente dépassé');
      }
    }, 5000);
  };

  const actions: { id: ModAction; label: string; color: string; icon: string }[] = [
    { id: 'warn', label: 'Avertir', color: 'bg-yellow-600 hover:bg-yellow-700', icon: '⚠️' },
    { id: 'mute', label: 'Muet', color: 'bg-orange-600 hover:bg-orange-700', icon: '🔇' },
    { id: 'kick', label: 'Expulser', color: 'bg-red-600 hover:bg-red-700', icon: '👢' },
    { id: 'ban', label: 'Bannir', color: 'bg-red-800 hover:bg-red-900', icon: '🚫' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg p-4 w-80">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Modérer</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* User info */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-gray-700 rounded-lg">
        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
          <span className="text-lg font-medium text-white">
            {targetDisplayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="font-medium text-white">{targetDisplayName}</span>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => setSelectedAction(action.id)}
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded text-white text-sm font-medium transition-colors ${
              selectedAction === action.id
                ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800'
                : ''
            } ${action.color}`}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Reason input */}
      {selectedAction && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Raison *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez la raison de cette action..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none h-20"
            />
          </div>

          {/* Duration for mute */}
          {selectedAction === 'mute' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Durée (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Submit button */}
          <button
            onClick={handleAction}
            disabled={isLoading || !reason.trim()}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Traitement...
              </span>
            ) : (
              `Confirmer ${actions.find((a) => a.id === selectedAction)?.label.toLowerCase()}`
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserModActions;
