import { useState } from 'react';
import { NotificationPreferences } from '@stream-party/shared';
import { ToggleOption } from './ToggleOption';
import { Button } from '../ui/Button';

export function NotificationsTab() {
    const [notifications, setNotifications] = useState<NotificationPreferences>({
        userId: '',
        allMessages: false,
        mentions: true,
        directMessages: true,
        serverInvites: true,
        friendRequests: true,
        sounds: true,
        desktopNotifications: true,
        notificationDuration: 5,
        mutedServers: [],
        mutedChannels: [],
    });

    const handleChange = (key: keyof NotificationPreferences, value: boolean | number) => {
        setNotifications(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Préférences de notifications</h2>

            <div className="space-y-4">
                <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-4">Notifications</h3>
                    <div className="space-y-3">
                        <ToggleOption
                            label="Tous les messages"
                            description="Recevoir une notification pour chaque message"
                            checked={notifications.allMessages}
                            onChange={(v) => handleChange('allMessages', v)}
                        />
                        <ToggleOption
                            label="Mentions"
                            description="Recevoir une notification quand quelqu'un vous mentionne"
                            checked={notifications.mentions}
                            onChange={(v) => handleChange('mentions', v)}
                        />
                        <ToggleOption
                            label="Messages directs"
                            description="Recevoir une notification pour les messages directs"
                            checked={notifications.directMessages}
                            onChange={(v) => handleChange('directMessages', v)}
                        />
                        <ToggleOption
                            label="Invitations de serveur"
                            description="Recevoir une notification pour les invitations"
                            checked={notifications.serverInvites}
                            onChange={(v) => handleChange('serverInvites', v)}
                        />
                        <ToggleOption
                            label="Demandes d'ami"
                            description="Recevoir une notification pour les demandes d'ami"
                            checked={notifications.friendRequests}
                            onChange={(v) => handleChange('friendRequests', v)}
                        />
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-white font-medium mb-4">Sons et affichage</h3>
                    <div className="space-y-3">
                        <ToggleOption
                            label="Sons"
                            description="Jouer un son lors des notifications"
                            checked={notifications.sounds}
                            onChange={(v) => handleChange('sounds', v)}
                        />
                        <ToggleOption
                            label="Notifications bureau"
                            description="Afficher les notifications sur le bureau"
                            checked={notifications.desktopNotifications}
                            onChange={(v) => handleChange('desktopNotifications', v)}
                        />
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <div className="text-white">Durée d'affichage</div>
                                <div className="text-sm text-gray-400">Temps d'affichage des notifications</div>
                            </div>
                            <select
                                value={notifications.notificationDuration}
                                onChange={(e) => handleChange('notificationDuration', Number(e.target.value))}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            >
                                <option value={3}>3 secondes</option>
                                <option value={5}>5 secondes</option>
                                <option value={10}>10 secondes</option>
                                <option value={30}>30 secondes</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <Button>Enregistrer les préférences</Button>
        </div>
    );
}
