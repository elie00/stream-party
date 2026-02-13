import { useEffect } from 'react';
import { useModerationStore } from '../stores/moderationStore';
import { getSocket } from '../services/socket';
import type {
  ModerationLogWithUsers,
  MutedUserWithDetails,
  BannedUserWithDetails,
  AutoModConfig,
} from '@stream-party/shared';

export function useModeration(serverId: string | null) {
  const store = useModerationStore();

  // Listen for moderation socket events
  useEffect(() => {
    if (!serverId) return;

    const socket = getSocket();

    const handleWarned = (data: { log: ModerationLogWithUsers }) => {
      store.addLog(data.log);
    };

    const handleMuted = (data: { mutedUser: MutedUserWithDetails }) => {
      store.addMutedUser(data.mutedUser);
      store.addLog({
        id: Date.now(),
        serverId,
        action: 'mute',
        targetUserId: data.mutedUser.userId,
        moderatorId: data.mutedUser.mutedBy,
        reason: data.mutedUser.reason,
        createdAt: new Date(),
        targetUser: data.mutedUser.user,
        moderator: data.mutedUser.mutedByUser,
      });
    };

    const handleUnmuted = (data: { serverId: string; userId: string }) => {
      store.removeMutedUser(data.userId);
    };

    const handleKicked = (_data: { serverId: string; userId: string; reason: string }) => {
      // Kicked user is removed from server members; logs will refresh
    };

    const handleBanned = (data: { bannedUser: BannedUserWithDetails }) => {
      store.addBannedUser(data.bannedUser);
    };

    const handleUnbanned = (data: { serverId: string; userId: string }) => {
      store.removeBannedUser(data.userId);
    };

    const handleLogs = (data: { logs: ModerationLogWithUsers[] }) => {
      store.setLogs(data.logs);
    };

    const handleMutedUsers = (data: { mutedUsers: MutedUserWithDetails[] }) => {
      store.setMutedUsers(data.mutedUsers);
    };

    const handleBannedUsers = (data: { bannedUsers: BannedUserWithDetails[] }) => {
      store.setBannedUsers(data.bannedUsers);
    };

    const handleConfig = (data: { config: AutoModConfig }) => {
      store.setAutoModConfig(data.config);
    };

    const handleConfigUpdated = (data: { config: AutoModConfig }) => {
      store.setAutoModConfig(data.config);
    };

    const handleError = (data: { message: string }) => {
      store.setError(data.message);
    };

    socket.on('mod:warned' as any, handleWarned);
    socket.on('mod:muted' as any, handleMuted);
    socket.on('mod:unmuted' as any, handleUnmuted);
    socket.on('mod:kicked' as any, handleKicked);
    socket.on('mod:banned' as any, handleBanned);
    socket.on('mod:unbanned' as any, handleUnbanned);
    socket.on('mod:logs' as any, handleLogs);
    socket.on('mod:muted-users' as any, handleMutedUsers);
    socket.on('mod:banned-users' as any, handleBannedUsers);
    socket.on('mod:config' as any, handleConfig);
    socket.on('mod:config-updated' as any, handleConfigUpdated);
    socket.on('mod:error' as any, handleError);

    return () => {
      socket.off('mod:warned' as any, handleWarned);
      socket.off('mod:muted' as any, handleMuted);
      socket.off('mod:unmuted' as any, handleUnmuted);
      socket.off('mod:kicked' as any, handleKicked);
      socket.off('mod:banned' as any, handleBanned);
      socket.off('mod:unbanned' as any, handleUnbanned);
      socket.off('mod:logs' as any, handleLogs);
      socket.off('mod:muted-users' as any, handleMutedUsers);
      socket.off('mod:banned-users' as any, handleBannedUsers);
      socket.off('mod:config' as any, handleConfig);
      socket.off('mod:config-updated' as any, handleConfigUpdated);
      socket.off('mod:error' as any, handleError);
    };
  }, [serverId]);

  // Auto-fetch data when serverId changes
  useEffect(() => {
    if (!serverId) return;

    store.fetchLogs(serverId);
    store.fetchMuted(serverId);
    store.fetchBanned(serverId);
    store.fetchConfig(serverId);
  }, [serverId]);

  return {
    ...store,
    serverId,
  };
}
