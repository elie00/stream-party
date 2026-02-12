import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import {
  createServerSchema,
  joinServerSchema,
  createChannelSchema,
  SERVER_INVITE_CODE_ALPHABET,
  SERVER_INVITE_CODE_LENGTH,
} from '@stream-party/shared';
import { db, schema } from '../db/index';
import { authMiddleware } from '../middleware/auth';
import { createRoomLimiter } from '../middleware/rateLimiter';
import { eq, and } from 'drizzle-orm';

const router = Router();
const generateInviteCode = customAlphabet(SERVER_INVITE_CODE_ALPHABET, SERVER_INVITE_CODE_LENGTH);

// All server routes require authentication
router.use(authMiddleware);

/**
 * GET /api/servers - List all servers the user is a member of
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Get all server memberships for the user
    const memberships = await db.query.serverMembers.findMany({
      where: eq(schema.serverMembers.userId, userId),
      with: {
        server: {
          with: {
            channels: true,
            members: {
              with: {
                user: {
                  columns: {
                    displayName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const servers = memberships.map((m) => ({
      id: m.server.id,
      name: m.server.name,
      icon: m.server.icon,
      description: m.server.description,
      ownerId: m.server.ownerId,
      inviteCode: m.server.inviteCode,
      createdAt: m.server.createdAt,
      channels: m.server.channels,
      members: m.server.members,
    }));

    res.json({ servers });
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

/**
 * POST /api/servers - Create a new server
 */
