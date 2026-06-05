import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDrag, CdkDragMove, DragDropModule } from '@angular/cdk/drag-drop';
import { Socket } from 'socket.io-client';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import { ThemeService } from '../../services/theme.service';
import { ThemeToggleComponent } from '../../components/theme-toggle.component';
import type { RetroBoard, RetroCard, RetroColumn, MergedSnapshot } from '@focusscrum/shared';

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

// Convert a #RRGGBB hex into an "r, g, b" string for rgba() glows
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

@Component({
  selector: 'app-retro-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DragDropModule, ThemeToggleComponent],
  styles: [`
    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      20%       { transform: rotate(-2deg); }
      40%       { transform: rotate(2deg); }
      60%       { transform: rotate(-1.5deg); }
      80%       { transform: rotate(1.5deg); }
    }
    .card-shaking {
      animation: shake 0.35s ease-in-out infinite;
    }
    /* Floating "job-card" look: white surface lifted by a soft colored glow */
    .retro-card {
      transition: box-shadow 0.25s ease, transform 0.2s ease;
      will-change: box-shadow, transform;
    }
    .cdk-drag-preview {
      animation: shake 0.35s ease-in-out infinite;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      border-radius: 1rem;
      opacity: 0.92;
    }
    .cdk-drag-placeholder { opacity: 0 !important; }
  `],
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
                          : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'">
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
              <app-theme-toggle />
            </div>
          </div>
        </header>

        <!-- Columns -->
        <main class="drag-boundary flex-1 overflow-x-auto p-6 relative">

          <!-- Delete zone (only while dragging) -->
          @if (draggedCard) {
            <div class="fixed left-1/2 -translate-x-1/2 bottom-8 z-50 pointer-events-none transition-all duration-200"
                 [class.scale-125]="isOverDeleteZone">
              <div class="delete-zone flex flex-col items-center gap-1 px-8 py-3 rounded-2xl border-2 shadow-xl transition-all duration-200"
                   [class.bg-red-500]="isOverDeleteZone"
                   [class.border-red-500]="isOverDeleteZone"
                   [class.text-white]="isOverDeleteZone"
                   [class.bg-white]="!isOverDeleteZone"
                   [class.dark:bg-slate-800]="!isOverDeleteZone"
                   [class.border-slate-300]="!isOverDeleteZone"
                   [class.dark:border-slate-600]="!isOverDeleteZone"
                   [class.text-slate-500]="!isOverDeleteZone"
                   [class.dark:text-slate-400]="!isOverDeleteZone">
                <span class="text-2xl">🗑️</span>
                <span class="text-xs font-semibold">{{ isOverDeleteZone ? 'Solte para excluir' : 'Arraste aqui para excluir' }}</span>
              </div>
            </div>
          }

          <div class="flex gap-5 min-h-[calc(100vh-120px)]">

            @for (column of board.columns; track column.id) {
              <div class="flex-1 min-w-[240px] flex flex-col rounded-2xl overflow-hidden"
                   [style.backgroundColor]="column.color + '40'">

                <!-- Column header -->
                <div class="px-4 py-3 flex items-center gap-2" [style.backgroundColor]="column.color">
                  <h2 class="font-semibold text-sm text-slate-800 flex-1">{{ column.name }}</h2>
                  <span class="text-xs font-medium text-slate-500 bg-white/60 rounded-full px-2 py-0.5">{{ column.cards.length }}</span>
                </div>

                <!-- Add card input -->
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

                <!-- Cards list -->
                <div class="flex-1 p-3 space-y-2 min-h-[100px]">
                  @for (card of column.cards; track card.id) {
                    <div cdkDrag #dragRef="cdkDrag"
                         [cdkDragData]="card"
                         cdkDragBoundary=".drag-boundary"
                         [cdkDragDisabled]="!canDrag(card)"
                         [attr.data-card-id]="card.id"
                         class="retro-card group rounded-3xl bg-white dark:bg-slate-800 relative hover:-translate-y-1"
                         [class.cursor-grab]="canDrag(card)"
                         [class.cursor-default]="!canDrag(card)"
                         [class.card-shaking]="draggedCard?.id === card.id"
                         [class.ring-2]="dragOverCardId === card.id && !isOverDeleteZone"
                         [class.ring-blue-400]="dragOverCardId === card.id && !isOverDeleteZone"
                         [class.opacity-40]="draggedCard && draggedCard.id !== card.id && !dragOverCardId"
                         [style.boxShadow]="cardGlow(card, column.cardColor)"
                         (cdkDragStarted)="onDragStart($event, card, dragRef)"
                         (cdkDragEnded)="onDragEnd($event, dragRef)"
                         (cdkDragMoved)="onDragMove($event)"
                         (click)="handleCardClick(card)">

                      <!-- EDITING state -->
                      @if (editingCardId === card.id) {
                        <div class="p-4" (click)="$event.stopPropagation()">
                          <textarea autofocus
                                    [value]="editingText"
                                    (input)="editingText = getTextareaValue($event)"
                                    (keydown.escape)="cancelEdit()"
                                    rows="3"
                                    class="font-nexa w-full rounded-lg border-2 border-blue-400 dark:border-blue-500 bg-slate-50 dark:bg-slate-700 px-3 py-2 text-sm outline-none resize-none transition text-slate-700 dark:text-slate-100">
                          </textarea>
                          <div class="flex gap-2 mt-2 justify-end">
                            <button (click)="cancelEdit()"
                                    class="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                              Cancelar
                            </button>
                            <button (click)="saveCard(card)"
                                    class="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition">
                              Salvar
                            </button>
                          </div>
                        </div>
                      } @else {
                        <!-- VIEW state -->
                        <div class="p-4">

                          <!-- Main card content -->
                          <div class="flex items-start gap-2">
                            <p class="font-nexa text-sm leading-relaxed whitespace-pre-wrap flex-1 transition-all duration-300"
                               [class]="shouldBlur(card) ? 'blur-[6px] text-slate-400 select-none' : 'text-slate-700 dark:text-slate-200'">
                              {{ card.content }}
                            </p>

                            <!-- Action buttons -->
                            @if (!shouldBlur(card)) {
                              <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">

                                <!-- 3-dots menu — only if has mergedSnapshots -->
                                @if ((card.mergedSnapshots?.length || 0) > 0) {
                                  <div class="relative">
                                    <button (click)="$event.stopPropagation(); toggleMergeMenu(card.id)"
                                            title="Opções de mesclagem"
                                            class="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-xs font-bold tracking-tight">
                                      ···
                                    </button>
                                    @if (mergeMenuCardId === card.id) {
                                      <div class="fixed inset-0 z-30" (click)="mergeMenuCardId = null"></div>
                                      <div class="absolute right-0 top-7 z-40 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <div class="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                                          <p class="text-xs font-semibold text-slate-500 dark:text-slate-400">Cards mesclados</p>
                                        </div>
                                        @for (snap of card.mergedSnapshots; track snap.id) {
                                          <div class="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                            <p class="text-xs text-slate-600 dark:text-slate-300 flex-1 truncate">{{ snap.content }}</p>
                                            @if (canUnmerge(card, snap)) {
                                              <button (click)="$event.stopPropagation(); unmergeCard(card, snap.id); mergeMenuCardId = null"
                                                      title="Separar este card"
                                                      class="shrink-0 text-xs text-amber-500 hover:text-amber-600 font-semibold whitespace-nowrap">
                                                ↩
                                              </button>
                                            }
                                          </div>
                                        }
                                      </div>
                                    }
                                  </div>
                                }

                                @if (canEdit(card)) {
                                  <button (click)="$event.stopPropagation(); startEditing(card)"
                                          title="Editar card"
                                          class="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-xs">
                                    ✏
                                  </button>
                                }

                                @if (canDelete(card)) {
                                  <button (click)="$event.stopPropagation(); deleteCard(card)"
                                          title="Excluir card"
                                          class="w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition text-xs">
                                    ✕
                                  </button>
                                }
                              </div>
                            }
                          </div>

                          <!-- Merged sub-cards — each shown as a separate block -->
                          @if ((card.mergedSnapshots?.length || 0) > 0 && !shouldBlur(card)) {
                            @for (snap of card.mergedSnapshots; track snap.id) {
                              <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-start gap-2">
                                <p class="font-nexa text-sm whitespace-pre-wrap flex-1 text-slate-600 dark:text-slate-300">{{ snap.content }}</p>
                              </div>
                            }
                          }

                        </div>
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

  // Editing
  editingCardId: string | null = null;
  editingText = '';

  // Drag
  draggedCard: RetroCard | null = null;
  dragOverCardId: string | null = null;
  isOverDeleteZone = false;
  private deleteZoneEl: HTMLElement | null = null;

  // Merge menu
  mergeMenuCardId: string | null = null;

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
    private theme: ThemeService,
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

  // ── Permission helpers ──

  isAuthor(card: RetroCard): boolean {
    return card.authorId === this.sessionId;
  }

  canEdit(card: RetroCard): boolean {
    return this.isOwner || this.isAuthor(card);
  }

  canDelete(card: RetroCard): boolean {
    return this.isOwner || this.isAuthor(card);
  }

  canDrag(card: RetroCard): boolean {
    return this.isOwner || this.isAuthor(card);
  }

  canUnmerge(card: RetroCard, snap: MergedSnapshot): boolean {
    return this.isOwner || this.isAuthor(card) || snap.authorId === this.sessionId;
  }

  shouldBlur(card: RetroCard): boolean {
    return !this.isOwner && !!this.board?.cardsHidden && !this.isAuthor(card);
  }

  // Soft colored "glow" under the card (job-card style). The column's cardColor
  // is used as the glow tint; the author's own cards glow a touch stronger.
  // In dark mode the glow is dimmed so it stays subtle over the dark surface.
  cardGlow(card: RetroCard, cardColor: string): string {
    const rgb = hexToRgb(cardColor);
    const own = this.isAuthor(card);
    const dim = this.theme.isDark ? 0.5 : 1;
    const colored = (own ? 0.45 : 0.3) * dim;
    const ambient = (own ? 0.18 : 0.12) * dim;
    return [
      `0 18px 30px -12px rgba(${rgb}, ${colored.toFixed(3)})`,
      `0 6px 14px -8px rgba(15, 23, 42, ${ambient.toFixed(3)})`,
    ].join(', ');
  }

  // ── Socket events ──

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
          cards: col.cards
            .filter(c => c.id !== removedCardId)
            .map(c => c.id === survivingCard.id ? survivingCard : c),
        })),
      };
    });

    this.socket.on('card:unmerged', ({ updatedCard, restoredCard }: { updatedCard: RetroCard; restoredCard: RetroCard }) => {
      if (!this.board) return;
      this.board = {
        ...this.board,
        columns: this.board.columns.map(col => {
          let cards = col.cards.map(c => c.id === updatedCard.id ? updatedCard : c);
          if (col.id === restoredCard.columnId && !cards.some(c => c.id === restoredCard.id)) {
            cards = [...cards, restoredCard];
          }
          return { ...col, cards };
        }),
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

    this.socket.on('column:added', (column: RetroColumn) => {
      if (!this.board) return;
      this.board = { ...this.board, columns: [...this.board.columns, column] };
      this.initEditColumns();
    });

    this.socket.on('column:reordered', ({ columns }: { columns: Array<{ id: string; position: number }> }) => {
      if (!this.board) return;
      const posMap = new Map(columns.map(c => [c.id, c.position]));
      this.board = {
        ...this.board,
        columns: [...this.board.columns]
          .map(col => ({ ...col, position: posMap.get(col.id) ?? col.position }))
          .sort((a, b) => a.position - b.position),
      };
      this.initEditColumns();
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

  handleCardClick(card: RetroCard) {
    if (this.shouldBlur(card) || !this.canEdit(card) || this.draggedCard) return;
    this.startEditing(card);
  }

  startEditing(card: RetroCard) {
    if (!this.canEdit(card)) return;
    this.editingCardId = card.id;
    this.editingText = card.content;
  }

  cancelEdit() {
    this.editingCardId = null;
    this.editingText = '';
  }

  saveCard(card: RetroCard) {
    const trimmed = this.editingText.trim();
    if (trimmed && this.socket) {
      this.socket.emit('card:update', { cardId: card.id, content: trimmed });
    }
    this.editingCardId = null;
    this.editingText = '';
  }

  deleteCard(card: RetroCard) {
    if (!this.canDelete(card)) return;
    this.socket?.emit('card:delete', { cardId: card.id });
  }

  unmergeCard(card: RetroCard, snapshotId: string) {
    this.socket?.emit('card:unmerge', { cardId: card.id, snapshotId });
  }

  toggleMergeMenu(cardId: string) {
    this.mergeMenuCardId = this.mergeMenuCardId === cardId ? null : cardId;
  }

  // ── Drag & Drop ──

  onDragStart(event: any, card: RetroCard, dragRef: CdkDrag) {
    this.draggedCard = card;
    this.dragOverCardId = null;
    this.isOverDeleteZone = false;
    this.deleteZoneEl = null;
    this.editingCardId = null;
  }

  onDragMove(event: CdkDragMove) {
    if (!this.draggedCard) return;

    const pointer = event.pointerPosition;

    // Locate delete zone element once
    if (!this.deleteZoneEl) {
      this.deleteZoneEl = document.querySelector('.delete-zone') as HTMLElement;
    }

    if (this.deleteZoneEl) {
      const rect = this.deleteZoneEl.getBoundingClientRect();
      this.isOverDeleteZone = (
        pointer.x >= rect.left && pointer.x <= rect.right &&
        pointer.y >= rect.top && pointer.y <= rect.bottom
      );
    }

    if (this.isOverDeleteZone) {
      this.dragOverCardId = null;
      return;
    }

    // Find merge target by checking all [data-card-id] elements' bounding boxes
    // (more reliable than elementsFromPoint which hits the drag preview overlay)
    const allCardEls = document.querySelectorAll('[data-card-id]');
    let foundId: string | null = null;
    for (const el of Array.from(allCardEls)) {
      const id = el.getAttribute('data-card-id');
      if (!id || id === this.draggedCard.id) continue;
      const rect = el.getBoundingClientRect();
      if (
        pointer.x >= rect.left && pointer.x <= rect.right &&
        pointer.y >= rect.top && pointer.y <= rect.bottom
      ) {
        foundId = id;
        break;
      }
    }
    this.dragOverCardId = foundId;
  }

  onDragEnd(event: any, dragRef: CdkDrag) {
    const dragged = this.draggedCard;
    const overCardId = this.dragOverCardId;
    const overDelete = this.isOverDeleteZone;

    this.draggedCard = null;
    this.dragOverCardId = null;
    this.isOverDeleteZone = false;
    this.deleteZoneEl = null;

    // Reset visual position after capturing state
    dragRef.reset();

    if (!dragged) return;

    if (overDelete) {
      this.socket?.emit('card:delete', { cardId: dragged.id });
    } else if (overCardId) {
      const target = this.findCardById(overCardId);
      if (target) {
        this.socket?.emit('card:merge', { sourceCardId: dragged.id, targetCardId: target.id });
      }
    }
  }

  findCardById(cardId: string): RetroCard | null {
    if (!this.board) return null;
    for (const col of this.board.columns) {
      const found = col.cards.find(c => c.id === cardId);
      if (found) return found;
    }
    return null;
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
