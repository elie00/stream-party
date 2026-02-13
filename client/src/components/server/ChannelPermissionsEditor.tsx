/**
 * ChannelPermissionsEditor Component
 * Éditeur de permissions par canal avec overrides
 */
import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { socket } from '../../services/socket';
import type { Channel, Server, ChannelPermission, ChannelPermissionOverride, Role } from '@stream-party/shared';
import { cn } from '../../utils/cn';

interface ChannelPermissionsEditorProps {
  channel: Channel;
  server: Server;
  isOpen: boolean;
  onClose: () => void;
}

// Permissions disponibles pour les canaux
const CHANNEL_PERMISSIONS: { key: ChannelPermission; label: string; description: string }[] = [
  { key: 'view_channel', label: 'Voir le salon', description: 'Permet de voir le salon' },
  { key: 'send_messages', label: 'Envoyer des messages', description: 'Permet d\'envoyer des messages' },
  { key: 'manage_messages', label: 'Gérer les messages', description: 'Permet de supprimer et modifier les messages' },
  { key: 'embed_links', label: 'Intégrer des liens', description: 'Permet d\'intégrer des liens preview' },
  { key: 'attach_files', label: 'Joindre des fichiers', description: 'Permet de joindre des fichiers' },
  { key: 'read_message_history', label: 'Historique des messages', description: 'Permet de lire l\'historique' },
  { key: 'use_slash_commands', label: 'Commandes slash', description: 'Permet d\'utiliser les commandes slash' },
  { key: 'use_voice', label: 'Utiliser la voix', description: 'Permet de rejoindre les salons vocaux' },
  { key: 'connect', label: 'Connecter', description: 'Permet de se connecter au salon vocal' },
  { key: 'speak', label: 'Parler', description: 'Permet de parler dans un salon vocal' },
  { key: 'mute_members', label: 'Muet les membres', description: 'Permet de rendre muet les autres membres' },
  { key: 'deafen_members', label: 'Assourdir les membres', description: 'Permet d\'assourdir les autres membres' },
  { key: 'move_members', label: 'Déplacer les membres', description: 'Permet de déplacer les membres' },
  { key: 'stream', label: 'Stream', description: 'Permet de streamer' },
  { key: 'priority_speaker', label: 'Priority Speaker', description: 'Priorité pour parler' },
];

