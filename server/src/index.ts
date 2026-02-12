import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import addonRoutes from './routes/addons';
import { createSocketServer } from './socket/index';
import { apiLimiter } from './middleware/rateLimiter';
import { mediasoupService } from './services/mediasoup';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Needed for Video.js
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      mediaSrc: ["'self'", "blob:", "data:"], // For WebTorrent streaming
      connectSrc: [
        "'self'",
        "wss:", // WebSocket connections
        "https:", // HTTPS API calls
        "blob:", // Blob URLs
        "data:", // Data URLs
      ],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Needed for media streaming
  crossOriginResourcePolicy: { policy: "cross-origin" }, // For CORS media
}));

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' })); // Limit JSON payload size

// Apply global rate limiter to all API routes
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/addons', addonRoutes);

// Create HTTP server
const httpServer = createServer(app);

// Attach Socket.IO
const io = createSocketServer(httpServer);

// Initialize mediasoup SFU
async function startServer() {
  try {
    // Initialize mediasoup workers
    await mediasoupService.initialize();
    mediasoupService.setSocketServer(io);

    // Start server
    httpServer.listen(PORT, () => {
      logger.info(`StreamParty server running on port ${PORT}`);
      logger.info(`Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error instanceof Error ? error.message : 'Unknown error' });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await mediasoupService.close();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await mediasoupService.close();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();
