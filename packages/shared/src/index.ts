// ── Retro Events ──

export interface RetroCard {
  id: string;
  columnId: string;
  authorId: string;
  content: string;
  position: number;
  mergedFrom: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RetroColumn {
  id: string;
  boardId: string;
  name: string;
  color: string;
  cardColor: string;
  position: number;
  cards: RetroCard[];
}

export interface RetroBoard {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  cardsHidden: boolean;
  columns: RetroColumn[];
}

// Client → Server
export interface CardCreatePayload { columnId: string; content: string }
export interface CardUpdatePayload { cardId: string; content: string }
export interface CardMovePayload { cardId: string; targetColumnId: string; targetPosition: number }
export interface CardMergePayload { sourceCardId: string; targetCardId: string }
export interface CardDeletePayload { cardId: string }
export interface ColumnRenamePayload { columnId: string; name: string }
export interface ColumnRemovePayload { columnId: string }
export interface ColumnReorderPayload { columns: Array<{ id: string; position: number }> }

// ── Poker ──

export const FIBONACCI_SCALE = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?'] as const;
export type PokerValue = (typeof FIBONACCI_SCALE)[number];

export type PokerStatus = 'waiting' | 'voting' | 'revealed';

export interface PokerParticipant {
  sessionId: string;
  displayName: string;
  hasVoted: boolean;
  vote?: PokerValue;
}

export interface PokerRoom {
  id: string;
  name: string;
  ownerId: string;
  status: PokerStatus;
  roundNumber: number;
  participants: PokerParticipant[];
}

// ── Default Columns ──

export const DEFAULT_COLUMNS = [
  { name: 'O que foi bom?', color: '#BBF7D0', cardColor: '#22C55E', position: 0 },
  { name: 'O que pode melhorar?', color: '#FEF08A', cardColor: '#EAB308', position: 1 },
  { name: 'Ações', color: '#BFDBFE', cardColor: '#3B82F6', position: 2 },
  { name: 'Reconhecimentos', color: '#FECACA', cardColor: '#EF4444', position: 3 },
] as const;
