import { Button } from '../ui/Button';

export function PrivacyTab() {
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
}
