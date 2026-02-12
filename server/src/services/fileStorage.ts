import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { logger } from '../utils/logger';

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails');
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
];

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

export interface UploadedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

class FileStorageService {
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Create upload directories if they don't exist
    const dirs = [UPLOAD_DIR, THUMBNAIL_DIR];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }

    this.initialized = true;
    logger.info('File storage service initialized');
  }

  validateFile(file: Express.Multer.File): FileValidationResult {
    // Check file size
    if (file.size > MAX_UPLOAD_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${MAX_UPLOAD_SIZE / 1024 / 1024}MB`,
      };
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type ${file.mimetype} is not allowed`,
      };
    }

    return { valid: true };
  }

  async saveFile(file: Express.Multer.File): Promise<UploadedFile> {
    await this.init();

    const ext = path.extname(file.originalname);
    const filename = `${nanoid(16)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Write file to disk
    await fs.promises.writeFile(filePath, file.buffer);

    const result: UploadedFile = {
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: filePath,
      url: `/uploads/${filename}`,
    };

    // Generate thumbnail for images and videos
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
      try {
        const thumbnail = await this.generateImageThumbnail(filePath, filename);
        result.thumbnailPath = thumbnail.path;
        result.thumbnailUrl = thumbnail.url;
      } catch (error) {
        logger.warn(`Failed to generate thumbnail for ${filename}:`, { error: error instanceof Error ? error.message : String(error) });
      }
    }

    logger.info(`File saved: ${filename} (${file.size} bytes)`);
    return result;
  }

  private async generateImageThumbnail(
    filePath: string,
    filename: string,
  ): Promise<{ path: string; url: string }> {
    const thumbnailFilename = `thumb_${filename.replace(/\.[^.]+$/, '.webp')}`;
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);

    await sharp(filePath)
      .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    return {
      path: thumbnailPath,
      url: `/uploads/thumbnails/${thumbnailFilename}`,
    };
  }

  async generateVideoThumbnail(videoPath: string, filename: string): Promise<string | null> {
    // Note: For video thumbnails, you would need fluent-ffmpeg
    // This is a placeholder that returns null for now
    // In production, you would use:
    // const ffmpeg = require('fluent-ffmpeg');
    // await new Promise((resolve, reject) => {
    //   ffmpeg(videoPath)
    //     .screenshots({
    //       count: 1,
    //       folder: THUMBNAIL_DIR,
    //       filename: `thumb_${filename}.webp`,
    //       size: '200x200',
    //     })
    //     .on('end', resolve)
    //     .on('error', reject);
    // });
    logger.debug(`Video thumbnail generation skipped for ${filename}`);
    return null;
  }

  async deleteFile(filename: string): Promise<void> {
    const filePath = path.join(UPLOAD_DIR, filename);
    const thumbnailPath = path.join(THUMBNAIL_DIR, `thumb_${filename.replace(/\.[^.]+$/, '.webp')}`);

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info(`Deleted file: ${filename}`);
      }
      if (fs.existsSync(thumbnailPath)) {
        await fs.promises.unlink(thumbnailPath);
        logger.info(`Deleted thumbnail for: ${filename}`);
      }
    } catch (error) {
      logger.error(`Failed to delete file ${filename}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  getFileStream(filename: string): fs.ReadStream {
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    return fs.createReadStream(filePath);
  }

  getThumbnailStream(filename: string): fs.ReadStream {
    const thumbnailPath = path.join(THUMBNAIL_DIR, filename);
    if (!fs.existsSync(thumbnailPath)) {
      throw new Error('Thumbnail not found');
    }
    return fs.createReadStream(thumbnailPath);
  }

  getFilePath(filename: string): string {
    return path.join(UPLOAD_DIR, filename);
  }

  getThumbnailPath(filename: string): string {
    return path.join(THUMBNAIL_DIR, filename);
  }

  fileExists(filename: string): boolean {
    return fs.existsSync(path.join(UPLOAD_DIR, filename));
  }

  getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  isImage(mimeType: string): boolean {
    return IMAGE_MIME_TYPES.includes(mimeType);
  }

  isVideo(mimeType: string): boolean {
    return VIDEO_MIME_TYPES.includes(mimeType);
  }

  isPreviewable(mimeType: string): boolean {
    return this.isImage(mimeType) || this.isVideo(mimeType) || mimeType === 'application/pdf';
  }

  // Clean up files older than specified days
  async cleanupOldFiles(daysOld: number = 30): Promise<number> {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const files = await fs.promises.readdir(UPLOAD_DIR);
      
      for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.isFile() && stats.mtimeMs < cutoffTime) {
          await this.deleteFile(file);
          deletedCount++;
        }
      }

      logger.info(`Cleaned up ${deletedCount} old files`);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old files:', { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }
}

export const fileStorageService = new FileStorageService();
export { MAX_UPLOAD_SIZE, ALLOWED_MIME_TYPES, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES };
