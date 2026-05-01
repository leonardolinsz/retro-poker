import { Namespace, Socket } from 'socket.io';
import { redis } from '../lib/redis.js';

const POKER_TTL = 60 * 60 * 4;

export function setupPokerWs(ns: Namespace) {
  ns.on('connection', async (socket) => {
    const roomId = socket.handshake.query.roomId as string;
    if (!roomId) {
      socket.disconnect(true);
      return;
    }

    const roomKey = `poker:${roomId}`;
    const room = await redis.hgetall(roomKey);
    if (!room || !room.name) {
      socket.emit('error', { message: 'Room not found or expired' });
      socket.disconnect(true);
      return;
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    // ── Join ──
    socket.on('poker:join', async (payload: { displayName: string; sessionId: string }) => {
      const { displayName, sessionId } = payload;
      socket.data.sessionId = sessionId;
      socket.data.displayName = displayName;

      await redis.hset(`${roomKey}:participants`, sessionId, displayName);
      await redis.expire(`${roomKey}:participants`, POKER_TTL);

      ns.to(roomId).emit('poker:participant_joined', { sessionId, displayName });

      // Send current room state
      const currentRoom = await redis.hgetall(roomKey);
      const participantsRaw = await redis.hgetall(`${roomKey}:participants`);
      const votesRaw = await redis.hgetall(`${roomKey}:votes`);

      const participants = Object.entries(participantsRaw).map(([sid, name]) => ({
        sessionId: sid,
        displayName: name,
        hasVoted: !!votesRaw[sid],
        vote: currentRoom.status === 'revealed' ? votesRaw[sid] : undefined,
      }));

      socket.emit('poker:state', {
        id: roomId,
        name: currentRoom.name,
        ownerId: currentRoom.ownerId,
        status: currentRoom.status,
        roundNumber: Number(currentRoom.currentRound),
        participants,
      });
    });

    // ── Vote ──
    socket.on('poker:vote', async (payload: { value: number | string }) => {
      const sid = socket.data.sessionId;
      if (!sid) return;

      const status = await redis.hget(roomKey, 'status');
      if (status !== 'voting') return;

      await redis.hset(`${roomKey}:votes`, sid, String(payload.value));
      await redis.expire(`${roomKey}:votes`, POKER_TTL);

      ns.to(roomId).emit('poker:vote_cast', { sessionId: sid });
    });

    // ── Start Round (owner only) ──
    socket.on('poker:start_round', async () => {
      const sid = socket.data.sessionId;
      const ownerId = await redis.hget(roomKey, 'ownerId');
      if (sid !== ownerId) return;

      const round = await redis.hincrby(roomKey, 'currentRound', 1);
      await redis.hset(roomKey, 'status', 'voting');
      await redis.del(`${roomKey}:votes`);

      ns.to(roomId).emit('poker:round_started', { roundNumber: round });
    });

    // ── End Round (owner only) ──
    socket.on('poker:end_round', async () => {
      const sid = socket.data.sessionId;
      const ownerId = await redis.hget(roomKey, 'ownerId');
      if (sid !== ownerId) return;

      await redis.hset(roomKey, 'status', 'revealed');

      const votesRaw = await redis.hgetall(`${roomKey}:votes`);
      const participantsRaw = await redis.hgetall(`${roomKey}:participants`);

      const votes = Object.entries(votesRaw).map(([voteSid, value]) => ({
        sessionId: voteSid,
        displayName: participantsRaw[voteSid] || 'Unknown',
        value: isNaN(Number(value)) ? value : Number(value),
      }));

      ns.to(roomId).emit('poker:round_ended', { votes });
    });

    // ── Reset (owner only) ──
    socket.on('poker:reset', async () => {
      const sid = socket.data.sessionId;
      const ownerId = await redis.hget(roomKey, 'ownerId');
      if (sid !== ownerId) return;

      await redis.hset(roomKey, 'status', 'waiting');
      await redis.del(`${roomKey}:votes`);

      ns.to(roomId).emit('poker:round_started', { roundNumber: 0 });
    });

    socket.on('disconnect', async () => {
      const sid = socket.data.sessionId;
      if (sid) {
        await redis.hdel(`${roomKey}:participants`, sid);
        ns.to(roomId).emit('poker:participant_left', {
          sessionId: sid,
          displayName: socket.data.displayName,
        });
      }
    });
  });
}
