import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';

// Validate JWT secret is set in production
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '7d';
const JWT_REFRESH_THRESHOLD = 24 * 60 * 60; // 24 hours in seconds

// Validate secret at startup
if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters for security');
}

export interface JWTPayload {
  userId: string;
  displayName: string;
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function createGuestToken(userId: string, displayName: string): string {
  const payload = { userId, displayName };
  return jwt.sign(payload, JWT_SECRET!, { 
    expiresIn: JWT_EXPIRY,
    issuer: 'streamparty',
    audience: 'streamparty-client',
  });
}

/**
 * Verify token and optionally refresh if it's close to expiry
 * Returns the payload or null if invalid
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET!, {
      issuer: 'streamparty',
      audience: 'streamparty-client',
    }) as JWTPayload;
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Check if token should be refreshed (issued more than 24h ago)
 */
export function shouldRefreshToken(payload: JWTPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  const tokenAge = now - payload.iat;
  return tokenAge > JWT_REFRESH_THRESHOLD;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  // Check token length to prevent DoS with huge tokens
  if (token.length > 2048) {
    res.status(401).json({ error: 'Token too long' });
    return;
  }

  const payload = verifyToken(token);
  
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = payload;
  
  // Add refresh token header if token is old
  if (shouldRefreshToken(payload)) {
    const newToken = createGuestToken(payload.userId, payload.displayName);
    res.setHeader('X-New-Token', newToken);
  }
  
  next();
}

export function extractSocketUser(socket: Socket): JWTPayload | null {
  const token = socket.handshake.auth.token;

  if (!token) {
    return null;
  }

  // Check token length
  if (typeof token !== 'string' || token.length > 2048) {
    return null;
  }

  return verifyToken(token);
}
