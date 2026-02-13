/**
 * Auto-Mod Service
 * Provides automatic moderation features (spam protection, word filter, link filter)
 */
import { AutoModConfig } from '@stream-party/shared';
import { moderationService } from './moderationService';
import { logger } from '../utils/logger';

// Spam detection window in milliseconds
const SPAM_WINDOW_MS = 10000; // 10 seconds

// Message history for spam detection
interface MessageRecord {
  userId: string;
  channelId: string;
  content: string;
  timestamp: number;
}

// Store recent messages for spam detection
const messageHistory: Map<string, MessageRecord[]> = new Map();

// Rate limit tracking
const userWarnings: Map<string, number> = new Map();

class AutoModService {
  /**
   * Check a message before it's sent
   * Returns whether the message is allowed and what action to take
   */
  async checkMessage(
    serverId: string,
    userId: string,
    channelId: string,
    content: string,
    config: AutoModConfig
  ): Promise<{
    allowed: boolean;
    action?: 'warn' | 'mute' | 'delete';
    reason?: string;
  }> {
    try {
      // Check if user is muted
      const isMuted = await moderationService.isMuted(serverId, userId);
      if (isMuted) {
        return {
          allowed: false,
          action: 'delete',
          reason: 'Vous êtes muet sur ce serveur',
        };
      }

      // Check spam protection
      if (config.enableSpamProtection) {
        const spamResult = this.detectSpam(userId, channelId, content, config.spamThreshold);
        if (spamResult.isSpam) {
          logger.info(`Spam detected from user ${userId} in server ${serverId}`);
          
          // Increment warning count
          const warnings = (userWarnings.get(userId) || 0) + 1;
          userWarnings.set(userId, warnings);

          // Auto-mute after multiple spam detections
          if (warnings >= 3) {
            return {
              allowed: false,
              action: 'mute',
              reason: `Spam détecté (${spamResult.messageCount} messages en ${SPAM_WINDOW_MS / 1000}s)`,
            };
          }

          return {
            allowed: false,
            action: 'warn',
            reason: `Attention: ralentissez vos messages (${spamResult.messageCount} messages en ${SPAM_WINDOW_MS / 1000}s)`,
          };
        }
      }

      // Check word filter
      if (config.enableWordFilter && config.bannedWords.length > 0) {
        const hasBannedWord = this.filterWords(content, config.bannedWords);
        if (hasBannedWord) {
          logger.info(`Banned word detected from user ${userId} in server ${serverId}`);
          return {
            allowed: false,
            action: 'delete',
            reason: 'Votre message contient un mot interdit',
          };
        }
      }

      // Check link filter
      if (config.enableLinkFilter) {
        const hasLink = this.detectLinks(content);
        if (hasLink) {
          logger.info(`Link detected from user ${userId} in server ${serverId}`);
          return {
            allowed: false,
            action: 'delete',
            reason: 'Les liens ne sont pas autorisés sur ce serveur',
          };
        }
      }

      // Record message for spam detection
      this.recordMessage(userId, channelId, content);

      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check message:', error);
      // Allow message on error to avoid blocking legitimate messages
      return { allowed: true };
    }
  }

  /**
   * Detect spam based on message frequency
   */
  detectSpam(
    userId: string,
    channelId: string,
    content: string,
    threshold: number
  ): { isSpam: boolean; messageCount: number } {
    const key = `${userId}:${channelId}`;
    const now = Date.now();
    const windowStart = now - SPAM_WINDOW_MS;

    // Get user's recent messages
    let messages = messageHistory.get(key) || [];

    // Filter to only messages within the window
    messages = messages.filter((m) => m.timestamp > windowStart);

    // Add current message
    messages.push({
      userId,
      channelId,
      content,
      timestamp: now,
    });

    // Update history
    messageHistory.set(key, messages);

    const messageCount = messages.length;
    const isSpam = messageCount > threshold;

    return { isSpam, messageCount };
  }

