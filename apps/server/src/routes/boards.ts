import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { DEFAULT_COLUMNS } from '@focusscrum/shared';
import { nanoid } from 'nanoid';

export const boardRoutes = Router();

// List my boards
boardRoutes.get('/', async (req, res) => {
  const boards = await prisma.retroBoard.findMany({
    where: { ownerId: req.sessionId! },
    orderBy: { updatedAt: 'desc' },
    include: { columns: { include: { cards: true } } },
  });
  res.json(boards);
});

// Create board
boardRoutes.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const board = await prisma.retroBoard.create({
    data: {
      name: name.trim(),
      ownerId: req.sessionId!,
      inviteCode: nanoid(8),
      columns: {
        create: DEFAULT_COLUMNS.map((col) => ({
          name: col.name,
          color: col.color,
          cardColor: col.cardColor,
          position: col.position,
        })),
      },
    },
    include: { columns: { include: { cards: true }, orderBy: { position: 'asc' } } },
  });
  res.status(201).json(board);
});

// Get board by invite code
boardRoutes.get('/join/:inviteCode', async (req, res) => {
  const board = await prisma.retroBoard.findUnique({
    where: { inviteCode: req.params.inviteCode },
    include: { columns: { include: { cards: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } } },
  });
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json(board);
});

// Get board by ID
boardRoutes.get('/:id', async (req, res) => {
  const board = await prisma.retroBoard.findUnique({
    where: { id: req.params.id },
    include: { columns: { include: { cards: { orderBy: { position: 'asc' } } }, orderBy: { position: 'asc' } } },
  });
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json(board);
});

// Delete board
boardRoutes.delete('/:id', async (req, res) => {
  const board = await prisma.retroBoard.findUnique({ where: { id: req.params.id } });
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (board.ownerId !== req.sessionId) return res.status(403).json({ error: 'Not the owner' });
  await prisma.retroBoard.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
