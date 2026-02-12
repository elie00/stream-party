import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateServer: (data: { name: string; icon?: string; description?: string }) => Promise<void>;
  isLoading?: boolean;
}

export function CreateServerModal({ isOpen, onClose, onCreateServer, isLoading }: CreateServerModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Le nom du serveur est requis');
      return;
    }

    try {
      await onCreateServer({
        name: name.trim(),
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du serveur');
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIcon('');
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Créer un serveur">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="server-name" className="block text-sm font-medium text-gray-300 mb-1">
            Nom du serveur *
          </label>
          <Input
            id="server-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mon super serveur"
            maxLength={50}
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="server-icon" className="block text-sm font-medium text-gray-300 mb-1">
            URL de l'icône (optionnel)
          </label>
          <Input
            id="server-icon"
            type="url"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="https://example.com/icon.png"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="server-description" className="block text-sm font-medium text-gray-300 mb-1">
            Description (optionnel)
          </label>
          <textarea
            id="server-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description de votre serveur..."
            maxLength={200}
            rows={3}
            disabled={isLoading}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          />
        </div>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button type="submit" loading={isLoading}>
            Créer le serveur
          </Button>
        </div>
      </form>
    </Modal>
  );
}