router.post('/', createRoomLimiter, async (req, res) => {
  try {
    const result = createServerSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', details: result.error.errors });
      return;
    }

    const { name, icon, description } = result.data;
    const userId = req.user!.userId;

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existing = await db.query.servers.findFirst({
        where: eq(schema.servers.inviteCode, inviteCode),
      });

      if (!existing) {
        break;
      }

      inviteCode = generateInviteCode();
      attempts++;
    }

    if (attempts === maxAttempts) {
      res.status(500).json({ error: 'Failed to generate unique invite code' });
      return;
    }

    // Create server and add owner as member in a transaction
    const [server] = await db.transaction(async (tx) => {
      // Create server
      const [newServer] = await tx
        .insert(schema.servers)
        .values({
          name,
          icon: icon || null,
          description: description || null,
          ownerId: userId,
          inviteCode,
        })
        .returning();

      // Add owner as member with 'owner' role
      await tx.insert(schema.serverMembers).values({
        serverId: newServer.id,
        userId,
        role: 'owner',
      });

      // Create default channels
      await tx.insert(schema.channels).values([
        {
          serverId: newServer.id,
          name: 'général',
          type: 'text',
          position: 0,
        },
        {
          serverId: newServer.id,
          name: 'Général',
          type: 'voice',
          position: 0,
        },
      ]);

      return [newServer];
    });

    // Fetch the complete server with channels and members
    const completeServer = await db.query.servers.findFirst({
      where: eq(schema.servers.id, server.id),
      with: {
        channels: true,
        members: {
          with: {
            user: {
              columns: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ server: completeServer });
  } catch (error) {
    console.error('Error creating server:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

/**
 * GET /api/servers/:id - Get server details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if user is a member
    const membership = await db.query.serverMembers.findFirst({
      where: and(eq(schema.serverMembers.serverId, id), eq(schema.serverMembers.userId, userId)),
    });

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this server' });
      return;
    }

    const server = await db.query.servers.findFirst({
      where: eq(schema.servers.id, id),
      with: {
        channels: true,
        members: {
          with: {
            user: {
              columns: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    res.json({ server });
  } catch (error) {
    console.error('Error fetching server:', error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

/**
 * POST /api/servers/join - Join a server using invite code
 */
router.post('/join', createRoomLimiter, async (req, res) => {
  try {
    const result = joinServerSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', details: result.error.errors });
      return;
    }

    const { inviteCode } = result.data;
    const userId = req.user!.userId;

    // Find server by invite code
    const server = await db.query.servers.findFirst({
      where: eq(schema.servers.inviteCode, inviteCode),
    });

    if (!server) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    // Check if already a member
    const existingMembership = await db.query.serverMembers.findFirst({
      where: and(eq(schema.serverMembers.serverId, server.id), eq(schema.serverMembers.userId, userId)),
    });

    if (existingMembership) {
      res.status(400).json({ error: 'You are already a member of this server' });
      return;
    }

    // Add user as member
    await db.insert(schema.serverMembers).values({
      serverId: server.id,
      userId,
      role: 'member',
    });

    // Fetch complete server details
    const completeServer = await db.query.servers.findFirst({
      where: eq(schema.servers.id, server.id),
      with: {
        channels: true,
        members: {
          with: {
            user: {
              columns: {
                displayName: true,
              },
            },
          },
        },
      },
    });

    res.json({ server: completeServer });
  } catch (error) {
    console.error('Error joining server:', error);
    res.status(500).json({ error: 'Failed to join server' });
  }
});

/**
 * DELETE /api/servers/:id/leave - Leave a server
 */
router.delete('/:id/leave', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if user is a member
    const membership = await db.query.serverMembers.findFirst({
      where: and(eq(schema.serverMembers.serverId, id), eq(schema.serverMembers.userId, userId)),
    });

    if (!membership) {
      res.status(400).json({ error: 'You are not a member of this server' });
      return;
    }

    // Check if user is the owner
    const server = await db.query.servers.findFirst({
      where: eq(schema.servers.id, id),
    });

    if (server?.ownerId === userId) {
      res.status(400).json({ error: 'Owner cannot leave the server. Transfer ownership or delete the server instead.' });
      return;
    }

    // Remove member
    await db.delete(schema.serverMembers).where(eq(schema.serverMembers.id, membership.id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving server:', error);
    res.status(500).json({ error: 'Failed to leave server' });
  }
});

/**
 * DELETE /api/servers/:id - Delete a server (owner only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if user is the owner
    const server = await db.query.servers.findFirst({
      where: eq(schema.servers.id, id),
    });

    if (!server) {
      res.status(404).json({ error: 'Server not found' });
      return;
    }

    if (server.ownerId !== userId) {
      res.status(403).json({ error: 'Only the owner can delete the server' });
      return;
    }

    // Delete server (cascade will delete members and channels)
    await db.delete(schema.servers).where(eq(schema.servers.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting server:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

/**
 * POST /api/servers/:id/channels - Create a new channel
 */
router.post('/:id/channels', createRoomLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const result = createChannelSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', details: result.error.errors });
      return;
    }

    const { name, type, topic } = result.data;
    const userId = req.user!.userId;

    // Check if user is a member with appropriate permissions
    const membership = await db.query.serverMembers.findFirst({
      where: and(eq(schema.serverMembers.serverId, id), eq(schema.serverMembers.userId, userId)),
    });

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this server' });
      return;
    }

    // Only owner, admin, or moderator can create channels
    if (!['owner', 'admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'You do not have permission to create channels' });
      return;
    }

    // Get max position for channels in this server
    const channels = await db.query.channels.findMany({
      where: eq(schema.channels.serverId, id),
    });
    const maxPosition = channels.reduce((max, ch) => Math.max(max, ch.position), -1);

    // Create channel
    const [channel] = await db
      .insert(schema.channels)
      .values({
        serverId: id,
        name,
        type,
        topic: topic || null,
        position: maxPosition + 1,
      })
      .returning();

    res.status(201).json({ channel });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

/**
 * DELETE /api/servers/:id/channels/:channelId - Delete a channel
 */
router.delete('/:id/channels/:channelId', async (req, res) => {
  try {
    const { id, channelId } = req.params;
    const userId = req.user!.userId;

    // Check if user is a member with appropriate permissions
    const membership = await db.query.serverMembers.findFirst({
      where: and(eq(schema.serverMembers.serverId, id), eq(schema.serverMembers.userId, userId)),
    });

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this server' });
      return;
    }

    // Only owner, admin, or moderator can delete channels
    if (!['owner', 'admin', 'moderator'].includes(membership.role)) {
      res.status(403).json({ error: 'You do not have permission to delete channels' });
      return;
    }

    // Check if this is the last text channel
    const channels = await db.query.channels.findMany({
      where: eq(schema.channels.serverId, id),
    });

    const channelToDelete = channels.find((ch) => ch.id === channelId);
    if (!channelToDelete) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const textChannels = channels.filter((ch) => ch.type === 'text');
    if (channelToDelete.type === 'text' && textChannels.length === 1) {
      res.status(400).json({ error: 'Cannot delete the last text channel' });
      return;
    }

    // Delete channel
    await db.delete(schema.channels).where(eq(schema.channels.id, channelId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

/**
 * PATCH /api/servers/:id - Update server settings (owner/admin only)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if user has permission
    const membership = await db.query.serverMembers.findFirst({
      where: and(eq(schema.serverMembers.serverId, id), eq(schema.serverMembers.userId, userId)),
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ error: 'You do not have permission to update this server' });
      return;
    }

    const { name, icon, description } = req.body;

    // Build update object
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (description !== undefined) updates.description = description;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' });
      return;
    }

    // Update server
    const [updatedServer] = await db
      .update(schema.servers)
      .set(updates)
      .where(eq(schema.servers.id, id))
      .returning();

    res.json({ server: updatedServer });
  } catch (error) {
    console.error('Error updating server:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

export default router;
