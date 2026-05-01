import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketIO } from 'socket.io';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { sessionMiddleware, ensureSession } from './middleware/session.js';
import { boardRoutes } from './routes/boards.js';
import { setupRetroWs } from './ws/retro.js';
import { setupPokerWs } from './ws/poker.js';
import { pokerRoutes } from './routes/poker.js';

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

const app = express();
const httpServer = createServer(app);

const io = new SocketIO(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: true },
});

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/me', ensureSession, (req, res) => {
  res.json({ sessionId: (req as any).sessionId });
});

app.use('/api/boards', ensureSession, boardRoutes);
app.use('/api/poker', pokerRoutes);

const retroNs = io.of('/retro');
const pokerNs = io.of('/poker');

setupRetroWs(retroNs);
setupPokerWs(pokerNs);

httpServer.listen(PORT, () => {
  console.log(`[focusscrum] server running on :${PORT}`);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  redis.disconnect();
  httpServer.close();
});
