import { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import type { PresenceStatus } from '@stream-party/shared';

interface ProfileTabProps {
    myStatus: PresenceStatus;
}

export function ProfileTab({ myStatus }: ProfileTabProps) {
    const [displayName, setDisplayName] = useState('Mon Profil');
    const [bio, setBio] = useState('');

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Paramètres du profil</h2>

            <div className="flex items-center gap-6">
                <Avatar name={displayName} size="lg" status={myStatus} showStatus />
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
}
