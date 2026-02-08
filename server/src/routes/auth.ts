import { Router } from 'express';
import { guestAuthSchema } from '@stream-party/shared';
import { db, schema } from '../db/index';
import { createGuestToken } from '../middleware/auth';

const router = Router();

router.post('/guest', async (req, res) => {
  try {
    const result = guestAuthSchema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ error: 'Invalid request', details: result.error.errors });
      return;
    }

    const { displayName } = result.data;

    // Create guest user in database
    const [user] = await db
      .insert(schema.users)
      .values({
        displayName,
        isGuest: true,
      })
      .returning();

    // Generate JWT token
    const token = createGuestToken(user.id, user.displayName);

    res.json({
      token,
      user: {
        id: user.id,
        displayName: user.displayName,
        isGuest: user.isGuest,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Error creating guest user:', error);
    res.status(500).json({ error: 'Failed to create guest user' });
  }
});

export default router;
