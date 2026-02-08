import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { createRoomSchema, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@stream-party/shared';
import { db, schema } from '../db/index';
import { authMiddleware } from '../middleware/auth';
import { eq } from 'drizzle-orm';

const router = Router();
const generateRoomCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);

// All room routes require authentication
router.use(authMiddleware);

router.post('/', async (req, res) => {
  try {
    const result = createRoomSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', details: result.error.errors });
      return;
    }

    const { name } = result.data;
    const userId = req.user!.userId;

    // Generate unique room code
    let code = generateRoomCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existing = await db.query.rooms.findFirst({
        where: eq(schema.rooms.code, code),
      });

      if (!existing) {
        break;
      }

      code = generateRoomCode();
      attempts++;
    }

    if (attempts === maxAttempts) {
      res.status(500).json({ error: 'Failed to generate unique room code' });
      return;
    }

    // Create room
    const [room] = await db
      .insert(schema.rooms)
      .values({
        code,
        name,
        hostId: userId,
        isActive: true,
        maxParticipants: 6,
      })
      .returning();

    res.json({
      id: room.id,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      magnetUri: room.magnetUri,
      selectedFileIndex: room.selectedFileIndex,
      isActive: room.isActive,
      maxParticipants: room.maxParticipants,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const room = await db.query.rooms.findFirst({
      where: eq(schema.rooms.code, code),
    });

    if (!room || !room.isActive) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.json({
      id: room.id,
      code: room.code,
      name: room.name,
      hostId: room.hostId,
      magnetUri: room.magnetUri,
      selectedFileIndex: room.selectedFileIndex,
      isActive: room.isActive,
      maxParticipants: room.maxParticipants,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

export default router;
