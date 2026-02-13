import { useState } from 'react';
import { PresenceStatus, NotificationPreferences, UserActivity } from '@stream-party/shared';
import { usePresenceStore, PRESENCE_COLORS, PRESENCE_LABELS } from '../stores/presenceStore';
import { Avatar } from '../components/ui/Avatar';
import { StatusSelector } from '../components/ui/StatusSelector';
import { Button } from '../components/ui/Button';

type SettingsTab = 'profile' | 'status' | 'notifications' | 'privacy' | 'devices';

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profil', icon: '👤' },
  { id: 'status', label: 'Statut', icon: '🟢' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'privacy', label: 'Confidentialité', icon: '🔒' },
  { id: 'devices', label: 'Appareils', icon: '🎥' },
];

const ACTIVITY_OPTIONS = [
  { type: 'playing' as const, label: 'Joue à', icon: '🎮' },
  { type: 'watching' as const, label: 'Regarde', icon: '👀' },
  { type: 'listening' as const, label: 'Écoute', icon: '🎧' },
  { type: 'streaming' as const, label: 'Streame', icon: '📺' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { myStatus, myCustomStatus, myStatusEmoji, myActivity, setMyStatus, setMyCustomStatus, setMyActivity } = usePresenceStore();
  
  // Notification preferences state
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

  // Profile state
  const [displayName, setDisplayName] = useState('Mon Profil');
  const [bio, setBio] = useState('');

  // Activity state
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

  const handleNotificationChange = (key: keyof NotificationPreferences, value: boolean | number) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Paramètres du profil</h2>
            
            <div className="flex items-center gap-6">
              <Avatar name={displayName} size="xl" status={myStatus} showStatus />
              <Button variant="secondary" size="sm">Changer l'avatar</Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Nom d'affichage
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                  rows={3}
                  maxLength={190}
                  placeholder="À propos de vous..."
                />
              </div>
            </div>

            <Button>Enregistrer</Button>
          </div>
        );

      case 'status':
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
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        myStatus === status 
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
                          className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                            activityType === activity.type 
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

      case 'notifications':
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
                    onChange={(v) => handleNotificationChange('allMessages', v)}
                  />
                  <ToggleOption
                    label="Mentions"
                    description="Recevoir une notification quand quelqu'un vous mentionne"
                    checked={notifications.mentions}
                    onChange={(v) => handleNotificationChange('mentions', v)}
                  />
                  <ToggleOption
                    label="Messages directs"
                    description="Recevoir une notification pour les messages directs"
                    checked={notifications.directMessages}
                    onChange={(v) => handleNotificationChange('directMessages', v)}
                  />
                  <ToggleOption
                    label="Invitations de serveur"
                    description="Recevoir une notification pour les invitations"
                    checked={notifications.serverInvites}
                    onChange={(v) => handleNotificationChange('serverInvites', v)}
                  />
                  <ToggleOption
                    label="Demandes d'ami"
                    description="Recevoir une notification pour les demandes d'ami"
                    checked={notifications.friendRequests}
                    onChange={(v) => handleNotificationChange('friendRequests', v)}
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
                    onChange={(v) => handleNotificationChange('sounds', v)}
                  />
                  <ToggleOption
                    label="Notifications bureau"
                    description="Afficher les notifications sur le bureau"
                    checked={notifications.desktopNotifications}
                    onChange={(v) => handleNotificationChange('desktopNotifications', v)}
                  />
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-white">Durée d'affichage</div>
                      <div className="text-sm text-gray-400">Temps d'affichage des notifications</div>
                    </div>
                    <select
                      value={notifications.notificationDuration}
                      onChange={(e) => handleNotificationChange('notificationDuration', Number(e.target.value))}
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

      case 'privacy':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Paramètres de confidentialité</h2>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Qui peut voir vos informations</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-white">Statut en ligne</div>
                    <div className="text-sm text-gray-400">Voir votre statut en ligne</div>
                  </div>
                  <select className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option value="everyone">Tout le monde</option>
                    <option value="friends">Amis uniquement</option>
                    <option value="nobody">Personne</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-white">Dernière activité</div>
                    <div className="text-sm text-gray-400">Voir ce que vous faites</div>
                  </div>
                  <select className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option value="everyone">Tout le monde</option>
                    <option value="friends">Amis uniquement</option>
                    <option value="nobody">Personne</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-white">Profil public</div>
                    <div className="text-sm text-gray-400">Autoriser les autres à voir votre profil</div>
                  </div>
                  <select className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option value="everyone">Tout le monde</option>
                    <option value="friends">Amis uniquement</option>
                    <option value="nobody">Personne</option>
                  </select>
                </div>
              </div>
            </div>

            <Button>Enregistrer</Button>
          </div>
        );

      case 'devices':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Paramètres des appareils</h2>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Audio</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Entrée audio (microphone)</label>
                  <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option>Par défaut</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Sortie audio (haut-parleurs)</label>
                  <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option>Par défaut</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Volume du système</label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    defaultValue="100"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Vidéo</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Caméra</label>
                  <select className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                    <option>Par défaut</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-white">aperçu vidéo</div>
                  <div className="w-32 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Aucun aperçu</span>
                  </div>
                </div>
              </div>
            </div>

            <Button>Appliquer les changements</Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 p-4 space-y-2">
        <h1 className="text-lg font-bold text-white px-3 mb-4">Paramètres</h1>
        
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors ${
              activeTab === tab.id 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}

// Toggle Option Component
function ToggleOption({ 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  label: string; 
  description: string; 
  checked: boolean; 
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-white">{label}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-600'
        }`}
      >
        <span 
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}
