import { useState } from 'react';
import { usePresenceStore } from '../stores/presenceStore';
import { ProfileTab, StatusTab, NotificationsTab, PrivacyTab, DevicesTab } from '../components/settings';

type SettingsTab = 'profile' | 'status' | 'notifications' | 'privacy' | 'devices';

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profil', icon: '👤' },
  { id: 'status', label: 'Statut', icon: '🟢' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'privacy', label: 'Confidentialité', icon: '🔒' },
  { id: 'devices', label: 'Appareils', icon: '🎥' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { myStatus } = usePresenceStore();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab myStatus={myStatus} />;
      case 'status':
        return <StatusTab displayName="Mon Profil" />;
      case 'notifications':
        return <NotificationsTab />;
      case 'privacy':
        return <PrivacyTab />;
      case 'devices':
        return <DevicesTab />;
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
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors ${activeTab === tab.id
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
