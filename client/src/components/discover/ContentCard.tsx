import { Star } from 'lucide-react';
import type { MetaPreview } from '../../types/stremio';
import './ContentCard.css';

interface ContentCardProps {
    meta: MetaPreview;
    onClick: () => void;
}

export default function ContentCard({ meta, onClick }: ContentCardProps) {
    const fallbackPoster = `https://via.placeholder.com/300x450/1a1a2e/667eea?text=${encodeURIComponent(meta.name.slice(0, 10))}`;

    return (
        <div className="content-card" onClick={onClick}>
            <div className="card-poster">
                <img
                    src={meta.poster || fallbackPoster}
                    alt={meta.name}
                    loading="lazy"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = fallbackPoster;
                    }}
                />
                {meta.imdbRating && (
                    <span className="card-rating">
                        <Star size={12} className="inline-block mr-1 fill-yellow-400 text-yellow-400" />
                        {meta.imdbRating}
                    </span>
                )}
            </div>
            <div className="card-info">
                <h3 className="card-title">{meta.name}</h3>
                <span className="card-year">{meta.year || meta.releaseInfo}</span>
            </div>
        </div>
    );
}
