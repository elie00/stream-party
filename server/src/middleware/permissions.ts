import { Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { servers, serverMembers, roles, channelPermissions } from '../db/schema';
import type { Permission } from '../../../shared/src/types';
// Import auth middleware to pick up Express.Request.user augmentation
import './auth';

/**
 * Check if a user has a specific permission in a server.
 * Server owner always has all permissions.
 * The 'admin' permission grants all other permissions.
 */
export async function hasPermission(
  userId: string,
  serverId: string,
  permission: Permission
): Promise<boolean> {
  // Check if user is the server owner
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) return false;
  if (server.ownerId === userId) return true;

  // Get user's membership
  const [member] = await db
    .select({ role: serverMembers.role })
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.serverId, serverId),
        eq(serverMembers.userId, userId)
      )
    )
    .limit(1);

  if (!member) return false;

  // Get the role's permissions
  const [role] = await db
    .select({ permissions: roles.permissions })
    .from(roles)
    .where(
      and(
        eq(roles.serverId, serverId),
        eq(roles.name, member.role)
      )
    )
    .limit(1);

  if (!role) return false;

  const perms = role.permissions ?? [];
  if (perms.includes('admin')) return true;

  return perms.includes(permission);
}

/**
 * Get all effective permissions for a user in a server,
 * optionally applying channel-level overrides.
 */
export async function getEffectivePermissions(
  userId: string,
  serverId: string,
  channelId?: string
): Promise<Permission[]> {
  // Check if user is the server owner -- owners have all permissions
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) return [];

  const allPermissions: Permission[] = [
    'admin',
    'manage_channels',
    'manage_roles',
    'kick_members',
    'ban_members',
    'mute_members',
    'manage_messages',
    'view_audit_log',
    'manage_server',
  ];

  if (server.ownerId === userId) return allPermissions;

  // Get user's membership
  const [member] = await db
    .select({ role: serverMembers.role })
    .from(serverMembers)
    .where(
      and(
        eq(serverMembers.serverId, serverId),
        eq(serverMembers.userId, userId)
      )
    )
    .limit(1);

  if (!member) return [];

  // Get the role's permissions
  const [role] = await db
    .select({ id: roles.id, permissions: roles.permissions })
    .from(roles)
    .where(
      and(
        eq(roles.serverId, serverId),
        eq(roles.name, member.role)
      )
    )
    .limit(1);

  if (!role) return [];

  let perms = role.permissions ?? [];

  // Admin gets all permissions
  if (perms.includes('admin')) return allPermissions;

  // Apply channel-level overrides if channelId is provided
  if (channelId) {
    const [channelPerm] = await db
      .select({ allow: channelPermissions.allow, deny: channelPermissions.deny })
      .from(channelPermissions)
      .where(
        and(
          eq(channelPermissions.channelId, channelId),
          eq(channelPermissions.roleId, role.id)
        )
      )
      .limit(1);

    if (channelPerm) {
      const denyList = (channelPerm.deny ?? []) as Permission[];
      const allowList = (channelPerm.allow ?? []) as Permission[];

      // Remove denied permissions
      perms = perms.filter((p) => !denyList.includes(p as Permission));

      // Add allowed permissions
      for (const p of allowList) {
        if (!perms.includes(p)) {
          perms.push(p);
        }
      }
    }
  }

  return perms as Permission[];
}

/**
 * Express middleware factory that checks if the authenticated user
 * has the required permission in the server identified by req.params.serverId.
 * Returns 403 if the user lacks the permission.
 */
export function requireServerPermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    const serverId = req.params.serverId as string | undefined;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!serverId) {
      res.status(400).json({ error: 'Server ID is required' });
      return;
    }

    const allowed = await hasPermission(userId, serverId, permission);

    if (!allowed) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Socket-friendly permission check (no Express req/res).
 * Returns true if the user has the given permission in the server.
 */
export async function checkSocketPermission(
  userId: string,
  serverId: string,
  permission: Permission
): Promise<boolean> {
  return hasPermission(userId, serverId, permission);
}
