const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  // Get token from localStorage
  const authData = JSON.parse(localStorage.getItem('stream-party-auth') || '{}');
  const token = authData?.state?.token;

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, errorData.error || response.statusText);
  }

  return response.json();
}

export async function loginAsGuest(displayName: string): Promise<{ token: string; user: { id: string; displayName: string } }> {
  return fetchApi('/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
}

export async function createRoom(name: string): Promise<{ id: string; code: string; name: string }> {
  return fetchApi('/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function getRoom(code: string): Promise<{ id: string; code: string; name: string }> {
  return fetchApi(`/rooms/${code}`);
}

interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

export async function getIceServers(): Promise<{ iceServers: IceServer[] }> {
  return fetchApi('/rooms/ice-servers');
}

// ============ Addon API ============

import type {
  AddonsResponse,
  CatalogResponse,
  MetaResponse,
  AggregatedStreamResponse,
} from '../types/stremio';

export async function getAddons(): Promise<AddonsResponse> {
  return fetchApi('/addons');
}

export async function installAddon(url: string): Promise<{ id: string; name: string }> {
  return fetchApi('/addons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

export async function uninstallAddon(id: string): Promise<void> {
  return fetchApi(`/addons/${id}`, { method: 'DELETE' });
}

export async function getCatalog(
  addonId: string,
  type: string,
  catalogId: string,
  extra?: { search?: string; skip?: string; genre?: string }
): Promise<CatalogResponse> {
  const params = new URLSearchParams();
  if (extra?.search) params.set('search', extra.search);
  if (extra?.skip) params.set('skip', extra.skip);
  if (extra?.genre) params.set('genre', extra.genre);

  const query = params.toString() ? `?${params}` : '';
  return fetchApi(`/addons/${addonId}/catalog/${type}/${catalogId}${query}`);
}

export async function getMeta(
  addonId: string,
  type: string,
  contentId: string
): Promise<MetaResponse> {
  return fetchApi(`/addons/${addonId}/meta/${type}/${contentId}`);
}

export async function getStreams(
  type: string,
  contentId: string
): Promise<AggregatedStreamResponse> {
  return fetchApi(`/addons/aggregate/stream/${type}/${contentId}`);
}
