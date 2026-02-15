import { Button } from '../ui/Button';

export function DevicesTab() {
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
                        <div className="text-white">Aperçu vidéo</div>
                        <div className="w-32 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                            <span className="text-gray-500 text-sm">Aucun aperçu</span>
                        </div>
                    </div>
                </div>
            </div>

            <Button>Appliquer les changements</Button>
        </div>
    );
}
