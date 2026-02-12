/**
 * Stremio Addon Types (Client-side)
 */

// Addon info from API
export interface AddonInfo {
    id: string;
    name: string;
    version: string;
    description?: string;
    logo?: string;
    types: string[];
    catalogs: CatalogDescriptor[];
    installedAt: string;
}

export interface CatalogDescriptor {
    type: string;
    id: string;
    name?: string;
    genres?: string[];
    extra?: ExtraDescriptor[];
}

export interface ExtraDescriptor {
    name: string;
    options?: string[];
    isRequired?: boolean;
}

// Meta preview (catalog item)
export interface MetaPreview {
    id: string;
    type: string;
    name: string;
    poster?: string;
    posterShape?: 'square' | 'poster' | 'landscape';
    background?: string;
    description?: string;
    year?: number | string;
    releaseInfo?: string;
    imdbRating?: string;
    genres?: string[];
}

// Full meta (details)
export interface MetaObject {
    id: string;
    type: string;
    name: string;
    poster?: string;
    background?: string;
    logo?: string;
    description?: string;
    releaseInfo?: string;
    year?: number | string;
    runtime?: string;
    genres?: string[];
    director?: string[];
    cast?: string[];
    imdbRating?: string;
    trailers?: { source: string; type: string }[];
    videos?: Video[];
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

// Stream
export interface StreamObject {
    name?: string;
    title?: string;
    url?: string;
    infoHash?: string;
    fileIdx?: number;
    externalUrl?: string;
    behaviorHints?: {
        bingeGroup?: string;
    };
}

// API Responses
export interface AddonsResponse {
    addons: AddonInfo[];
}

export interface CatalogResponse {
    metas: MetaPreview[];
}

export interface MetaResponse {
    meta: MetaObject;
}

export interface StreamResponse {
    streams: StreamObject[];
}

export interface AggregatedCatalogResponse {
    catalogs: Array<{
        addonId: string;
        addonName: string;
        catalogId: string;
        catalogName: string;
        metas: MetaPreview[];
    }>;
}

export interface AggregatedStreamResponse {
    results: Array<{
        addonId: string;
        addonName: string;
        streams: StreamObject[];
    }>;
}
