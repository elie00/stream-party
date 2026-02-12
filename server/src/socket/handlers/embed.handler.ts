import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, MessageEmbed } from '@stream-party/shared';
import { db, schema } from '../../db/index';
import { eq, and } from 'drizzle-orm';
import { getRoomBySocket } from '../roomState';
import { fetchEmbedData, extractUrls, type EmbedData } from '../../services/embedService';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerEmbedHandlers(io: TypedServer, socket: TypedSocket): void {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  // Generate an embed for a URL
  socket.on('embed:generate', async (data: { messageId: string; url: string }) => {
    try {
      const room = getRoomBySocket(socket.id);
      if (!room) return;

      // Check if message exists
      const message = await db.query.messages.findFirst({
        where: eq(schema.messages.id, data.messageId),
        with: {
          embeds: true,
        },
      });

      if (!message) {
        socket.emit('error', 'Message not found');
        return;
      }

      // Check if embed already exists for this URL
      const existingEmbed = await db.query.messageEmbeds.findFirst({
        where: and(
          eq(schema.messageEmbeds.messageId, data.messageId),
          eq(schema.messageEmbeds.url, data.url)
        ),
      });

      if (existingEmbed) {
        // Embed already exists, ignore
        return;
      }

      // Fetch embed data
      const embedData: EmbedData | null = await fetchEmbedData(data.url);

      if (!embedData) {
        // Could not fetch embed data, silently fail
        return;
      }

      // Insert embed
      const [embed] = await db
        .insert(schema.messageEmbeds)
        .values({
          messageId: data.messageId,
          type: embedData.type,
          url: embedData.url,
          title: embedData.title,
          description: embedData.description,
          image: embedData.image,
          siteName: embedData.siteName,
        })
        .returning();

      const messageEmbed: MessageEmbed = {
        id: embed.id,
        messageId: embed.messageId,
        type: embed.type as MessageEmbed['type'],
        url: embed.url,
        title: embed.title || undefined,
        description: embed.description || undefined,
        image: embed.image || undefined,
        siteName: embed.siteName || undefined,
        createdAt: embed.createdAt,
      };

      // Broadcast to room
      io.to(room.code).emit('embed:generated', {
        messageId: data.messageId,
        embed: messageEmbed,
      });
    } catch (error) {
      console.error('Error generating embed:', error);
      socket.emit('error', 'Failed to generate embed');
    }
  });
}
