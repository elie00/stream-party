/**
 * Permissions Service
 * Gère les permissions au niveau des canaux avec overrides
 */
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { 
  channels, 
  serverMembers, 
  roles, 
  channelPermissions,
  users
} from '../db/schema';
import type { ChannelPermission, ChannelPermissionOverride } from '@stream-party/shared';
import { logger } from '../utils/logger';

// Cache pour les permissions ( TTL: 30 secondes )
const permissionCache = new Map<string, { permissions: string[]; timestamp: number }>();
const CACHE_TTL = 30000;

/**
 * PermissionsService - Gestion des permissions par canal
 */
class PermissionsService {
  /**
   * Récupérer toutes les overrides de permissions pour un canal
   */
  async getChannelPermissions(channelId: string): Promise<ChannelPermissionOverride[]> {
    try {
      const results = await db
        .select({
          id: channelPermissions.id,
          channelId: channelPermissions.channelId,
          roleId: channelPermissions.roleId,
          userId: channelPermissions.userId,
          allow: channelPermissions.allow,
          deny: channelPermissions.deny,
        })
        .from(channelPermissions)
        .where(eq(channelPermissions.channelId, channelId))
        .orderBy(desc(channelPermissions.id));

      return results.map(r => ({
        id: r.id,
        channelId: r.channelId,
        roleId: r.roleId ?? undefined,
        userId: r.userId ?? undefined,
        allow: r.allow ?? [],
        deny: r.deny ?? [],
      }));
    } catch (error) {
      logger.error('Failed to get channel permissions:', error);
      return [];
    }
  }

  /**
   * Définir une override de permission pour un rôle
   */
  async setRolePermission(
    channelId: string,
    roleId: number,
    allow: string[],
    deny: string[]
  ): Promise<ChannelPermissionOverride | null> {
    try {
      // Vérifier si une override existe déjà
      const existing = await db
        .select()
        .from(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.roleId, roleId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Mettre à jour l'override existante
        const [updated] = await db
          .update(channelPermissions)
          .set({ allow, deny })
          .where(eq(channelPermissions.id, existing[0].id))
          .returning();

        this.invalidateCache(channelId);
        return {
          id: updated.id,
          channelId: updated.channelId,
          roleId: updated.roleId ?? undefined,
          allow: updated.allow ?? [],
          deny: updated.deny ?? [],
        };
      } else {
        // Créer une nouvelle override
        const [created] = await db
          .insert(channelPermissions)
          .values({
            channelId,
            roleId,
            allow,
            deny,
          })
          .returning();

        this.invalidateCache(channelId);
        return {
          id: created.id,
          channelId: created.channelId,
          roleId: created.roleId ?? undefined,
          allow: created.allow ?? [],
          deny: created.deny ?? [],
        };
      }
    } catch (error) {
      logger.error('Failed to set role permission:', error);
      return null;
    }
  }

  /**
   * Définir une override de permission pour un utilisateur
   */
  async setUserPermission(
    channelId: string,
    userId: string,
    allow: string[],
    deny: string[]
  ): Promise<ChannelPermissionOverride | null> {
    try {
      // Vérifier si une override existe déjà
      const existing = await db
        .select()
        .from(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.userId, userId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Mettre à jour l'override existante
        const [updated] = await db
          .update(channelPermissions)
          .set({ allow, deny })
          .where(eq(channelPermissions.id, existing[0].id))
          .returning();

        this.invalidateCache(channelId);
        return {
          id: updated.id,
          channelId: updated.channelId,
          userId: updated.userId ?? undefined,
          allow: updated.allow ?? [],
          deny: updated.deny ?? [],
        };
      } else {
        // Créer une nouvelle override
        const [created] = await db
          .insert(channelPermissions)
          .values({
            channelId,
            userId,
            allow,
            deny,
          })
          .returning();

        this.invalidateCache(channelId);
        return {
          id: created.id,
          channelId: created.channelId,
          userId: created.userId ?? undefined,
          allow: created.allow ?? [],
          deny: created.deny ?? [],
        };
      }
    } catch (error) {
      logger.error('Failed to set user permission:', error);
      return null;
    }
  }