  /**
   * Check if content contains banned words
   */
  filterWords(content: string, bannedWords: string[]): boolean {
    const lowerContent = content.toLowerCase();

    for (const word of bannedWords) {
      const lowerWord = word.toLowerCase();
      // Check for whole word match
      const regex = new RegExp(`\\b${this.escapeRegex(lowerWord)}\\b`, 'i');
      if (regex.test(lowerContent)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect links in content
   */
  detectLinks(content: string): boolean {
    // URL regex pattern
    const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)/gi;
    return urlPattern.test(content);
  }

  /**
   * Extract links from content
   */
  extractLinks(content: string): string[] {
    const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)/gi;
    const matches = content.match(urlPattern);
    return matches || [];
  }

  /**
   * Record a message for spam detection
   */
  private recordMessage(userId: string, channelId: string, content: string): void {
    const key = `${userId}:${channelId}`;
    const now = Date.now();

    let messages = messageHistory.get(key) || [];
    messages.push({
      userId,
      channelId,
      content,
      timestamp: now,
    });

    // Keep only last 50 messages per user per channel
    if (messages.length > 50) {
      messages = messages.slice(-50);
    }

    messageHistory.set(key, messages);
  }

  /**
   * Clear warning count for a user
   */
  clearWarnings(userId: string): void {
    userWarnings.delete(userId);
  }

  /**
   * Get warning count for a user
   */
  getWarningCount(userId: string): number {
    return userWarnings.get(userId) || 0;
  }

  /**
   * Clean up old message history
   */
  cleanupOldMessages(): number {
    const now = Date.now();
    const cutoff = now - SPAM_WINDOW_MS * 2; // Keep 2x window for safety
    let cleaned = 0;

    for (const [key, messages] of messageHistory.entries()) {
      const filtered = messages.filter((m) => m.timestamp > cutoff);
      if (filtered.length === 0) {
        messageHistory.delete(key);
        cleaned++;
      } else if (filtered.length !== messages.length) {
        messageHistory.set(key, filtered);
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} old message history entries`);
    }

    return cleaned;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check for duplicate content (same message repeated)
   */
  detectDuplicateContent(
    userId: string,
    channelId: string,
    content: string,
    threshold: number = 3
  ): boolean {
    const key = `${userId}:${channelId}`;
    const messages = messageHistory.get(key) || [];

    // Count identical messages
    const identicalCount = messages.filter(
      (m) => m.content.toLowerCase() === content.toLowerCase()
    ).length;

    return identicalCount >= threshold;
  }

  /**
   * Check for caps abuse (too many capital letters)
   */
  detectCapsAbuse(content: string, threshold: number = 0.7): boolean {
    if (content.length < 5) return false; // Ignore short messages

    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return false;

    const capsCount = letters.replace(/[^A-Z]/g, '').length;
    const capsRatio = capsCount / letters.length;

    return capsRatio >= threshold;
  }

  /**
   * Check for mention abuse (too many mentions in one message)
   */
  detectMentionAbuse(content: string, threshold: number = 5): boolean {
    const mentionPattern = /@[\w-]+/g;
    const mentions = content.match(mentionPattern);
    return (mentions?.length || 0) >= threshold;
  }

  /**
   * Get comprehensive message analysis
   */
  analyzeMessage(
    content: string,
    config: AutoModConfig
  ): {
    hasBannedWords: boolean;
    hasLinks: boolean;
    hasCapsAbuse: boolean;
    hasMentionAbuse: boolean;
    bannedWordsFound: string[];
    linksFound: string[];
  } {
    const result = {
      hasBannedWords: false,
      hasLinks: false,
      hasCapsAbuse: false,
      hasMentionAbuse: false,
      bannedWordsFound: [] as string[],
      linksFound: [] as string[],
    };

    // Check banned words
    if (config.enableWordFilter && config.bannedWords.length > 0) {
      const lowerContent = content.toLowerCase();
      for (const word of config.bannedWords) {
        const lowerWord = word.toLowerCase();
        const regex = new RegExp(`\\b${this.escapeRegex(lowerWord)}\\b`, 'i');
        if (regex.test(lowerContent)) {
          result.hasBannedWords = true;
          result.bannedWordsFound.push(word);
        }
      }
    }

    // Check links
    if (config.enableLinkFilter) {
      result.linksFound = this.extractLinks(content);
      result.hasLinks = result.linksFound.length > 0;
    }

    // Check caps abuse
    result.hasCapsAbuse = this.detectCapsAbuse(content);

    // Check mention abuse
    result.hasMentionAbuse = this.detectMentionAbuse(content);

    return result;
  }
}

// Export singleton instance
export const autoModService = new AutoModService();

// Cleanup interval (every 5 minutes)
setInterval(() => {
  autoModService.cleanupOldMessages();
}, 5 * 60 * 1000);
