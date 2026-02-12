import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clapperboard, Film, Tv, Loader2, ArrowLeft } from 'lucide-react';
import { getAddons, getCatalog, createRoom } from '../services/api';
import type { AddonInfo, MetaPreview, CatalogDescriptor } from '../types/stremio';
import ContentCard from '../components/discover/ContentCard';
import MetaModal from '../components/discover/MetaModal';
import './DiscoverPage.css';

type ContentType = 'movie' | 'series';

export default function DiscoverPage() {
    const navigate = useNavigate();
    const [addons, setAddons] = useState<AddonInfo[]>([]);
    const [selectedType, setSelectedType] = useState<ContentType>('movie');
    const [selectedGenre, setSelectedGenre] = useState<string>('');
    const [catalogs, setCatalogs] = useState<MetaPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMeta, setSelectedMeta] = useState<MetaPreview | null>(null);
    const [availableGenres, setAvailableGenres] = useState<string[]>([]);

    // Load addons on mount
    useEffect(() => {
        async function loadAddons() {
            try {
                const response = await getAddons();
                setAddons(response.addons);
            } catch (error) {
                console.error('Failed to load addons:', error);
            }
        }
        loadAddons();
    }, []);

    // Get available catalogs and genres for selected type
    useEffect(() => {
        const genres = new Set<string>();
        addons.forEach(addon => {
            addon.catalogs
                .filter(c => c.type === selectedType)
                .forEach(catalog => {
                    catalog.genres?.forEach(g => genres.add(g));
                });
        });
        setAvailableGenres(Array.from(genres).sort());
    }, [addons, selectedType]);

    // Load catalog content
    useEffect(() => {
        async function loadCatalogs() {
            if (addons.length === 0) return;

            setLoading(true);
            const allMetas: MetaPreview[] = [];

            for (const addon of addons) {
                // Find catalogs matching type
                const matchingCatalogs = addon.catalogs.filter(
                    (c: CatalogDescriptor) => c.type === selectedType
                );

                // Prefer "top" or "imdbRating" catalogs
                const preferredCatalog = matchingCatalogs.find(
                    c => c.id === 'top' || c.id === 'imdbRating'
                ) || matchingCatalogs[0];

                if (preferredCatalog) {
                    try {
                        const extra = selectedGenre ? { genre: selectedGenre } : undefined;
                        const response = await getCatalog(
                            addon.id,
                            selectedType,
                            preferredCatalog.id,
                            extra
                        );
                        if (response.metas) {
                            allMetas.push(...response.metas);
                        }
                    } catch (error) {
                        console.warn(`Failed to load catalog from ${addon.name}:`, error);
                    }
                }
            }

            // Remove duplicates by ID
            const uniqueMetas = Array.from(
                new Map(allMetas.map(m => [m.id, m])).values()
            );

            setCatalogs(uniqueMetas);
            setLoading(false);
        }

        loadCatalogs();
    }, [addons, selectedType, selectedGenre]);

    const handleCardClick = (meta: MetaPreview) => {
        setSelectedMeta(meta);
    };

    const handleCloseModal = () => {
        setSelectedMeta(null);
    };

    const handleWatchParty = async (magnetUri: string) => {
        try {
            // Create a room and navigate with the magnet
            const room = await createRoom(`${selectedMeta?.name || 'Movie'} Party`);
            navigate(`/room/${room.code}?magnet=${encodeURIComponent(magnetUri)}`);
        } catch (error) {
            console.error('Failed to create room:', error);
        }
    };

    return (
        <div className="discover-page">
            <button className="back-link" onClick={() => navigate('/')}>
                <ArrowLeft size={20} /> Back to Home
            </button>
            <header className="discover-header">
                <h1><Clapperboard className="inline-block mr-3 mb-1 text-purple-500" size={36} /> Discover</h1>
                <p>Browse content and start a watch party</p>
            </header>

            <div className="discover-filters">
                <div className="type-tabs">
                    <button
                        className={selectedType === 'movie' ? 'active' : ''}
                        onClick={() => setSelectedType('movie')}
                    >
                        <Film size={18} className="inline-block mr-2" /> Movies
                    </button>
                    <button
                        className={selectedType === 'series' ? 'active' : ''}
                        onClick={() => setSelectedType('series')}
                    >
                        <Tv size={18} className="inline-block mr-2" /> Series
                    </button>
                </div>

                {availableGenres.length > 0 && (
                    <select
                        value={selectedGenre}
                        onChange={(e) => setSelectedGenre(e.target.value)}
                        className="genre-select"
                    >
                        <option value="">All Genres</option>
                        {availableGenres.map(genre => (
                            <option key={genre} value={genre}>{genre}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="catalog-grid">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading content...</p>
                    </div>
                ) : catalogs.length === 0 ? (
                    <div className="empty-state">
                        <p>No content found. Try a different genre or install more addons.</p>
                    </div>
                ) : (
                    catalogs.map(meta => (
                        <ContentCard
                            key={meta.id}
                            meta={meta}
                            onClick={() => handleCardClick(meta)}
                        />
                    ))
                )}
            </div>

            {selectedMeta && (
                <MetaModal
                    meta={selectedMeta}
                    onClose={handleCloseModal}
                    onWatchParty={handleWatchParty}
                />
            )}
        </div>
    );
}
