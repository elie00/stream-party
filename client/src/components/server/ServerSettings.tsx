import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useServerStore, useIsServerOwner, useCanManageServer } from '../../stores/serverStore';
import type { Server } from '@stream-party/shared';

interface ServerSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateServer: (data: { name?: string; icon?: string; description?: string }) => Promise<void>;
  onDeleteServer: () => Promise<void>;
  onLeaveServer: () => Promise<void>;
}

export function ServerSettings({
  isOpen,
  onClose,
  onUpdateServer,
  onDeleteServer,
  onLeaveServer,
}: ServerSettingsProps) {
  const activeServer = useServerStore((state) => state.activeServer);
  const isOwner = useIsServerOwner();
  const canManage = useCanManageServer();

  const [name, setName] = useState(activeServer?.name || '');
  const [description, setDescription] = useState(activeServer?.description || '');
  const [icon, setIcon] = useState(activeServer?.icon || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = async () => {
    if (!canManage) return;

    setError(null);
    setIsLoading(true);

    try {
      await onUpdateServer({
        name: name.trim() || undefined,
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;

    setIsLoading(true);
    try {
      await onDeleteServer();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLeave = async () => {
    setIsLoading(true);
    try {
      await onLeaveServer();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du départ');
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeServer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Paramètres du serveur">
      <div className="space-y-6">
        {/* Server info */}
        {canManage && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Nom du serveur
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom du serveur"
                maxLength={50}
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                URL de l'icône
              </label>
              <Input
                type="url"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="https://example.com/icon.png"
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description du serveur..."
                maxLength={200}
                rows={3}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
              />
            </div>
          </>
        )}

        {/* Invite code */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Code d'invitation
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={activeServer.inviteCode}
              readOnly
              className="font-mono uppercase"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(activeServer.inviteCode);
              }}
            >
              Copier
            </Button>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Partagez ce code pour inviter des membres
          </p>
        </div>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4 border-t border-gray-700">
          {canManage && (
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
                Annuler
              </Button>
              <Button type="button" onClick={handleSave} isLoading={isLoading}>
                Enregistrer
              </Button>
            </div>
          )}

          {/* Leave server */}
          {!isOwner && (
            <button
              onClick={handleLeave}
              disabled={isLoading}
              className="text-left text-red-400 hover:text-red-300 text-sm"
            >
              Quitter ce serveur
            </button>
          )}

          {/* Delete server */}
          {isOwner && (
            <div className="pt-3 border-t border-gray-700">
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="text-left text-red-400 hover:text-red-300 text-sm"
                >
                  Supprimer ce serveur
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-red-400 text-sm">
                    Êtes-vous sûr de vouloir supprimer ce serveur ? Cette action est irréversible.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isLoading}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={handleDelete}
                      isLoading={isLoading}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
