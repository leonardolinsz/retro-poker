import { Namespace, Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import cookie from 'cookie';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'fs_sid';

function getSessionId(socket: Socket): string | null {
  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  const cookies = cookie.parse(raw);
  return cookies[COOKIE_NAME] || null;
}

export function setupRetroWs(ns: Namespace) {
  ns.on('connection', async (socket) => {
    const sessionId = getSessionId(socket);
    if (!sessionId) {
      socket.disconnect(true);
      return;
    }

    const boardId = socket.handshake.query.boardId as string;
    if (!boardId) {
      socket.disconnect(true);
      return;
    }

    socket.join(boardId);
    socket.data.sessionId = sessionId;
    socket.data.boardId = boardId;

    // Send full board state on connect
    const board = await prisma.retroBoard.findUnique({
      where: { id: boardId },
      include: { columns: { include: { cards: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } } },
    });
    if (board) {
      socket.emit('board:sync', board);
    }
    ns.to(boardId).emit('participant:joined', { sessionId });

    // ── Card events ──

    socket.on('card:create', async (payload: { columnId: string; content: string }) => {
      const maxPos = await prisma.retroCard.aggregate({
        where: { columnId: payload.columnId },
        _max: { position: true },
      });
      const card = await prisma.retroCard.create({
        data: {
          columnId: payload.columnId,
          authorId: sessionId,
          content: payload.content,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
      ns.to(boardId).emit('card:created', card);
    });

    socket.on('card:update', async (payload: { cardId: string; content: string }) => {
      const card = await prisma.retroCard.update({
        where: { id: payload.cardId },
        data: { content: payload.content },
      });
      ns.to(boardId).emit('card:updated', card);
    });

    socket.on('card:delete', async (payload: { cardId: string }) => {
      await prisma.retroCard.delete({ where: { id: payload.cardId } });
      ns.to(boardId).emit('card:deleted', { cardId: payload.cardId });
    });

    socket.on('card:move', async (payload: { cardId: string; targetColumnId: string; targetPosition: number }) => {
      await prisma.retroCard.update({
        where: { id: payload.cardId },
        data: { columnId: payload.targetColumnId, position: payload.targetPosition },
      });
      ns.to(boardId).emit('card:moved', {
        cardId: payload.cardId,
        columnId: payload.targetColumnId,
        position: payload.targetPosition,
      });
    });

    socket.on('card:merge', async (payload: { sourceCardId: string; targetCardId: string }) => {
      const [source, target] = await Promise.all([
        prisma.retroCard.findUnique({ where: { id: payload.sourceCardId } }),
        prisma.retroCard.findUnique({ where: { id: payload.targetCardId } }),
      ]);
      if (!source || !target) return;

      const updated = await prisma.retroCard.update({
        where: { id: target.id },
        data: {
          content: `${target.content}\n---\n${source.content}`,
          mergedFrom: { push: source.id },
        },
      });
      await prisma.retroCard.delete({ where: { id: source.id } });

      ns.to(boardId).emit('card:merged', { survivingCard: updated, removedCardId: source.id });
    });

    // ── Column events ──

    socket.on('column:rename', async (payload: { columnId: string; name: string }) => {
      await prisma.retroColumn.update({
        where: { id: payload.columnId },
        data: { name: payload.name },
      });
      ns.to(boardId).emit('column:renamed', payload);
    });

    socket.on('column:remove', async (payload: { columnId: string }) => {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board || board.ownerId !== sessionId) {
        socket.emit('error', { message: 'Only the owner can remove columns' });
        return;
      }
      const columnsCount = await prisma.retroColumn.count({ where: { boardId } });
      if (columnsCount <= 3) {
        socket.emit('error', { message: 'Minimum 3 columns required' });
        return;
      }
      await prisma.retroColumn.delete({ where: { id: payload.columnId } });
      ns.to(boardId).emit('column:removed', { columnId: payload.columnId });
    });

    socket.on('column:add', async (payload: { name: string; color: string; cardColor: string }) => {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board || board.ownerId !== sessionId) {
        socket.emit('error', { message: 'Only the owner can add columns' });
        return;
      }
      const maxPos = await prisma.retroColumn.aggregate({
        where: { boardId },
        _max: { position: true },
      });
      const column = await prisma.retroColumn.create({
        data: {
          boardId,
          name: payload.name,
          color: payload.color,
          cardColor: payload.cardColor,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });

      const updatedBoard = await prisma.retroBoard.findUnique({
        where: { id: boardId },
        include: { columns: { include: { cards: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } } },
      });
      if (updatedBoard) {
        ns.to(boardId).emit('board:sync', updatedBoard);
      }
    });

    socket.on('column:reorder', async (payload: { columns: Array<{ id: string; position: number }> }) => {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board || board.ownerId !== sessionId) {
        socket.emit('error', { message: 'Only the owner can reorder columns' });
        return;
      }

      await prisma.$transaction(
        payload.columns.map((col) =>
          prisma.retroColumn.update({
            where: { id: col.id },
            data: { position: col.position },
          }),
        ),
      );

      const updatedBoard = await prisma.retroBoard.findUnique({
        where: { id: boardId },
        include: { columns: { include: { cards: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } } },
      });
      if (updatedBoard) {
        ns.to(boardId).emit('board:sync', updatedBoard);
      }
    });

    // ── Board events ──

    socket.on('board:toggle_cards', async () => {
      const board = await prisma.retroBoard.findUnique({ where: { id: boardId } });
      if (!board || board.ownerId !== sessionId) {
        socket.emit('error', { message: 'Only the owner can toggle card visibility' });
        return;
      }

      const updated = await prisma.retroBoard.update({
        where: { id: boardId },
        data: { cardsHidden: !board.cardsHidden },
      });
      ns.to(boardId).emit('board:cards_toggled', { cardsHidden: updated.cardsHidden });
    });

    socket.on('disconnect', () => {
      ns.to(boardId).emit('participant:left', { sessionId });
    });
  });
}