  /**
   * Supprimer une override de permission (rôle)
   */
  async removeRolePermission(channelId: string, roleId: number): Promise<boolean> {
    try {
      await db
        .delete(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.roleId, roleId)
          )
        );

      this.invalidateCache(channelId);
      return true;
    } catch (error) {
      logger.error('Failed to remove role permission:', error);
      return false;
    }
  }

  /**
   * Supprimer une override de permission (utilisateur)
   */
  async removeUserPermission(channelId: string, userId: string): Promise<boolean> {
    try {
      await db
        .delete(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.userId, userId)
          )
        );

      this.invalidateCache(channelId);
      return true;
    } catch (error) {
      logger.error('Failed to remove user permission:', error);
      return false;
    }
  }

  /**
   * Vérifier si un utilisateur a une permission spécifique sur un canal
   * Prend en compte les overrides de canal et l'héritage des permissions serveur
   */
  async hasChannelPermission(
    userId: string,
    channelId: string,
    permission: string
  ): Promise<boolean> {
    try {
      // Récupérer le canal et le serveur
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) return false;

      const serverId = channel.serverId;

      // Vérifier si l'utilisateur est le propriétaire du serveur
      const [server] = await db
        .select({ ownerId: channels })
        .from(channels)
        .innerJoin(
          require.resolve('../db/schema').then(m => m.servers),
          eq(channels.serverId, require.resolve('../db/schema').then(m => m.servers).then(m => m.id))
        )
        .where(eq(channels.id, channelId))
        .limit(1);

      // D'abord, vérifier les overrides au niveau utilisateur
      const userOverride = await db
        .select()
        .from(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.userId, userId)
          )
        )
        .limit(1);

      if (userOverride.length > 0) {
        const denyList = userOverride[0].deny ?? [];
        const allowList = userOverride[0].allow ?? [];

        // Si la permission est explicitement refusée
        if (denyList.includes(permission)) {
          return false;
        }
        // Si la permission est explicitement accordée
        if (allowList.includes(permission)) {
          return true;
        }
      }

      // Récupérer le rôle de l'utilisateur sur le serveur
      const [member] = await db
        .select()
        .from(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            eq(serverMembers.userId, userId)
          )
        )
        .limit(1);

      if (!member) return false;

      // Vérifier les overrides au niveau du rôle
      const roleResult = await db
        .select()
        .from(roles)
        .where(
          and(
            eq(roles.serverId, serverId),
            eq(roles.name, member.role)
          )
        )
        .limit(1);

      if (!roleResult) return false;

      const roleId = roleResult[0].id;

      const roleOverride = await db
        .select()
        .from(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.roleId, roleId)
          )
        )
        .limit(1);

      if (roleOverride.length > 0) {
        const denyList = roleOverride[0].deny ?? [];
        const allowList = roleOverride[0].allow ?? [];

        // Si la permission est explicitement refusée
        if (denyList.includes(permission)) {
          return false;
        }
        // Si la permission est explicitement accordée
        if (allowList.includes(permission)) {
          return true;
        }
      }

      // Héritage des permissions du serveur
      const serverPermissions = roleResult[0].permissions ?? [];
      
      // Admin a toutes les permissions
      if (serverPermissions.includes('admin')) {
        return true;
      }

      return serverPermissions.includes(permission);
    } catch (error) {
      logger.error('Failed to check channel permission:', error);
      return false;
    }
  }

  /**
   * Obtenir les permissions effectives d'un utilisateur sur un canal
   */
  async getEffectiveChannelPermissions(
    userId: string,
    channelId: string
  ): Promise<string[]> {
    try {
      // Récupérer le canal et le serveur
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) return [];

      const serverId = channel.serverId;

      // Vérifier le cache
      const cacheKey = `${userId}:${channelId}`;
      const cached = permissionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.permissions;
      }

      // Récupérer le rôle de l'utilisateur
      const [member] = await db
        .select()
        .from(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            eq(serverMembers.userId, userId)
          )
        )
        .limit(1);

      if (!member) return [];

      // Obtenir les permissions du rôle serveur
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

      if (!role) return [];

      let effectivePermissions = role.permissions ?? [];

      // Admin a toutes les permissions
      if (effectivePermissions.includes('admin')) {
        effectivePermissions = [
          'admin', 'manage_channels', 'manage_roles', 'kick_members', 
          'ban_members', 'mute_members', 'manage_messages', 
          'view_audit_log', 'manage_server'
        ];
      }

      // Appliquer les overrides de rôle
      const roleOverrides = await db
        .select()
        .from(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.roleId, role.id)
          )
        )
        .limit(1);

      if (roleOverrides.length > 0) {
        const denyList = roleOverrides[0].deny ?? [];
        const allowList = roleOverrides[0].allow ?? [];

        // Retirer les permissions refusées
        effectivePermissions = effectivePermissions.filter(p => !denyList.includes(p));
        
        // Ajouter les permissions accordées
        for (const p of allowList) {
          if (!effectivePermissions.includes(p)) {
            effectivePermissions.push(p);
          }
        }
      }

      // Appliquer les overrides d'utilisateur (priorité plus élevée)
      const userOverrides = await db
        .select()
        .from(channelPermissions)
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.userId, userId)
          )
        )
        .limit(1);

      if (userOverrides.length > 0) {
        const denyList = userOverrides[0].deny ?? [];
        const allowList = userOverrides[0].allow ?? [];

        // Retirer les permissions refusées
        effectivePermissions = effectivePermissions.filter(p => !denyList.includes(p));
        
        // Ajouter les permissions accordées
        for (const p of allowList) {
          if (!effectivePermissions.includes(p)) {
            effectivePermissions.push(p);
          }
        }
      }

      // Mettre en cache
      permissionCache.set(cacheKey, {
        permissions: effectivePermissions,
        timestamp: Date.now(),
      });

      return effectivePermissions;
    } catch (error) {
      logger.error('Failed to get effective channel permissions:', error);
      return [];
    }
  }

  /**
   * Héritage des permissions serveur pour un utilisateur
   */
  async inheritFromServer(userId: string, serverId: string): Promise<string[]> {
    try {
      // Vérifier si l'utilisateur est le propriétaire du serveur
      const [server] = await db
        .select({ ownerId: channels })
        .from(channels)
        .innerJoin(
          require('drizzle-orm').then(() => import('../db/schema')).then(m => m.servers),
          eq(channels.serverId, require('../db/schema').servers.id)
        )
        .where(eq(channels.serverId, serverId))
        .limit(1);

      if (server?.ownerId === userId) {
        return [
          'admin', 'manage_channels', 'manage_roles', 'kick_members', 
          'ban_members', 'mute_members', 'manage_messages', 
          'view_audit_log', 'manage_server'
        ];
      }

      // Obtenir le rôle de l'utilisateur
      const [member] = await db
        .select()
        .from(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            eq(serverMembers.userId, userId)
          )
        )
        .limit(1);

      if (!member) return [];

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

      return role?.permissions ?? [];
    } catch (error) {
      logger.error('Failed to inherit from server:', error);
      return [];
    }
  }

  /**
   * Invalider le cache des permissions pour un canal
   */
  private invalidateCache(channelId: string): void {
    const keysToDelete: string[] = [];
    for (const [key] of permissionCache) {
      if (key.endsWith(`:${channelId}`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => permissionCache.delete(key));
  }
}

// Export singleton
export const permissionsService = new PermissionsService();
