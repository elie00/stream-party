import rateLimit from 'express-rate-limit';

/**
 * Global API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Room creation rate limiter
 * 10 rooms per hour per IP to prevent abuse
 */
export const createRoomLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: { error: 'Room creation limit reached, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Auth rate limiter
 * 20 auth attempts per 15 minutes to prevent brute-force
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many authentication attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});
