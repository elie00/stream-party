import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ServerList,
  ChannelList,
  CreateServerModal,
  JoinServerModal,
  ServerSettings,
} from '../components/server';
import { useServerStore } from '../stores/serverStore';
import { useAuthStore } from '../stores/authStore';
import { socket } from '../services/socket';
import { useToastStore } from '../components/ui/Toast';
import type { Server, Channel, ServerWithDetails } from '@stream-party/shared';

// API functions
async function fetchServers() {
  const response = await fetch('/api/servers', {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch servers');
  return response.json();
}

async function createServerApi(data: { name: string; icon?: string; description?: string }) {
  const response = await fetch('/api/servers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create server');
  }
  return response.json();
}

async function joinServerApi(inviteCode: string) {
  const response = await fetch('/api/servers/join', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({ inviteCode }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to join server');
  }
  return response.json();
}

async function getServerApi(serverId: string) {
  const response = await fetch(`/api/servers/${serverId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch server');
  return response.json();
}

async function updateServerApi(serverId: string, data: { name?: string; icon?: string; description?: string }) {
  const response = await fetch(`/api/servers/${serverId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update server');
  }
  return response.json();
}

async function deleteServerApi(serverId: string) {
  const response = await fetch(`/api/servers/${serverId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete server');
  }
  return response.json();
}

async function leaveServerApi(serverId: string) {
  const response = await fetch(`/api/servers/${serverId}/leave`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to leave server');
  }
  return response.json();
}

async function createChannelApi(serverId: string, data: { name: string; type: 'text' | 'voice'; topic?: string }) {
  const response = await fetch(`/api/servers/${serverId}/channels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create channel');
  }
  return response.json();
}

async function deleteChannelApi(serverId: string, channelId: string) {
  const response = await fetch(`/api/servers/${serverId}/channels/${channelId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete channel');
  }
  return response.json();
}

export function ServersPage() {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  
  const {
    servers,
    activeServer,
    activeChannel,
    setServers,
    addServer,
    removeServer,
    setActiveServer,
    setActiveChannel,
    addChannel,
    removeChannel,
    addMember,
    removeMember,
    setLoading,
    setError,
  } = useServerStore();

  const { isAuthenticated } = useAuthStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice'>('text');
  const [newChannelName, setNewChannelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load servers on mount
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }

    const loadServers = async () => {
      setLoading(true);
      try {
        const { servers: serverList } = await fetchServers();
        setServers(serverList);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load servers');
      } finally {
        setLoading(false);
      }
    };

    loadServers();
  }, [isAuthenticated, navigate, setServers, setLoading, setError]);

  // Socket event listeners
  useEffect(() => {
    const handleServerJoined = (data: ServerWithDetails) => {
      setActiveServer(data);
    };

    const handleServerLeft = (data: { serverId: string }) => {
      if (activeServer?.id === data.serverId) {
        setActiveServer(null);
      }
    };

    const handleMemberJoined = (data: { serverId: string; member: any }) => {
      addMember(data.serverId, data.member);
    };

    const handleMemberLeft = (data: { serverId: string; userId: string }) => {
      removeMember(data.serverId, data.userId);
    };

    const handleChannelCreated = (data: { serverId: string; channel: Channel }) => {
      addChannel(data.serverId, data.channel);
    };

    const handleChannelDeleted = (data: { serverId: string; channelId: string }) => {
      removeChannel(data.serverId, data.channelId);
    };

    socket.on('server:joined', handleServerJoined);
    socket.on('server:left', handleServerLeft);
    socket.on('server:member-joined', handleMemberJoined);
    socket.on('server:member-left', handleMemberLeft);
    socket.on('server:channel-created', handleChannelCreated);
    socket.on('server:channel-deleted', handleChannelDeleted);

    return () => {
      socket.off('server:joined', handleServerJoined);
      socket.off('server:left', handleServerLeft);
      socket.off('server:member-joined', handleMemberJoined);
      socket.off('server:member-left', handleMemberLeft);
      socket.off('server:channel-created', handleChannelCreated);
      socket.off('server:channel-deleted', handleChannelDeleted);
    };
  }, [activeServer, setActiveServer, addMember, removeMember, addChannel, removeChannel]);

  const handleServerSelect = useCallback(async (server: Server | null) => {
    if (!server) {
      setActiveServer(null);
      return;
    }

    try {
      // Join the server socket room
      socket.emit('server:join', { serverId: server.id }, (res: { success: boolean; error?: string }) => {
        if (!res.success) {
          addToast(res.error || 'Failed to join server', 'error');
        }
      });

      // Fetch full server details
      const { server: serverData } = await getServerApi(server.id);
      setActiveServer(serverData);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to load server', 'error');
    }
  }, [setActiveServer, addToast]);

  const handleCreateServer = async (data: { name: string; icon?: string; description?: string }) => {
    setIsLoading(true);
    try {
      const { server } = await createServerApi(data);
      addServer(server);
      setActiveServer(server);
      addToast('Serveur créé avec succès', 'success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinServer = async (inviteCode: string) => {
    setIsLoading(true);
    try {
      const { server } = await joinServerApi(inviteCode);
      addServer(server);
      setActiveServer(server);
      addToast('Vous avez rejoint le serveur', 'success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateServer = async (data: { name?: string; icon?: string; description?: string }) => {
    if (!activeServer) return;
    
    setIsLoading(true);
    try {
      const { server } = await updateServerApi(activeServer.id, data);
      setActiveServer({ ...activeServer, ...server });
      addToast('Serveur mis à jour', 'success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!activeServer) return;
    
    await deleteServerApi(activeServer.id);
    removeServer(activeServer.id);
    socket.emit('server:leave', { serverId: activeServer.id });
    addToast('Serveur supprimé', 'success');
  };

  const handleLeaveServer = async () => {
    if (!activeServer) return;
    
    await leaveServerApi(activeServer.id);
    removeServer(activeServer.id);
    socket.emit('server:leave', { serverId: activeServer.id });
    addToast('Vous avez quitté le serveur', 'success');
  };

  const handleCreateChannel = async (type: 'text' | 'voice') => {
    setNewChannelType(type);
    setShowCreateChannel(true);
  };

  const handleCreateChannelSubmit = async () => {
    if (!activeServer || !newChannelName.trim()) return;

    setIsLoading(true);
    try {
      const { channel } = await createChannelApi(activeServer.id, {
        name: newChannelName.trim(),
        type: newChannelType,
      });
      addChannel(activeServer.id, channel);
      setShowCreateChannel(false);
      setNewChannelName('');
      addToast('Salon créé', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Erreur lors de la création', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChannel = async (channel: Channel) => {
    if (!activeServer) return;

    try {
      await deleteChannelApi(activeServer.id, channel.id);
      removeChannel(activeServer.id, channel.id);
      addToast('Salon supprimé', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Erreur lors de la suppression', 'error');
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Server sidebar */}
      <ServerList
        onServerSelect={handleServerSelect}
        onCreateServer={() => setShowCreateModal(true)}
        onJoinServer={() => setShowJoinModal(true)}
      />

      {/* Channel sidebar */}
      {activeServer && (
        <ChannelList
          onChannelSelect={setActiveChannel}
          onCreateChannel={handleCreateChannel}
          onDeleteChannel={handleDeleteChannel}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {activeServer ? (
          <>
            {/* Channel header */}
            {activeChannel && (
              <div className="flex items-center justify-between px-4 h-12 border-b border-gray-800 bg-gray-800">
                <div className="flex items-center gap-2">
                  {activeChannel.type === 'text' ? (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
                    </svg>
                  )}
                  <span className="font-semibold">{activeChannel.name}</span>
                  {activeChannel.topic && (
                    <>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-400 text-sm">{activeChannel.topic}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                {activeChannel?.type === 'voice' ? (
                  <>
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0" />
                    </svg>
                    <p className="text-lg">Salon vocal</p>
                    <p className="text-sm">Cliquez pour rejoindre le salon vocal</p>
                  </>
                ) : (
                  <>
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <p className="text-lg">Bienvenue sur {activeServer.name}</p>
                    <p className="text-sm">Sélectionnez un salon pour commencer</p>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          /* No server selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <svg className="w-24 h-24 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-xl mb-2">Bienvenue sur StreamParty</p>
              <p className="text-sm">Créez ou rejoignez un serveur pour commencer</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateServerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateServer={handleCreateServer}
        isLoading={isLoading}
      />

      <JoinServerModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoinServer={handleJoinServer}
        isLoading={isLoading}
      />

      <ServerSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onUpdateServer={handleUpdateServer}
        onDeleteServer={handleDeleteServer}
        onLeaveServer={handleLeaveServer}
      />

      {/* Create channel modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Créer un salon {newChannelType === 'text' ? 'textuel' : 'vocal'}
            </h3>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Nom du salon"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
              maxLength={30}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateChannel(false);
                  setNewChannelName('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateChannelSubmit}
                disabled={!newChannelName.trim() || isLoading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
              >
                Créer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
