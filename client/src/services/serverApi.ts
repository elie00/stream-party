/**
 * Server API — HTTP calls for server/community management
 * Extracted from ServersPage.tsx for reusability
 */

import { useAuthStore } from '../stores/authStore';

function getToken(): string | null {
    let token = useAuthStore.getState().token;
    if (!token) {
        try {
            const authData = JSON.parse(localStorage.getItem('stream-party-auth') || '{}');
            token = authData?.state?.token ?? null;
        } catch {
            // localStorage may be blocked
        }
    }
    return token;
}

function getAuthHeaders(): HeadersInit {
    const token = getToken();
    return {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

function getJsonAuthHeaders(): HeadersInit {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export async function fetchServers() {
    const response = await fetch('/api/servers', {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch servers');
    return response.json();
}

export async function createServerApi(data: { name: string; icon?: string; description?: string }) {
    const response = await fetch('/api/servers', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create server');
    }
    return response.json();
}

export async function joinServerApi(inviteCode: string) {
    const response = await fetch('/api/servers/join', {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify({ inviteCode }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to join server');
    }
    return response.json();
}

export async function getServerApi(serverId: string) {
    const response = await fetch(`/api/servers/${serverId}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch server');
    return response.json();
}

export async function updateServerApi(serverId: string, data: { name?: string; icon?: string; description?: string }) {
    const response = await fetch(`/api/servers/${serverId}`, {
        method: 'PATCH',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update server');
    }
    return response.json();
}

export async function deleteServerApi(serverId: string) {
    const response = await fetch(`/api/servers/${serverId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete server');
    }
    return response.json();
}

export async function leaveServerApi(serverId: string) {
    const response = await fetch(`/api/servers/${serverId}/leave`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to leave server');
    }
    return response.json();
}

export async function createChannelApi(serverId: string, data: { name: string; type: 'text' | 'voice'; topic?: string }) {
    const response = await fetch(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        headers: getJsonAuthHeaders(),
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create channel');
    }
    return response.json();
}

export async function deleteChannelApi(serverId: string, channelId: string) {
    const response = await fetch(`/api/servers/${serverId}/channels/${channelId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete channel');
    }
    return response.json();
}
