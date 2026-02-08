import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Stub module IDs for Node-only packages that WebTorrent pulls in.
// These are not used in the browser but the named exports must exist
// for Rollup to resolve the imports without error.
const browserStubs: Record<string, string> = {
  'bittorrent-dht': 'export const Client = class {}; export default Client;',
  'ut_pex': 'export default function() {}; export const pex = {};',
};

function browserStubPlugin() {
  return {
    name: 'browser-stub',
    enforce: 'pre' as const,
    resolveId(source: string) {
      if (source in browserStubs) return `\0stub:${source}`;
      return null;
    },
    load(id: string) {
      if (id.startsWith('\0stub:')) {
        const key = id.slice('\0stub:'.length);
        return browserStubs[key] ?? 'export default {};';
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util', 'events', 'path'],
      globals: { Buffer: true, process: true },
    }),
    browserStubPlugin(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  optimizeDeps: {
    include: ['webtorrent'],
  },
});