export function ChannelPermissionsEditor({
  channel,
  server,
  isOpen,
  onClose,
}: ChannelPermissionsEditorProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [overrides, setOverrides] = useState<ChannelPermissionOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger les rôles et les permissions au ouverture
  useEffect(() => {
    if (isOpen) {
      loadRoles();
      loadPermissions();
    }
  }, [isOpen, channel.id]);

  const loadRoles = () => {
    socket.emit('mod:get-roles', { serverId: server.id }, (response: { roles?: Role[] }) => {
      if (response.roles) {
        setRoles(response.roles);
        if (response.roles.length > 0) {
          setSelectedRole(response.roles[0]);
        }
      }
    });
  };

  const loadPermissions = () => {
    socket.emit('channel:permissions:get', { channelId: channel.id }, (response: { overrides?: ChannelPermissionOverride[] }) => {
      if (response.overrides) {
        setOverrides(response.overrides);
      }
    });
  };

  // Obtenir les permissions actuelles pour le rôle sélectionné
  const getCurrentOverrides = (roleId: number): ChannelPermissionOverride | undefined => {
    return overrides.find(o => o.roleId === roleId);
  };

  // Gestionnaire de changement de permission
  const handlePermissionChange = (
    permission: ChannelPermission,
    type: 'allow' | 'deny'
  ) => {
    if (!selectedRole) return;

    const current = getCurrentOverrides(selectedRole.id);
    const currentAllow = current?.allow || [];
    const currentDeny = current?.deny || [];

    let newAllow = [...currentAllow];
    let newDeny = [...currentDeny];

    if (type === 'allow') {
      if (newAllow.includes(permission)) {
        newAllow = newAllow.filter(p => p !== permission);
      } else {
        newAllow.push(permission);
        newDeny = newDeny.filter(p => p !== permission);
      }
    } else {
      if (newDeny.includes(permission)) {
        newDeny = newDeny.filter(p => p !== permission);
      } else {
        newDeny.push(permission);
        newAllow = newAllow.filter(p => p !== permission);
      }
    }

    // Sauvegarder automatiquement
    savePermissions(selectedRole.id, newAllow, newDeny);
  };

  // Sauvegarder les permissions
  const savePermissions = (roleId: number, allow: ChannelPermission[], deny: ChannelPermission[]) => {
    setSaving(true);
    socket.emit('channel:permissions:set', {
      channelId: channel.id,
      roleId,
      allow,
      deny,
    }, (response: { success: boolean }) => {
      if (response.success) {
        loadPermissions();
      }
      setSaving(false);
    });
  };

  // Réinitialiser les permissions
  const handleReset = () => {
    if (!selectedRole) return;

    setSaving(true);
    socket.emit('channel:permissions:remove', {
      channelId: channel.id,
      roleId: selectedRole.id,
    }, (response: { success: boolean }) => {
      if (response.success) {
        loadPermissions();
      }
      setSaving(false);
    });
  };

  // Obtenir le statut d'une permission
  const getPermissionStatus = (permission: ChannelPermission): 'allowed' | 'denied' | 'inherited' => {
    if (!selectedRole) return 'inherited';
    
    const current = getCurrentOverrides(selectedRole.id);
    if (!current) return 'inherited';
    
    if (current.allow.includes(permission)) return 'allowed';
    if (current.deny.includes(permission)) return 'denied';
    return 'inherited';
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Permissions: ${channel.name}`}>
      <div className="space-y-4">
        {/* Sélecteur de rôle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Rôle à configurer
          </label>
          <div className="flex gap-2 flex-wrap">
            {roles.map(role => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  selectedRole?.id === role.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                )}
                style={{ borderLeftColor: role.color, borderLeftWidth: '3px' }}
              >
                {role.name}
              </button>
            ))}
          </div>
        </div>

        {/* Permissions */}
        {selectedRole && (
          <>
            <div className="border-t border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-300 mb-3">
                Permissions du canal
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {CHANNEL_PERMISSIONS.map(permission => {
                  const status = getPermissionStatus(permission.key);
                  return (
                    <div
                      key={permission.key}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-700/50"
                    >
                      <div>
                        <div className="text-sm font-medium text-white">
                          {permission.label}
                        </div>
                        <div className="text-xs text-gray-400">
                          {permission.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Allow toggle */}
                        <button
                          onClick={() => handlePermissionChange(permission.key, 'allow')}
                          className={cn(
                            'px-2 py-1 text-xs rounded transition-colors',
                            status === 'allowed'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          )}
                          title="Autoriser"
                        >
                          ✓
                        </button>
                        {/* Deny toggle */}
                        <button
                          onClick={() => handlePermissionChange(permission.key, 'deny')}
                          className={cn(
                            'px-2 py-1 text-xs rounded transition-colors',
                            status === 'denied'
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          )}
                          title="Refuser"
                        >
                          ✗
                        </button>
                        {/* Status indicator */}
                        <span className={cn(
                          'text-xs',
                          status === 'allowed' && 'text-green-400',
                          status === 'denied' && 'text-red-400',
                          status === 'inherited' && 'text-gray-500'
                        )}>
                          {status === 'allowed' && '✓ Autorisé'}
                          {status === 'denied' && '✗ Refusé'}
                          {status === 'inherited' && '↝ Hérité'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-gray-700">
              <Button
                variant="danger"
                size="sm"
                onClick={handleReset}
                disabled={saving || !getCurrentOverrides(selectedRole.id)}
              >
                Réinitialiser
              </Button>
              <Button
                variant="secondary"
                onClick={onClose}
              >
                Fermer
              </Button>
            </div>
          </>
        )}

        {saving && (
          <div className="text-center text-gray-400 text-sm">
            Sauvegarde en cours...
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ChannelPermissionsEditor;
