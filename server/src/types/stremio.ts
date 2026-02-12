/**
 * Stremio Addon Protocol Types
 * Compatible with Stremio addon ecosystem
 */

// Manifest types
export interface AddonManifest {
    id: string;
    name: string;
    version: string;
    description?: string;
    logo?: string;
    background?: string;
    catalogs: CatalogDescriptor[];
    resources: (string | ResourceDescriptor)[];
    types: string[];
    idPrefixes?: string[];
    behaviorHints?: {
        adult?: boolean;
        configurable?: boolean;
        configurationRequired?: boolean;
    };
}

export interface CatalogDescriptor {
    type: string;  // "movie", "series", etc.
    id: string;    // catalog identifier
    name?: string;
    extra?: ExtraDescriptor[];
}

export interface ResourceDescriptor {
    name: string;
    types: string[];
    idPrefixes?: string[];
}

export interface ExtraDescriptor {
    name: string;
    options?: string[];
    isRequired?: boolean;
}

// Meta types
export interface MetaObject {
    id: string;
    type: string;
    name: string;
    poster?: string;
    posterShape?: 'square' | 'poster' | 'landscape';
    background?: string;
    logo?: string;
    description?: string;
    releaseInfo?: string;
    year?: number;
    runtime?: string;
    genres?: string[];
    director?: string[];
    cast?: string[];
    imdbRating?: string;
    awards?: string;
    country?: string;
    trailers?: { source: string; type: string }[];
    videos?: Video[];
    links?: Link[];
    behaviorHints?: {
        defaultVideoId?: string;
        hasScheduledVideos?: boolean;
    };
}

export interface Video {
    id: string;
    title: string;
    released?: string;
    season?: number;
    episode?: number;
    overview?: string;
    thumbnail?: string;
}

export interface Link {
    name: string;
    category: string;
    url: string;
}

// Stream types
export interface StreamObject {
    name?: string;
    title?: string;
    url?: string;
    infoHash?: string;
    fileIdx?: number;
    externalUrl?: string;
    behaviorHints?: {
        bingeGroup?: string;
        countryWhitelist?: string[];
        notWebReady?: boolean;
        proxyHeaders?: {
            request?: Record<string, string>;
            response?: Record<string, string>;
        };
    };
}

// API Response types
export interface CatalogResponse {
    metas: MetaPreview[];
}

export interface MetaPreview {
    id: string;
    type: string;
    name: string;
    poster?: string;
    posterShape?: string;
    description?: string;
    year?: number;
    imdbRating?: string;
}

export interface MetaResponse {
    meta: MetaObject;
}

export interface StreamResponse {
    streams: StreamObject[];
}

// Installed addon
export interface InstalledAddon {
    id: string;
    url: string;
    manifest: AddonManifest;
    installedAt: Date;
}
