import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Socket } from 'socket.io-client';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import type { RetroBoard, RetroCard, RetroColumn } from '@focusscrum/shared';

const COLUMN_COLORS = [
  { color: '#BBF7D0', cardColor: '#22C55E', label: 'Verde' },
  { color: '#FEF08A', cardColor: '#EAB308', label: 'Amarelo' },
  { color: '#BFDBFE', cardColor: '#3B82F6', label: 'Azul' },
  { color: '#FECACA', cardColor: '#EF4444', label: 'Vermelho' },
  { color: '#E9D5FF', cardColor: '#8B5CF6', label: 'Roxo' },
  { color: '#FBCFE8', cardColor: '#EC4899', label: 'Rosa' },
  { color: '#FED7AA', cardColor: '#F97316', label: 'Laranja' },
  { color: '#CCFBF1', cardColor: '#14B8A6', label: 'Teal' },
];

@Component({
  selector: 'app-retro-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule],
  template: `
    @if (!board) {
      <div class="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div class="animate-pulse text-slate-400">Carregando board...</div>
      </div>
    }

    @if (board) {
      <div class="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <!-- Header -->
        <header class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div class="max-w-full mx-auto px-6 py-3 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <a routerLink="/retro" class="text-lg font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">FocusScrum</a>
              <span class="text-slate-300 dark:text-slate-700">|</span>
              <h1 class="font-semibold text-slate-700 dark:text-slate-200">{{ board.name }}</h1>
            </div>
            <div class="flex items-center gap-2">
              @if (isOwner) {
                <button (click)="handleToggleCards()"
                        class="rounded-xl border px-4 py-2 text-sm font-medium transition"
                        [ngClass]="board.cardsHidden
                          ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100'">
                  {{ board.cardsHidden ? '👁 Mostrar cards' : '🙈 Ocultar cards' }}
                </button>
                <button (click)="editModalOpen = true"
                        class="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  ✏️ Editar board
                </button>
              }
              <button (click)="handleCopyLink()"
                      class="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                Copiar link
              </button>
            </div>
          </div>
        </header>

        <!-- Columns -->
        <main class="flex-1 overflow-x-auto p-6">
          <div class="flex gap-5 min-h-[calc(100vh-120px)]" cdkDropListGroup>
            @for (column of board.columns; track column.id) {
              <div class="flex-1 min-w-[220px] flex flex-col rounded-2xl overflow-hidden"
                   [style.backgroundColor]="column.color + '40'">
                <!-- Column header -->
                <div class="px-4 py-3 flex items-center gap-2" [style.backgroundColor]="column.color">
                  <h2 class="font-semibold text-sm text-slate-800 flex-1">{{ column.name }}</h2>
                  <span class="text-xs font-medium text-slate-500 bg-white/60 rounded-full px-2 py-0.5">{{ column.cards.length }}</span>
                </div>

                <!-- Add card input (top) -->
                <div class="p-3 pb-0">
                  <div class="flex gap-2">
                    <input [value]="newCardTexts[column.id] || ''"
                           (input)="newCardTexts[column.id] = getInputValue($event)"
                           (keydown.enter)="handleCreateCard(column.id)"
                           placeholder="Adicionar card..."
                           class="flex-1 rounded-xl bg-white/80 dark:bg-slate-800/80 border-0 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 transition placeholder:text-slate-400" />
                    <button (click)="handleCreateCard(column.id)"
                            class="rounded-xl bg-white/90 dark:bg-slate-700 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-white transition">
                      +
                    </button>
                  </div>
                </div>

                <!-- Cards -->
                <div cdkDropList [cdkDropListData]="column.cards" [id]="column.id"
                     (cdkDropListDropped)="onDrop($event, column)"
                     class="flex-1 p-3 space-y-2 min-h-[100px]">
                  @for (card of column.cards; track card.id) {
                    <div cdkDrag [cdkDragData]="card"
                         class="group rounded-xl p-3 shadow-sm bg-white dark:bg-slate-800 border-l-4 transition-all hover:shadow-md cursor-grab active:cursor-grabbing"
                         [style.borderLeftColor]="column.cardColor"
                         [class.select-none]="shouldBlur(card)"
                         (click)="!shouldBlur(card) && startEditing(card)">

                      @if (editingCardId === card.id && !shouldBlur(card)) {
                        <textarea autofocus
                                  [value]="editingText"
                                  (input)="editingText = getTextareaValue($event)"
                                  (blur)="saveCard(card)"
                                  (keydown.enter)="$event.preventDefault(); saveCard(card)"
                                  (click)="$event.stopPropagation()"
                                  class="w-full bg-transparent border-0 outline-none text-sm resize-none min-h-[40px]">
                        </textarea>
                      } @else {
                        <div class="flex items-start justify-between gap-2">
                          <p class="text-sm whitespace-pre-wrap flex-1 transition-all duration-300"
                             [class]="shouldBlur(card) ? 'blur-[6px] text-slate-400' : 'text-slate-700 dark:text-slate-200'">
                            {{ card.content }}
                          </p>
                          @if (!shouldBlur(card)) {
                            <button (click)="$event.stopPropagation(); deleteCard(card)"
                                    class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all text-xs shrink-0">
                              ✕
                            </button>
                          }
                        </div>
                      }

                      @if (card.mergedFrom.length > 0 && !shouldBlur(card)) {
                        <div class="mt-1.5 text-xs text-slate-400">↗ {{ card.mergedFrom.length }} card(s) mesclado(s)</div>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </main>
      </div>

      <!-- Edit Modal -->
      @if (editModalOpen) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" (click)="editModalOpen = false">
          <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" (click)="$event.stopPropagation()">
            <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Editar Board</h2>
              <p class="text-sm text-slate-400 mt-0.5">Renomeie, reordene, remova ou adicione colunas</p>
            </div>

            <div class="px-6 py-4 space-y-2">
              @for (col of editColumns; track col.id; let i = $index) {
                <div class="flex items-center gap-2 group">
                  <div class="flex flex-col gap-0.5">
                    <button (click)="moveColumnUp(i)" [disabled]="i === 0"
                            class="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition text-xs leading-none">▲</button>
                    <button (click)="moveColumnDown(i)" [disabled]="i === editColumns.length - 1"
                            class="text-slate-400 hover:text-slate-700 disabled:opacity-20 transition text-xs leading-none">▼</button>
                  </div>
                  <div class="w-4 h-4 rounded-full shrink-0" [style.backgroundColor]="col.cardColor"></div>
                  <input [(ngModel)]="col.name" [attr.name]="'col-' + col.id"
                         (ngModelChange)="editDirty = true"
                         class="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition" />
                  <button (click)="removeColumn(col.id)" [disabled]="editColumns.length <= 3"
                          class="text-slate-400 hover:text-red-500 disabled:opacity-20 disabled:cursor-not-allowed transition text-sm px-1">✕</button>
                </div>
              }

              <!-- Add column form -->
              @if (showAddForm) {
                <div class="mt-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
                  <input [(ngModel)]="newColName" name="newColName" autofocus
                         (keydown.enter)="addColumn()"
                         placeholder="Nome da nova coluna..."
                         class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition" />
                  <div class="flex gap-2 flex-wrap">
                    @for (c of columnColors; track c.label; let idx = $index) {
                      <button (click)="newColColorIdx = idx"
                              class="w-7 h-7 rounded-full transition-all"
                              [class]="newColColorIdx === idx ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'"
                              [style.backgroundColor]="c.cardColor"
                              [title]="c.label">
                      </button>
                    }
                  </div>
                  <div class="flex gap-2">
                    <button (click)="addColumn()" [disabled]="!newColName.trim()"
                            class="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition">Adicionar</button>
                    <button (click)="showAddForm = false"
                            class="rounded-lg px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancelar</button>
                  </div>
                </div>
              } @else {
                <button (click)="showAddForm = true"
                        class="w-full mt-2 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-400 hover:text-blue-600 hover:border-blue-400 transition">
                  + Adicionar coluna
                </button>
              }
            </div>

            @if (editColumns.length <= 3) {
              <div class="px-6 pb-2"><p class="text-xs text-amber-500">Mínimo de 3 colunas atingido</p></div>
            }

            <div class="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button (click)="editModalOpen = false"
                      class="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">Cancelar</button>
              <button (click)="saveEditModal()" [disabled]="!editDirty"
                      class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 transition">Salvar</button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class RetroBoardComponent implements OnInit, OnDestroy {
  board: RetroBoard | null = null;
  socket: Socket | null = null;
  sessionId: string | null = null;
  newCardTexts: Record<string, string> = {};
  editingCardId: string | null = null;
  editingText = '';

  // Edit modal
  editModalOpen = false;
  editColumns: Array<{ id: string; name: string; position: number; cardColor: string }> = [];
  editDirty = false;
  showAddForm = false;
  newColName = '';
  newColColorIdx = 0;
  columnColors = COLUMN_COLORS;

  get isOwner(): boolean {
    return this.board?.ownerId === this.sessionId;
  }

  constructor(
    private route: ActivatedRoute,
    private socketService: SocketService,
    private session: SessionService,
  ) {}

  ngOnInit() {
    const inviteCode = this.route.snapshot.paramMap.get('inviteCode');
    if (!inviteCode) return;

    this.session.whenReady().then(sid => {
      this.sessionId = sid;
      return fetch(`/api/boards/join/${inviteCode}`, { credentials: 'include' });
    })
    .then(r => r.json())
    .then(b => {
      this.board = b;
      this.initEditColumns();
      this.socket = this.socketService.createRetroSocket(b.id);
      this.setupSocketEvents();
    });
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }

  private setupSocketEvents() {
    if (!this.socket) return;

    this.socket.on('board:sync', (data: RetroBoard) => {
      this.board = data;
      this.initEditColumns();
    });

    this.socket.on('card:created', (card: RetroCard) => {
      if (!this.board) return;
      this.board = {
        ...this.board,
        columns: this.board.columns.map(col =>
          col.id === card.columnId
            ? { ...col, cards: col.cards.some(c => c.id === card.id) ? col.cards : [...col.cards, card] }
            : col,
        ),
      };
    });

    this.socket.on('card:updated', (card: RetroCard) => {
      if (!this.board) return;
      this.board = {
        ...this.board,
        columns: this.board.columns.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === card.id ? card : c),
        })),
      };
    });

    this.socket.on('card:deleted', ({ cardId }: { cardId: string }) => {
      if (!this.board) return;
      this.board = {
        ...this.board,
        columns: this.board.columns.map(col => ({
          ...col,
          cards: col.cards.filter(c => c.id !== cardId),
        })),
      };
    });

    this.socket.on('card:moved', ({ cardId, columnId, position }: { cardId: string; columnId: string; position: number }) => {
      if (!this.board) return;
      let movedCard: RetroCard | undefined;
      const withoutCard = this.board.columns.map(col => ({
        ...col,
        cards: col.cards.filter(c => {
          if (c.id === cardId) { movedCard = { ...c, columnId, position }; return false; }
          return true;
        }),
      }));
      if (!movedCard) return;
      const mc = movedCard;
      this.board = {
        ...this.board,
        columns: withoutCard.map(col =>
          col.id === columnId ? { ...col, cards: [...col.cards, mc].sort((a, b) => a.position - b.position) } : col,
        ),
      };
    });

    this.socket.on('card:merged', ({ survivingCard, removedCardId }: { survivingCard: RetroCard; removedCardId: string }) => {
      if (!this.board) return;
      this.board = {
        ...this.board,
        columns: this.board.columns.map(col => ({
          ...col,
          cards: col.cards.filter(c => c.id !== removedCardId).map(c => c.id === survivingCard.id ? survivingCard : c),
        })),
      };
    });

    this.socket.on('column:renamed', ({ columnId, name }: { columnId: string; name: string }) => {
      if (!this.board) return;
      this.board = { ...this.board, columns: this.board.columns.map(col => col.id === columnId ? { ...col, name } : col) };
    });

    this.socket.on('column:removed', ({ columnId }: { columnId: string }) => {
      if (!this.board) return;
      this.board = { ...this.board, columns: this.board.columns.filter(col => col.id !== columnId) };
    });

    this.socket.on('board:cards_toggled', ({ cardsHidden }: { cardsHidden: boolean }) => {
      if (this.board) this.board = { ...this.board, cardsHidden };
    });
  }

  // ── Card actions ──

  handleCreateCard(columnId: string) {
    const text = this.newCardTexts[columnId]?.trim();
    if (!text || !this.socket) return;
    this.socket.emit('card:create', { columnId, content: text });
    this.newCardTexts[columnId] = '';
  }

  startEditing(card: RetroCard) {
    this.editingCardId = card.id;
    this.editingText = card.content;
  }

  saveCard(card: RetroCard) {
    if (this.editingText.trim() !== card.content && this.socket) {
      this.socket.emit('card:update', { cardId: card.id, content: this.editingText.trim() });
    }
    this.editingCardId = null;
  }

  deleteCard(card: RetroCard) {
    this.socket?.emit('card:delete', { cardId: card.id });
  }

  shouldBlur(card: RetroCard): boolean {
    return !this.isOwner && !!this.board?.cardsHidden && card.authorId !== this.sessionId;
  }

  // ── Drag & Drop ──

  onDrop(event: CdkDragDrop<RetroCard[]>, column: RetroColumn) {
    if (!this.socket || !this.board) return;

    if (event.previousContainer === event.container) {
      // Reorder within same column
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      const card = event.container.data[event.currentIndex];
      this.socket.emit('card:move', { cardId: card.id, targetColumnId: column.id, targetPosition: event.currentIndex });
    } else {
      // Move between columns
      const card = event.previousContainer.data[event.previousIndex];
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      this.socket.emit('card:move', { cardId: card.id, targetColumnId: column.id, targetPosition: event.currentIndex });
    }
  }

  // ── Board actions ──

  handleToggleCards() {
    this.socket?.emit('board:toggle_cards');
  }

  handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
  }

  // ── Edit modal ──

  private initEditColumns() {
    if (!this.board) return;
    this.editColumns = this.board.columns.map(c => ({ id: c.id, name: c.name, position: c.position, cardColor: c.cardColor }));
    this.editDirty = false;
  }

  moveColumnUp(i: number) {
    if (i <= 0) return;
    [this.editColumns[i - 1], this.editColumns[i]] = [this.editColumns[i], this.editColumns[i - 1]];
    this.editColumns = this.editColumns.map((c, idx) => ({ ...c, position: idx }));
    this.editDirty = true;
  }

  moveColumnDown(i: number) {
    if (i >= this.editColumns.length - 1) return;
    [this.editColumns[i], this.editColumns[i + 1]] = [this.editColumns[i + 1], this.editColumns[i]];
    this.editColumns = this.editColumns.map((c, idx) => ({ ...c, position: idx }));
    this.editDirty = true;
  }

  removeColumn(id: string) {
    if (this.editColumns.length <= 3) return;
    this.socket?.emit('column:remove', { columnId: id });
    this.editColumns = this.editColumns.filter(c => c.id !== id).map((c, i) => ({ ...c, position: i }));
    this.editDirty = true;
  }

  addColumn() {
    if (!this.newColName.trim() || !this.socket) return;
    const palette = COLUMN_COLORS[this.newColColorIdx];
    this.socket.emit('column:add', { name: this.newColName.trim(), color: palette.color, cardColor: palette.cardColor });
    this.newColName = '';
    this.showAddForm = false;
    this.editModalOpen = false;
  }

  saveEditModal() {
    if (!this.socket || !this.board) return;
    for (const col of this.editColumns) {
      const original = this.board.columns.find(c => c.id === col.id);
      if (original && original.name !== col.name) {
        this.socket.emit('column:rename', { columnId: col.id, name: col.name });
      }
    }
    const positionsChanged = this.editColumns.some(c => {
      const orig = this.board!.columns.find(o => o.id === c.id);
      return orig && orig.position !== c.position;
    });
    if (positionsChanged) {
      this.socket.emit('column:reorder', { columns: this.editColumns.map(c => ({ id: c.id, position: c.position })) });
    }
    this.editModalOpen = false;
  }

  // ── Helpers ──

  getInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  getTextareaValue(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }
}
