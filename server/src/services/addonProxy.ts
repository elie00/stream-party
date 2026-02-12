/**
 * Addon Proxy Service
 * Fetches and caches data from Stremio-compatible addons
 */

import type {
    AddonManifest,
    CatalogResponse,
    MetaResponse,
    StreamResponse,
    InstalledAddon,
} from '../types/stremio.js';

// In-memory cache for addon data
const manifestCache = new Map<string, { manifest: AddonManifest; fetchedAt: number }>();
const responseCache = new Map<string, { data: unknown; fetchedAt: number }>();

const MANIFEST_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const RESPONSE_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes

/**
 * Normalize addon URL to ensure consistent format
 */
function normalizeAddonUrl(url: string): string {
    // Remove trailing slash
    let normalized = url.replace(/\/+$/, '');
    // Remove /manifest.json if present
    normalized = normalized.replace(/\/manifest\.json$/, '');
    return normalized;
}

/**
 * Fetch addon manifest from URL
 */
export async function fetchManifest(addonUrl: string): Promise<AddonManifest> {
    const normalizedUrl = normalizeAddonUrl(addonUrl);
    const cacheKey = normalizedUrl;

    // Check cache
    const cached = manifestCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < MANIFEST_CACHE_TTL) {
        return cached.manifest;
    }

    // Fetch manifest
    const manifestUrl = `${normalizedUrl}/manifest.json`;
    const response = await fetch(manifestUrl, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'StreamParty/1.0',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch manifest from ${manifestUrl}: ${response.status}`);
    }

    const manifest = await response.json() as AddonManifest;

    // Validate manifest
    if (!manifest.id || !manifest.name || !manifest.version) {
        throw new Error('Invalid manifest: missing required fields (id, name, version)');
    }

    // Cache manifest
    manifestCache.set(cacheKey, { manifest, fetchedAt: Date.now() });

    return manifest;
}

/**
 * Fetch catalog from addon
 */
export async function fetchCatalog(
    addonUrl: string,
    type: string,
    catalogId: string,
    extra?: Record<string, string>
): Promise<CatalogResponse> {
    const normalizedUrl = normalizeAddonUrl(addonUrl);

    // Build URL with extra params
    let catalogPath = `/catalog/${type}/${catalogId}.json`;
    if (extra && Object.keys(extra).length > 0) {
        const extraParams = Object.entries(extra)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');
        catalogPath = `/catalog/${type}/${catalogId}/${extraParams}.json`;
    }

    const cacheKey = `${normalizedUrl}${catalogPath}`;

    // Check cache
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < RESPONSE_CACHE_TTL) {
        return cached.data as CatalogResponse;
    }

    const response = await fetch(`${normalizedUrl}${catalogPath}`, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'StreamParty/1.0',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch catalog: ${response.status}`);
    }

    const data = await response.json() as CatalogResponse;

    // Cache response
    responseCache.set(cacheKey, { data, fetchedAt: Date.now() });

    return data;
}

/**
 * Fetch meta (details) from addon
 */
export async function fetchMeta(
    addonUrl: string,
    type: string,
    id: string
): Promise<MetaResponse> {
    const normalizedUrl = normalizeAddonUrl(addonUrl);
    const metaPath = `/meta/${type}/${encodeURIComponent(id)}.json`;
    const cacheKey = `${normalizedUrl}${metaPath}`;

    // Check cache
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < RESPONSE_CACHE_TTL) {
        return cached.data as MetaResponse;
    }

    const response = await fetch(`${normalizedUrl}${metaPath}`, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'StreamParty/1.0',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch meta: ${response.status}`);
    }

    const data = await response.json() as MetaResponse;

    // Cache response
    responseCache.set(cacheKey, { data, fetchedAt: Date.now() });

    return data;
}

/**
 * Fetch streams from addon
 */
export async function fetchStreams(
    addonUrl: string,
    type: string,
    id: string
): Promise<StreamResponse> {
    const normalizedUrl = normalizeAddonUrl(addonUrl);
    const streamPath = `/stream/${type}/${encodeURIComponent(id)}.json`;

    // Streams are not cached as aggressively (they can change)
    const response = await fetch(`${normalizedUrl}${streamPath}`, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'StreamParty/1.0',
        },
    });

    if (!response.ok) {
        // Return empty streams on error (addon might not support this content)
        return { streams: [] };
    }

    return await response.json() as StreamResponse;
}

/**
 * Clear all caches
 */
export function clearCache(): void {
    manifestCache.clear();
    responseCache.clear();
}

/**
 * In-memory addon storage (will be replaced with DB later)
 */
const installedAddons = new Map<string, InstalledAddon>();

// Pre-installed popular addons
const DEFAULT_ADDONS = [
    'https://v3-cinemeta.strem.io',  // IMDB metadata
];

// Initialize default addons
async function initDefaultAddons() {
    for (const url of DEFAULT_ADDONS) {
        try {
            const manifest = await fetchManifest(url);
            installedAddons.set(manifest.id, {
                id: manifest.id,
                url: normalizeAddonUrl(url),
                manifest,
                installedAt: new Date(),
            });
            console.log(`Loaded default addon: ${manifest.name}`);
        } catch (error) {
            console.warn(`Failed to load default addon ${url}:`, error);
        }
    }
}

// Initialize on module load
initDefaultAddons();

/**
 * Get all installed addons
 */
export function getInstalledAddons(): InstalledAddon[] {
    return Array.from(installedAddons.values());
}

/**
 * Get addon by ID
 */
export function getAddonById(id: string): InstalledAddon | undefined {
    return installedAddons.get(id);
}

/**
 * Install a new addon
 */
export async function installAddon(url: string): Promise<InstalledAddon> {
    const normalizedUrl = normalizeAddonUrl(url);
    const manifest = await fetchManifest(normalizedUrl);

    const addon: InstalledAddon = {
        id: manifest.id,
        url: normalizedUrl,
        manifest,
        installedAt: new Date(),
    };

    installedAddons.set(manifest.id, addon);
    return addon;
}

/**
 * Uninstall an addon
 */
export function uninstallAddon(id: string): boolean {
    return installedAddons.delete(id);
}
