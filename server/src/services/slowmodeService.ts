/**
 * Slowmode Service
 * Gère le slowmode par canal
 */
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { channels, serverMembers, roles } from '../db/schema';
import { logger } from '../utils/logger';

// Cooldowns des utilisateurs pour le slowmode
const slowmodeCooldowns = new Map<string, number>();

// Options de slowmode disponibles (en secondes)
export const SLOWMODE_OPTIONS = [
  { value: 0, label: 'Désactivé' },
  { value: 5, label: '5 secondes' },
  { value: 10, label: '10 secondes' },
  { value: 30, label: '30 secondes' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
];

/**
 * SlowmodeService - Gestion du slowmode par canal
 */
class SlowmodeService {
  /**
   * Récupérer les paramètres slowmode d'un canal
   */
  async getSlowmode(channelId: string): Promise<{ slowmode: number; slowmodeRoles: string[] }> {
    try {
      const [channel] = await db
        .select({
          slowmode: channels.slowmode,
          slowmodeRoles: channels.slowmodeRoles,
        })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return { slowmode: 0, slowmodeRoles: [] };
      }

      return {
        slowmode: channel.slowmode ?? 0,
        slowmodeRoles: channel.slowmodeRoles ?? [],
      };
    } catch (error) {
      logger.error('Failed to get slowmode:', error);
      return { slowmode: 0, slowmodeRoles: [] };
    }
  }

  /**
   * Définir le slowmode d'un canal
   */
  async setSlowmode(
    channelId: string,
    slowmode: number,
    slowmodeRoles: string[] = []
  ): Promise<boolean> {
    try {
      // Valider la valeur
      const validSlowmode = Math.max(0, Math.min(900, slowmode));

      await db
        .update(channels)
        .set({
          slowmode: validSlowmode,
          slowmodeRoles,
        })
        .where(eq(channels.id, channelId));

      // Nettoyer les cooldowns si le slowmode est désactivé
      if (validSlowmode === 0) {
        this.clearCooldowns(channelId);
      }

      return true;
    } catch (error) {
      logger.error('Failed to set slowmode:', error);
      return false;
    }
  }

  /**
   * Vérifier si un utilisateur peut envoyer un message (respecte le slowmode)
   */
  async checkSlowmode(userId: string, channelId: string): Promise<boolean> {
    try {
      // Récupérer les paramètres slowmode du canal
      const { slowmode, slowmodeRoles } = await this.getSlowmode(channelId);

      // Si slowmode désactivé, autoriser
      if (slowmode === 0) {
        return true;
      }

      // Vérifier si l'utilisateur est exempté (rôle)
      const isExempted = await this.isUserExempted(userId, channelId, slowmodeRoles);
      if (isExempted) {
        return true;
      }

      // Vérifier le cooldown
      const key = `${userId}:${channelId}`;
      const lastMessageTime = slowmodeCooldowns.get(key);

      if (!lastMessageTime) {
        return true;
      }

      const now = Date.now();
      const cooldownEnd = lastMessageTime + (slowmode * 1000);

      return now >= cooldownEnd;
    } catch (error) {
      logger.error('Failed to check slowmode:', error);
      return true; // En cas d'erreur, autoriser
    }
  }

  /**
   * Obtenir le temps restant avant le prochain message (en secondes)
   */
  async getSlowmodeCooldown(userId: string, channelId: string): Promise<number> {
    try {
      // Récupérer les paramètres slowmode du canal
      const { slowmode, slowmodeRoles } = await this.getSlowmode(channelId);

      // Si slowmode désactivé, pas de cooldown
      if (slowmode === 0) {
        return 0;
      }

      // Vérifier si l'utilisateur est exempté
      const isExempted = await this.isUserExempted(userId, channelId, slowmodeRoles);
      if (isExempted) {
        return 0;
      }

      // Vérifier le cooldown
      const key = `${userId}:${channelId}`;
      const lastMessageTime = slowmodeCooldowns.get(key);

      if (!lastMessageTime) {
        return 0;
      }

      const now = Date.now();
      const cooldownEnd = lastMessageTime + (slowmode * 1000);
      const remaining = Math.ceil((cooldownEnd - now) / 1000);

      return Math.max(0, remaining);
    } catch (error) {
      logger.error('Failed to get slowmode cooldown:', error);
      return 0;
    }
  }

  /**
   * Enregistrer qu'un utilisateur a envoyé un message
   */
  recordMessage(userId: string, channelId: string): void {
    const key = `${userId}:${channelId}`;
    slowmodeCooldowns.set(key, Date.now());

    // Nettoyer les vieux cooldowns (plus de 15 minutes)
    const cleanup = () => {
      const now = Date.now();
      const maxAge = 15 * 60 * 1000; // 15 minutes
      
      for (const [k, v] of slowmodeCooldowns) {
        if (now - v > maxAge) {
          slowmodeCooldowns.delete(k);
        }
      }
    };

    // Nettoyer de temps en temps
    if (Math.random() < 0.1) { // 10% de chance
      cleanup();
    }
  }

  /**
   * Effacer les cooldowns d'un canal
   */
  clearCooldowns(channelId: string): void {
    const prefix = `:${channelId}`;
    const keysToDelete: string[] = [];
    
    for (const key of slowmodeCooldowns.keys()) {
      if (key.endsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => slowmodeCooldowns.delete(key));
  }

  /**
   * Vérifier si un utilisateur est exempté du slowmode
   */
  private async isUserExempted(
    userId: string,
    channelId: string,
    exemptRoles: string[]
  ): Promise<boolean> {
    if (exemptRoles.length === 0) {
      return false;
    }

    try {
      // Récupérer le canal pour obtenir le serverId
      const [channel] = await db
        .select({ serverId: channels.serverId })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        return false;
      }

      // Récupérer le rôle de l'utilisateur
      const [member] = await db
        .select()
        .from(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, channel.serverId),
            eq(serverMembers.userId, userId)
          )
        )
        .limit(1);

      if (!member) {
        return false;
      }

      // Vérifier si le rôle de l'utilisateur est exempté
      return exemptRoles.includes(member.role);
    } catch (error) {
      logger.error('Failed to check if user is exempted:', error);
      return false;
    }
  }
}

// Export singleton
export const slowmodeService = new SlowmodeService();
