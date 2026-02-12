import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../db';
import { fileAttachments } from '../db/schema';
import { authMiddleware, JWTPayload } from '../middleware/auth';
import { fileStorageService, MAX_UPLOAD_SIZE, ALLOWED_MIME_TYPES } from '../services/fileStorage';
import { logger } from '../utils/logger';
import { eq } from 'drizzle-orm';
import path from 'path';

const router = Router();

// Configure multer for memory storage (we'll save to disk ourselves)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

// Optional auth middleware - continues even if no token
const optionalAuth = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  // Import verifyToken dynamically to avoid circular dependency
  const { verifyToken } = require('../middleware/auth');
  const payload = verifyToken(token);
  
  if (payload) {
    req.user = payload;
  }
  
  next();
};

// Upload a file
router.post('/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const user = req.user as JWTPayload | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate file
    const validation = fileStorageService.validateFile(req.file);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Save file to storage
    const savedFile = await fileStorageService.saveFile(req.file);

    // Create database record
    const [attachment] = await db.insert(fileAttachments).values({
      uploaderId: user.userId,
      filename: savedFile.filename,
      originalName: savedFile.originalName,
      mimeType: savedFile.mimeType,
      size: savedFile.size,
      type: 'upload',
      url: savedFile.url,
      thumbnailPath: savedFile.thumbnailPath,
    }).returning();

    logger.info(`File uploaded by user ${user.userId}: ${savedFile.filename}`);

    res.status(201).json({
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      thumbnailUrl: savedFile.thumbnailUrl,
      type: attachment.type,
      createdAt: attachment.createdAt,
    });
  } catch (error) {
    logger.error('File upload error:', error);
    if (error instanceof Error && error.message.includes('File type')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get file info
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [attachment] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id)).limit(1);

    if (!attachment) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      type: attachment.type,
      magnetUri: attachment.magnetUri,
      createdAt: attachment.createdAt,
    });
  } catch (error) {
    logger.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to get file' });
  }
});

// Download file
router.get('/:id/download', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [attachment] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id)).limit(1);

    if (!attachment) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (attachment.type !== 'upload' || !attachment.url) {
      return res.status(400).json({ error: 'File is not available for direct download' });
    }

    const filename = attachment.filename;
    if (!fileStorageService.fileExists(filename)) {
      return res.status(404).json({ error: 'File not found on storage' });
    }

    const filePath = fileStorageService.getFilePath(filename);
    const mimeType = attachment.mimeType;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader('Content-Length', attachment.size.toString());

    // Stream the file
    const fileStream = fileStorageService.getFileStream(filename);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' });
      }
    });
  } catch (error) {
    logger.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Get thumbnail
router.get('/:id/thumbnail', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [attachment] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id)).limit(1);

    if (!attachment) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (!attachment.thumbnailPath) {
      return res.status(404).json({ error: 'Thumbnail not available' });
    }

    const thumbnailFilename = path.basename(attachment.thumbnailPath);
    
    try {
      const thumbnailStream = fileStorageService.getThumbnailStream(thumbnailFilename);
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      thumbnailStream.pipe(res);
    } catch {
      res.status(404).json({ error: 'Thumbnail not found' });
    }
  } catch (error) {
    logger.error('Get thumbnail error:', error);
    res.status(500).json({ error: 'Failed to get thumbnail' });
  }
});

// Create torrent for large file (placeholder - would need WebTorrent server-side)
router.post('/torrent', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user as JWTPayload | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { filename, originalName, size, magnetUri } = req.body;

    if (!magnetUri || !originalName || !size) {
      return res.status(400).json({ error: 'Missing required fields: magnetUri, originalName, size' });
    }

    // Create database record for torrent
    const [attachment] = await db.insert(fileAttachments).values({
      uploaderId: user.userId,
      filename: filename || `torrent_${Date.now()}`,
      originalName,
      mimeType: 'application/x-bittorrent',
      size,
      type: 'torrent',
      magnetUri,
    }).returning();

    logger.info(`Torrent created by user ${user.userId}: ${originalName}`);

    res.status(201).json({
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      size: attachment.size,
      type: attachment.type,
      magnetUri: attachment.magnetUri,
      createdAt: attachment.createdAt,
    });
  } catch (error) {
    logger.error('Create torrent error:', error);
    res.status(500).json({ error: 'Failed to create torrent' });
  }
});

// Delete file
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as JWTPayload | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [attachment] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id)).limit(1);

    if (!attachment) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user is the uploader
    if (attachment.uploaderId !== user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }

    // Delete file from storage if it's an upload
    if (attachment.type === 'upload' && attachment.filename) {
      try {
        await fileStorageService.deleteFile(attachment.filename);
      } catch (error) {
        logger.warn(`Failed to delete file from storage: ${attachment.filename}`, error);
      }
    }

    // Delete database record
    await db.delete(fileAttachments).where(eq(fileAttachments.id, id));

    logger.info(`File deleted by user ${user.userId}: ${attachment.filename}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Get upload limits and allowed types
router.get('/config/info', (_req: Request, res: Response) => {
  res.json({
    maxUploadSize: MAX_UPLOAD_SIZE,
    maxUploadSizeFormatted: fileStorageService.formatFileSize(MAX_UPLOAD_SIZE),
    allowedMimeTypes: ALLOWED_MIME_TYPES,
  });
});

export default router;
