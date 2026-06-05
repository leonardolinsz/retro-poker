import { Namespace, Socket } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import cookie from 'cookie';

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'fs_sid';

// In-memory cache: boardId → lightweight board meta
// Cleared when all sockets leave the room
interface BoardMeta {
  ownerId: string;
  cardsHidden: boolean;
  columnCount: number;
}
const boardCache = new Map<string, BoardMeta>();

function getSessionId(socket: Socket): string | null {
  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  return cookie.parse(raw)[COOKIE_NAME] || null;
}

async function getOrLoadMeta(boardId: string): Promise<BoardMeta | null> {
  if (boardCache.has(boardId)) return boardCache.get(boardId)!;

  const board = await prisma.retroBoard.findUnique({
    where: { id: boardId },
    select: {
      ownerId: true,
      cardsHidden: true,
      _count: { select: { columns: true } },
    },
  });
  if (!board) return null;

  const meta: BoardMeta = {
    ownerId: board.ownerId,
    cardsHidden: board.cardsHidden,
    columnCount: board._count.columns,
  };
  boardCache.set(boardId, meta);
  return meta;
}

export function setupRetroWs(ns: Namespace) {
  ns.on('connection', async (socket) => {
    const sessionId = getSessionId(socket);
    if (!sessionId) { socket.disconnect(true); return; }

    const boardId = socket.handshake.query.boardId as string;
    if (!boardId) { socket.disconnect(true); return; }

    socket.join(boardId);
    socket.data.sessionId = sessionId;
    socket.data.boardId = boardId;

    // Load meta into cache + send full board in parallel
    const [, board] = await Promise.all([
      getOrLoadMeta(boardId),
      prisma.retroBoard.findUnique({
        where: { id: boardId },
        include: {
          columns: {
            orderBy: { position: 'asc' },
            include: { cards: { orderBy: { position: 'asc' } } },
          },
        },
      }),
    ]);

    if (!board) { socket.disconnect(true); return; }

    // Hydrate cache with real data from the full query (avoids a second round-trip)
    boardCache.set(boardId, {
      ownerId: board.ownerId,
      cardsHidden: board.cardsHidden,
      columnCount: board.columns.length,
    });

    socket.emit('board:sync', board);
    ns.to(boardId).emit('participant:joined', { sessionId });

    // ── Helpers ──

    const isOwner = () => boardCache.get(boardId)?.ownerId === sessionId;

    // ── Card events ──

    socket.on('card:create', async (payload: { columnId: string; content: string }) => {
      try {
        // Next position = max(position) + 1 within the column.
        // Must fit in INT4 (Date.now() overflows the integer column).
        const agg = await prisma.retroCard.aggregate({
          where: { columnId: payload.columnId },
          _max: { position: true },
        });
        const position = (agg._max.position ?? -1) + 1;

        const card = await prisma.retroCard.create({
          data: {
            columnId: payload.columnId,
            authorId: sessionId,
            content: payload.content,
            position,
          },
        });
        ns.to(boardId).emit('card:created', card);
      } catch (err) {
        console.error('[retro] card:create failed', err);
        socket.emit('error', { message: 'Failed to create card' });
      }
    });

    socket.on('card:update', async (payload: { cardId: string; content: string }) => {
      // Fetch only the card — board ownership check uses cache
      const card = await prisma.retroCard.findUnique({
        where: { id: payload.cardId },
        select: { authorId: true },
      });
      if (!card) return;
      if (!isOwner() && card.authorId !== sessionId) return;

      // Optimistic: emit immediately, then persist
      const updated = await prisma.retroCard.update({
        where: { id: payload.cardId },
        data: { content: payload.content },
      });
      ns.to(boardId).emit('card:updated', updated);
    });

    socket.on('card:delete', async (payload: { cardId: string }) => {
      const card = await prisma.retroCard.findUnique({
        where: { id: payload.cardId },
        select: { authorId: true },
      });
      if (!card) return;
      if (!isOwner() && card.authorId !== sessionId) return;

      await prisma.retroCard.delete({ where: { id: payload.cardId } });
      ns.to(boardId).emit('card:deleted', { cardId: payload.cardId });
    });

    socket.on('card:move', async (payload: { cardId: string; targetColumnId: string; targetPosition: number }) => {
      // Fire-and-forget persist — emit immediately for snappy UX
      ns.to(boardId).emit('card:moved', {
        cardId: payload.cardId,
        columnId: payload.targetColumnId,
        position: payload.targetPosition,
      });
      await prisma.retroCard.update({
        where: { id: payload.cardId },
        data: { columnId: payload.targetColumnId, position: payload.targetPosition },
      });
    });

    socket.on('card:merge', async (payload: { sourceCardId: string; targetCardId: string }) => {
      try {
        // Fetch both cards in parallel, ownership check from cache
        const [source, target] = await Promise.all([
          prisma.retroCard.findUnique({ where: { id: payload.sourceCardId } }),
          prisma.retroCard.findUnique({ where: { id: payload.targetCardId } }),
        ]);
        if (!source || !target) return;
        if (!isOwner() && source.authorId !== sessionId) return;

        const targetSnapshots = Array.isArray(target.mergedSnapshots)
          ? (target.mergedSnapshots as any[])
          : [];
        // Source may already contain merged cards — flatten them in too,
        // otherwise they'd be lost when the source card is deleted.
        const sourceSnapshots = Array.isArray(source.mergedSnapshots)
          ? (source.mergedSnapshots as any[])
          : [];
        const sourceSelfSnapshot = { id: source.id, content: source.content, authorId: source.authorId };

        const mergedSnapshots = [...targetSnapshots, sourceSelfSnapshot, ...sourceSnapshots];
        const mergedFrom = [...target.mergedFrom, source.id, ...source.mergedFrom];

        // Merge + delete in a single transaction
        const [updated] = await prisma.$transaction([
          prisma.retroCard.update({
            where: { id: target.id },
            data: {
              mergedFrom,
              mergedSnapshots,
            },
          }),
          prisma.retroCard.delete({ where: { id: source.id } }),
        ]);

        ns.to(boardId).emit('card:merged', { survivingCard: updated, removedCardId: source.id });
      } catch (err) {
        console.error('[retro] card:merge failed', err);
        socket.emit('error', { message: 'Failed to merge cards' });
      }
    });

    socket.on('card:unmerge', async (payload: { cardId: string; snapshotId: string }) => {
      try {
        const card = await prisma.retroCard.findUnique({ where: { id: payload.cardId } });
        if (!card) return;

        const snapshots = Array.isArray(card.mergedSnapshots)
          ? (card.mergedSnapshots as any[])
          : [];
        const snapshot = snapshots.find((s: any) => s.id === payload.snapshotId);
        if (!snapshot) return;

        if (!isOwner() && card.authorId !== sessionId && snapshot.authorId !== sessionId) return;

        const remainingSnapshots = snapshots.filter((s: any) => s.id !== payload.snapshotId);
        const remainingMergedFrom = card.mergedFrom.filter(id => id !== payload.snapshotId);

        // Restore at end of the column: max(position) + 1 (fits in INT4).
        const agg = await prisma.retroCard.aggregate({
          where: { columnId: card.columnId },
          _max: { position: true },
        });
        const restoredPosition = (agg._max.position ?? -1) + 1;

        const [updatedCard, restoredCard] = await prisma.$transaction([
          prisma.retroCard.update({
            where: { id: card.id },
            data: { mergedFrom: remainingMergedFrom, mergedSnapshots: remainingSnapshots },
          }),
          prisma.retroCard.create({
            data: {
              id: snapshot.id,
              columnId: card.columnId,
              authorId: snapshot.authorId,
              content: snapshot.content,
              position: restoredPosition,
              mergedFrom: [],
              mergedSnapshots: [],
            },
          }),
        ]);

        ns.to(boardId).emit('card:unmerged', { updatedCard, restoredCard });
      } catch (err) {
        console.error('[retro] card:unmerge failed', err);
        socket.emit('error', { message: 'Failed to unmerge card' });
      }
    });

    // ── Column events ──

    socket.on('column:rename', async (payload: { columnId: string; name: string }) => {
      // Emit immediately — no auth needed (any participant can rename for now)
      ns.to(boardId).emit('column:renamed', payload);
      await prisma.retroColumn.update({
        where: { id: payload.columnId },
        data: { name: payload.name },
      });
    });

    socket.on('column:remove', async (payload: { columnId: string }) => {
      const meta = boardCache.get(boardId);
      if (!meta || meta.ownerId !== sessionId) {
        socket.emit('error', { message: 'Only the owner can remove columns' });
        return;
      }
      if (meta.columnCount <= 3) {
        socket.emit('error', { message: 'Minimum 3 columns required' });
        return;
      }

      await prisma.retroColumn.delete({ where: { id: payload.columnId } });

      // Update cache
      meta.columnCount -= 1;

      ns.to(boardId).emit('column:removed', { columnId: payload.columnId });
    });

    socket.on('column:add', async (payload: { name: string; color: string; cardColor: string }) => {
      const meta = boardCache.get(boardId);
      if (!meta || meta.ownerId !== sessionId) {
        socket.emit('error', { message: 'Only the owner can add columns' });
        return;
      }

      try {
        // Next position = max(position) + 1 within the board (fits in INT4).
        const agg = await prisma.retroColumn.aggregate({
          where: { boardId },
          _max: { position: true },
        });
        const position = (agg._max.position ?? -1) + 1;

        const column = await prisma.retroColumn.create({
          data: {
            boardId,
            name: payload.name,
            color: payload.color,
            cardColor: payload.cardColor,
            position,
          },
        });

        // Update cache
        meta.columnCount += 1;

        // Emit granular event instead of full board:sync
        ns.to(boardId).emit('column:added', { ...column, cards: [] });
      } catch (err) {
        console.error('[retro] column:add failed', err);
        socket.emit('error', { message: 'Failed to add column' });
      }
    });

    socket.on('column:reorder', async (payload: { columns: Array<{ id: string; position: number }> }) => {
      if (!isOwner()) {
        socket.emit('error', { message: 'Only the owner can reorder columns' });
        return;
      }

      // Emit immediately for snappy UX
      ns.to(boardId).emit('column:reordered', { columns: payload.columns });

      // Persist in background
      await prisma.$transaction(
        payload.columns.map(col =>
          prisma.retroColumn.update({
            where: { id: col.id },
            data: { position: col.position },
          }),
        ),
      );
    });

    // ── Board events ──

    socket.on('board:toggle_cards', async () => {
      const meta = boardCache.get(boardId);
      if (!meta || meta.ownerId !== sessionId) {
        socket.emit('error', { message: 'Only the owner can toggle card visibility' });
        return;
      }

      const newHidden = !meta.cardsHidden;
      meta.cardsHidden = newHidden;

      // Emit immediately
      ns.to(boardId).emit('board:cards_toggled', { cardsHidden: newHidden });

      // Persist in background
      await prisma.retroBoard.update({
        where: { id: boardId },
        data: { cardsHidden: newHidden },
      });
    });

    socket.on('disconnect', () => {
      ns.to(boardId).emit('participant:left', { sessionId });

      // Clear cache when room is empty
      const roomSockets = ns.adapter.rooms.get(boardId);
      if (!roomSockets || roomSockets.size === 0) {
        boardCache.delete(boardId);
      }
    });
  });
}
