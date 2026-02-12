import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface JoinServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinServer: (inviteCode: string) => Promise<void>;
  isLoading?: boolean;
}

export function JoinServerModal({ isOpen, onClose, onJoinServer, isLoading }: JoinServerModalProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inviteCode.trim()) {
      setError('Le code d\'invitation est requis');
      return;
    }

    if (inviteCode.trim().length !== 8) {
      setError('Le code d\'invitation doit contenir 8 caractères');
      return;
    }

    try {
      await onJoinServer(inviteCode.trim());
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la rejoindre du serveur');
    }
  };

  const handleClose = () => {
    setInviteCode('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Rejoindre un serveur">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="invite-code" className="block text-sm font-medium text-gray-300 mb-1">
            Code d'invitation
          </label>
          <Input
            id="invite-code"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            maxLength={8}
            disabled={isLoading}
            className="uppercase"
          />
          <p className="mt-1 text-xs text-gray-400">
            Entrez le code d'invitation à 8 caractères fourni par le propriétaire du serveur
          </p>
        </div>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button type="submit" loading={isLoading}>
            Rejoindre
          </Button>
        </div>
      </form>
    </Modal>
  );
}
