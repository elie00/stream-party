/**
 * Addon API Routes
 * Manages addon installation and proxies requests to Stremio-compatible addons
 */

import { Router } from 'express';
import {
    getInstalledAddons,
    getAddonById,
    installAddon,
    uninstallAddon,
    fetchCatalog,
    fetchMeta,
    fetchStreams,
} from '../services/addonProxy.js';

const router = Router();

/**
 * GET /api/addons
 * List all installed addons
 */
router.get('/', (_req, res) => {
    try {
        const addons = getInstalledAddons();
        res.json({
            addons: addons.map(addon => ({
                id: addon.id,
                name: addon.manifest.name,
                version: addon.manifest.version,
                description: addon.manifest.description,
                logo: addon.manifest.logo,
                types: addon.manifest.types,
                catalogs: addon.manifest.catalogs,
                installedAt: addon.installedAt,
            })),
        });
    } catch (error) {
        console.error('Error listing addons:', error);
        res.status(500).json({ error: 'Failed to list addons' });
    }
});

/**
 * POST /api/addons
 * Install a new addon by URL
 */
router.post('/', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }

        const addon = await installAddon(url);
        res.status(201).json({
            id: addon.id,
            name: addon.manifest.name,
            version: addon.manifest.version,
            description: addon.manifest.description,
            catalogs: addon.manifest.catalogs,
        });
    } catch (error) {
        console.error('Error installing addon:', error);
        res.status(400).json({
            error: error instanceof Error ? error.message : 'Failed to install addon'
        });
    }
});

/**
 * DELETE /api/addons/:id
 * Uninstall an addon
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const removed = uninstallAddon(id);

        if (!removed) {
            return res.status(404).json({ error: 'Addon not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error uninstalling addon:', error);
        res.status(500).json({ error: 'Failed to uninstall addon' });
    }
});

/**
 * GET /api/addons/:id/catalog/:type/:catalogId
 * Proxy catalog request to addon
 */
router.get('/:id/catalog/:type/:catalogId', async (req, res) => {
    try {
        const { id, type, catalogId } = req.params;
        const addon = getAddonById(id);

        if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
        }

        // Pass extra params from query
        const extra: Record<string, string> = {};
        if (req.query.search) extra.search = String(req.query.search);
        if (req.query.skip) extra.skip = String(req.query.skip);
        if (req.query.genre) extra.genre = String(req.query.genre);

        const catalog = await fetchCatalog(addon.url, type, catalogId, extra);
        res.json(catalog);
    } catch (error) {
        console.error('Error fetching catalog:', error);
        res.status(500).json({ error: 'Failed to fetch catalog' });
    }
});

/**
 * GET /api/addons/:id/meta/:type/:contentId
 * Proxy meta request to addon
 */
router.get('/:id/meta/:type/:contentId', async (req, res) => {
    try {
        const { id, type, contentId } = req.params;
        const addon = getAddonById(id);

        if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
        }

        const meta = await fetchMeta(addon.url, type, contentId);
        res.json(meta);
    } catch (error) {
        console.error('Error fetching meta:', error);
        res.status(500).json({ error: 'Failed to fetch meta' });
    }
});

/**
 * GET /api/addons/:id/stream/:type/:contentId
 * Proxy stream request to addon
 */
router.get('/:id/stream/:type/:contentId', async (req, res) => {
    try {
        const { id, type, contentId } = req.params;
        const addon = getAddonById(id);

        if (!addon) {
            return res.status(404).json({ error: 'Addon not found' });
        }

        const streams = await fetchStreams(addon.url, type, contentId);
        res.json(streams);
    } catch (error) {
        console.error('Error fetching streams:', error);
        res.status(500).json({ error: 'Failed to fetch streams' });
    }
});

/**
 * GET /api/addons/aggregate/catalog/:type
 * Aggregate catalogs from all addons for a type
 */
router.get('/aggregate/catalog/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const addons = getInstalledAddons();

        const results: Array<{
            addonId: string;
            addonName: string;
            catalogId: string;
            catalogName: string;
            metas: unknown[];
        }> = [];

        for (const addon of addons) {
            // Find catalogs matching this type
            const matchingCatalogs = addon.manifest.catalogs.filter(c => c.type === type);

            for (const catalog of matchingCatalogs) {
                try {
                    const data = await fetchCatalog(addon.url, type, catalog.id);
                    results.push({
                        addonId: addon.id,
                        addonName: addon.manifest.name,
                        catalogId: catalog.id,
                        catalogName: catalog.name || catalog.id,
                        metas: data.metas || [],
                    });
                } catch {
                    // Skip failed catalogs
                    console.warn(`Failed to fetch catalog ${catalog.id} from ${addon.manifest.name}`);
                }
            }
        }

        res.json({ catalogs: results });
    } catch (error) {
        console.error('Error aggregating catalogs:', error);
        res.status(500).json({ error: 'Failed to aggregate catalogs' });
    }
});

/**
 * GET /api/addons/aggregate/stream/:type/:contentId
 * Aggregate streams from all addons for content
 */
router.get('/aggregate/stream/:type/:contentId', async (req, res) => {
    try {
        const { type, contentId } = req.params;
        const addons = getInstalledAddons();

        const allStreams: Array<{
            addonId: string;
            addonName: string;
            streams: unknown[];
        }> = [];

        // Fetch streams from all addons in parallel
        const promises = addons.map(async (addon) => {
            // Check if addon supports stream resource
            const supportsStreams = addon.manifest.resources.some(
                r => r === 'stream' || (typeof r === 'object' && r.name === 'stream')
            );

            if (!supportsStreams) return null;

            try {
                const data = await fetchStreams(addon.url, type, contentId);
                if (data.streams && data.streams.length > 0) {
                    return {
                        addonId: addon.id,
                        addonName: addon.manifest.name,
                        streams: data.streams,
                    };
                }
            } catch {
                // Skip failed addons
            }
            return null;
        });

        const results = await Promise.all(promises);
        results.forEach(r => {
            if (r) allStreams.push(r);
        });

        res.json({ results: allStreams });
    } catch (error) {
        console.error('Error aggregating streams:', error);
        res.status(500).json({ error: 'Failed to aggregate streams' });
    }
});

export default router;
