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
