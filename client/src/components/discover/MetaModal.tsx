import { useState, useEffect } from 'react';
import { X, Star, PartyPopper, Loader2 } from 'lucide-react';
import { getAddons, getMeta, getStreams } from '../../services/api';
import type { MetaPreview, MetaObject, StreamObject } from '../../types/stremio';
import './MetaModal.css';

interface MetaModalProps {
    meta: MetaPreview;
    onClose: () => void;
    onWatchParty: (magnetUri: string) => void;
}

export default function MetaModal({ meta, onClose, onWatchParty }: MetaModalProps) {
    const [fullMeta, setFullMeta] = useState<MetaObject | null>(null);
    const [streams, setStreams] = useState<StreamObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [showStreams, setShowStreams] = useState(false);
    const [loadingStreams, setLoadingStreams] = useState(false);

    // Load full meta details
    useEffect(() => {
        async function loadMeta() {
            try {
                const addonsResp = await getAddons();
                // Try to get meta from first addon that supports it
                for (const addon of addonsResp.addons) {
                    try {
                        const response = await getMeta(addon.id, meta.type, meta.id);
                        if (response.meta) {
                            setFullMeta(response.meta);
                            break;
                        }
                    } catch {
                        // Try next addon
                    }
                }
            } catch (error) {
                console.error('Failed to load meta:', error);
            } finally {
                setLoading(false);
            }
        }
        loadMeta();
    }, [meta]);

    const handleShowStreams = async () => {
        setLoadingStreams(true);
        try {
            const response = await getStreams(meta.type, meta.id);
            const allStreams = response.results.flatMap(r => r.streams);
            setStreams(allStreams);
            setShowStreams(true);
        } catch (error) {
            console.error('Failed to load streams:', error);
        } finally {
            setLoadingStreams(false);
        }
    };

    const handleStreamSelect = (stream: StreamObject) => {
        let magnetUri = '';

        if (stream.infoHash) {
            magnetUri = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.title || stream.name || 'video')}`;
        } else if (stream.url?.startsWith('magnet:')) {
            magnetUri = stream.url;
        }

        if (magnetUri) {
            onWatchParty(magnetUri);
        }
    };

    const displayMeta = fullMeta || meta;

    return (
        <div className="meta-modal-overlay" onClick={onClose}>
            <div className="meta-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                {displayMeta.background && (
                    <div
                        className="modal-background"
                        style={{ backgroundImage: `url(${displayMeta.background})` }}
                    />
                )}

                <div className="modal-content">
                    <div className="modal-poster">
                        <img
                            src={displayMeta.poster || ''}
                            alt={displayMeta.name}
                        />
                    </div>

                    <div className="modal-info">
                        <h2>{displayMeta.name}</h2>

                        <div className="modal-meta">
                            {displayMeta.year && <span>{displayMeta.year}</span>}
                            {fullMeta?.runtime && <span>{fullMeta.runtime}</span>}
                            {displayMeta.imdbRating && (
                                <span className="flex items-center gap-1">
                                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                    {displayMeta.imdbRating}
                                </span>
                            )}
                        </div>

                        {displayMeta.genres && displayMeta.genres.length > 0 && (
                            <div className="modal-genres">
                                {displayMeta.genres.slice(0, 4).map(genre => (
                                    <span key={genre} className="genre-tag">{genre}</span>
                                ))}
                            </div>
                        )}

                        {(fullMeta?.description || meta.description) && (
                            <p className="modal-description">
                                {fullMeta?.description || meta.description}
                            </p>
                        )}

                        {fullMeta?.cast && fullMeta.cast.length > 0 && (
                            <div className="modal-cast">
                                <strong>Cast:</strong> {fullMeta.cast.slice(0, 5).join(', ')}
                            </div>
                        )}

                        {!showStreams ? (
                            <button
                                className="watch-party-btn flex items-center justify-center gap-2"
                                onClick={handleShowStreams}
                                disabled={loadingStreams || loading}
                            >
                                {loadingStreams ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} /> Finding streams...
                                    </>
                                ) : (
                                    <>
                                        <PartyPopper size={20} /> Start Watch Party
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="streams-section">
                                <h3>Select a Stream</h3>
                                {streams.length === 0 ? (
                                    <p className="no-streams">
                                        No streams found. Try installing stream addons like Torrentio.
                                    </p>
                                ) : (
                                    <div className="streams-list">
                                        {streams.slice(0, 10).map((stream, index) => (
                                            <button
                                                key={index}
                                                className="stream-option"
                                                onClick={() => handleStreamSelect(stream)}
                                                disabled={!stream.infoHash && !stream.url?.startsWith('magnet:')}
                                            >
                                                <span className="stream-name">{stream.name || 'Unknown'}</span>
                                                <span className="stream-title">{stream.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
