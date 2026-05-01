import { Router } from 'express';
import { redis } from '../lib/redis.js';
import { nanoid } from 'nanoid';

export const pokerRoutes = Router();

const POKER_TTL = 60 * 60 * 4; // 4h

// Create poker room
pokerRoutes.post('/rooms', async (req, res) => {
  const { name, sessionId } = req.body;
  if (!name || !sessionId) {
    return res.status(400).json({ error: 'name and sessionId are required' });
  }

  const roomId = nanoid(10);
  const roomKey = `poker:${roomId}`;

  await redis.hset(roomKey, {
    name,
    ownerId: sessionId,
    status: 'waiting',
    currentRound: '0',
  });
  await redis.expire(roomKey, POKER_TTL);

  res.status(201).json({ roomId, name });
});

// Get room info (for initial load)
pokerRoutes.get('/rooms/:roomId', async (req, res) => {
  const roomKey = `poker:${req.params.roomId}`;
  const room = await redis.hgetall(roomKey);
  if (!room || !room.name) {
    return res.status(404).json({ error: 'Room not found or expired' });
  }

  const participantsRaw = await redis.hgetall(`${roomKey}:participants`);
  const participants = Object.entries(participantsRaw).map(([sid, name]) => ({
    sessionId: sid,
    displayName: name,
    hasVoted: false,
  }));

  res.json({
    id: req.params.roomId,
    name: room.name,
    ownerId: room.ownerId,
    status: room.status,
    roundNumber: Number(room.currentRound),
    participants,
  });
});
