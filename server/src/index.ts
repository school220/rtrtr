import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { createApiRouter } from './routes/api.routes.js';
import { importRouter } from './routes/import.routes.js';
import { setupSocketHandlers } from './socket/socket.handler.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';

const app = express();
const server = http.createServer(app);

// Real-time Socket.IO setup
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 10000,
  pingInterval: 5000,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Endpoints
app.use('/api', createApiRouter(io));
app.use('/api/import', importRouter);

// Enable reverse proxy trust (Render sits behind SSL reverse proxies)
app.set('trust proxy', 1);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend build in production if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateDistPaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../client/dist'),
];
const clientDist = candidateDistPaths.find((p) => fs.existsSync(p));

if (clientDist) {
  console.log(`📦 Serving static client build from: ${clientDist}`);
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.resolve(clientDist, 'index.html'));
  });
} else {
  console.log('⚠️ Static client build not found (running in API-only or dev mode).');
}

// Register real-time handlers
setupSocketHandlers(io);

// Auto-start server if not imported by test runner
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      console.log('🚀 Checking database and migrations...');
      await runMigrations();
      await seedDatabase();

      server.listen(config.port, config.host, () => {
        console.log(`\n======================================================`);
        console.log(`🎓 Classroom Testing System Backend running:`);
        console.log(`📡 URL: http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
        console.log(`⏱️ Default test duration: ${config.testDurationSeconds} seconds (${config.testDurationSeconds / 60} mins)`);
        console.log(`👥 Max capacity per game: ${config.maxStudentsPerGame} students`);
        console.log(`======================================================\n`);
      });
    } catch (err) {
      console.error('❌ Server startup error:', err);
      process.exit(1);
    }
  })();
}

export { app, server, io };
