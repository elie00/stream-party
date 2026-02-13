/**
 * ChannelSettings Component
 * Paramètres d'un canal (slowmode, permissions)
 */
import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { socket } from '../../services/socket';
import type { Channel, Server, Role } from '@stream-party/shared';
import { cn } from '../../utils/cn';

// Options de slowmode
const SLOWMODE_OPTIONS = [
  { value: 0, label: 'Désactivé' },
  { value: 5, label: '5 secondes' },
  { value: 10, label: '10 secondes' },
  { value: 30, label: '30 secondes' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
];

interface ChannelSettingsProps {
  channel: Channel;
  server: Server;
  isOpen: boolean;
  onClose: () => void;
}

export function ChannelSettings({
  channel,
  server,
  isOpen,
  onClose,
}: ChannelSettingsProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'slowmode' | 'permissions'>('general');
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic || '');
  const [slowmode, setSlowmode] = useState(0);
  const [slowmodeRoles, setSlowmodeRoles] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger les paramètres du canal à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setName(channel.name);
      setTopic(channel.topic || '');
      loadChannelSettings();
      loadRoles();
    }
  }, [isOpen, channel.id]);

  const loadChannelSettings = () => {
    socket.emit('channel:get-settings', { channelId: channel.id }, (response: { 
      slowmode?: number; 
      slowmodeRoles?: string[];
    }) => {
      if (response) {
        setSlowmode(response.slowmode || 0);
        setSlowmodeRoles(response.slowmodeRoles || []);
      }
    });
  };

  const loadRoles = () => {
    socket.emit('mod:get-roles', { serverId: server.id }, (response: { roles?: Role[] }) => {
      if (response.roles) {
        setRoles(response.roles);
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Sauvegarder les paramètres généraux
      if (name !== channel.name || topic !== channel.topic) {
        await new Promise<void>((resolve) => {
          socket.emit('channel:update', {
            channelId: channel.id,
            name: name.trim(),
            topic: topic.trim() || null,
          }, (resp: { success: boolean }) => {
            resolve();
          });
        });
      }

      // Sauvegarder le slowmode
      await new Promise<void>((resolve) => {
        socket.emit('channel:set-slowmode', {
          channelId: channel.id,
          slowmode,
          slowmodeRoles,
        }, (resp: { success: boolean }) => {
          resolve();
        });
      });

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const toggleSlowmodeRole = (roleName: string) => {
    setSlowmodeRoles(prev => 
      prev.includes(roleName)
        ? prev.filter(r => r !== roleName)
        : [...prev, roleName]
    );
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Paramètres: ${channel.name}`} size="lg">
      <div className="flex h-96">
        {/* Sidebar */}
        <div className="w-48 border-r border-gray-700 pr-4">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={cn(
                'w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors',
                activeTab === 'general'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              )}
            >
              Général
            </button>
            <button
              onClick={() => setActiveTab('slowmode')}
              className={cn(
                'w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors',
                activeTab === 'slowmode'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              )}
            >
              Slowmode
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={cn(
                'w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors',
                activeTab === 'permissions'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              )}
            >
              Permissions
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 pl-4 overflow-y-auto">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Paramètres généraux</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nom du salon
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom du salon"
                  maxLength={30}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Sujet
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Sujet du salon..."
                  maxLength={100}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Slowmode Tab */}
          {activeTab === 'slowmode' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Slowmode</h3>
              <p className="text-sm text-gray-400">
                Le slowmode limite la fréquence à laquelle les utilisateurs peuvent envoyer des messages.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Délai entre les messages
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SLOWMODE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setSlowmode(option.value)}
                      className={cn(
                        'px-3 py-2 rounded text-sm font-medium transition-colors',
                        slowmode === option.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Rôles exemptés du slowmode
                </label>
                <div className="space-y-2">
                  {roles.map(role => (
                    <label
                      key={role.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={slowmodeRoles.includes(role.name)}
                        onChange={() => toggleSlowmodeRole(role.name)}
                        className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: role.color }}
                      >
                        {role.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Permissions</h3>
              <p className="text-sm text-gray-400">
                Gérez les permissions spécifiques à ce canal. Les paramètres ici remplaceront les permissions du serveur.
              </p>
              
              <Button
                onClick={() => {
                  // Émitter un événement pour ouvrir l'éditeur de permissions
                  socket.emit('channel:open-permissions', { channelId: channel.id });
                }}
              >
                Ouvrir l'éditeur de permissions
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-700">
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={handleSave} isLoading={saving}>
          Sauvegarder
        </Button>
      </div>
    </Modal>
  );
}

export default ChannelSettings;
