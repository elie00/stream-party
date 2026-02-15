import { useState } from 'react';
import { PresenceStatus, UserActivity } from '@stream-party/shared';
import { usePresenceStore, PRESENCE_COLORS, PRESENCE_LABELS } from '../../stores/presenceStore';
import { StatusSelector } from '../ui/StatusSelector';
import { Button } from '../ui/Button';

const ACTIVITY_OPTIONS = [
    { type: 'playing' as const, label: 'Joue à', icon: '🎮' },
    { type: 'watching' as const, label: 'Regarde', icon: '👀' },
    { type: 'listening' as const, label: 'Écoute', icon: '🎧' },
    { type: 'streaming' as const, label: 'Streame', icon: '📺' },
];

interface StatusTabProps {
    displayName: string;
}

export function StatusTab({ displayName }: StatusTabProps) {
    const { myStatus, myActivity, setMyStatus, setMyCustomStatus, setMyActivity } = usePresenceStore();
    const [activityType, setActivityType] = useState<'playing' | 'watching' | 'listening' | 'streaming'>('playing');
    const [activityName, setActivityName] = useState('');

    const handleStatusChange = (status: PresenceStatus) => {
        setMyStatus(status);
    };

    const handleCustomStatusChange = (customStatus: string | null, emoji?: string | null) => {
        setMyCustomStatus(customStatus, emoji ?? undefined);
    };

    const handleActivityChange = (activity: UserActivity | null) => {
        setMyActivity(activity);
    };

    const handleActivitySubmit = () => {
        if (activityName.trim()) {
            const activity: UserActivity = {
                type: activityType,
                name: activityName.trim(),
                startedAt: new Date().toISOString(),
            };
            setMyActivity(activity);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Statut et activité</h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Statut actuel
                    </label>
                    <div className="flex gap-2">
                        {(['online', 'idle', 'dnd', 'offline'] as PresenceStatus[]).map((status) => (
                            <button
                                key={status}
                                onClick={() => setMyStatus(status)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${myStatus === status
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: PRESENCE_COLORS[status] }}
                                />
                                {PRESENCE_LABELS[status]}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Statut personnalisé
                    </label>
                    <StatusSelector
                        userName={displayName}
                        onStatusChange={handleStatusChange}
                        onCustomStatusChange={handleCustomStatusChange}
                        onActivityChange={handleActivityChange}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                        Activité
                    </label>
                    {myActivity ? (
                        <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                    {ACTIVITY_OPTIONS.find(a => a.type === myActivity.type)?.icon}
                                </span>
                                <div>
                                    <div className="text-white font-medium">
                                        {ACTIVITY_OPTIONS.find(a => a.type === myActivity.type)?.label} {myActivity.name}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setMyActivity(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                {ACTIVITY_OPTIONS.map((activity) => (
                                    <button
                                        key={activity.type}
                                        onClick={() => setActivityType(activity.type)}
                                        className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${activityType === activity.type
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                            }`}
                                    >
                                        {activity.icon} {activity.label}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                value={activityName}
                                onChange={(e) => setActivityName(e.target.value)}
                                placeholder={`${ACTIVITY_OPTIONS.find(a => a.type === activityType)?.label}...`}
                                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleActivitySubmit()}
                            />
                            <Button onClick={handleActivitySubmit} disabled={!activityName.trim()}>
                                Définir l'activité
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
