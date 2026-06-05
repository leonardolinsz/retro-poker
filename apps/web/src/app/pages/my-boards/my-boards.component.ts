import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { RetroBoard } from '@focusscrum/shared';

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

interface ColumnDraft {
  id: string;
  name: string;
  colorIdx: number;
}

@Component({
  selector: 'app-my-boards',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header class="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a routerLink="/" class="text-xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            FocusScrum
          </a>
          <button (click)="openModal()"
                  class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 hover:-translate-y-0.5">
            + Novo Board
          </button>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-6 py-8">
        @if (boards.length === 0) {
          <div class="text-center py-20 text-slate-400">
            <p class="text-lg mb-2">Nenhum board ainda</p>
            <p class="text-sm">Crie seu primeiro board de retrospectiva</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (board of boards; track board.id) {
              <a [routerLink]="'/retro/' + board.inviteCode"
                 class="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5">
                <h3 class="font-semibold text-lg mb-2 group-hover:text-blue-600 transition-colors">{{ board.name }}</h3>
                <div class="flex gap-1.5 mb-3">
                  @for (col of board.columns; track col.id) {
                    <div class="w-6 h-3 rounded-full" [style.backgroundColor]="col.cardColor"></div>
                  }
                </div>
                <p class="text-xs text-slate-400">{{ getCardCount(board) }} cards</p>
              </a>
            }
          </div>
        }
      </main>

      <!-- Create Board Modal -->
      @if (showModal) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
             (click)="closeModal()">
          <div class="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-slate-100 dark:ring-slate-800 overflow-hidden"
               (click)="$event.stopPropagation()">

            <!-- Header -->
            <div class="px-7 pt-6 pb-4">
              <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Criar novo board</h2>
              <p class="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Dê um nome e configure as colunas da retrospectiva.</p>
            </div>

            <!-- Body -->
            <div class="px-7 pb-2 space-y-5 max-h-[55vh] overflow-y-auto">
              <!-- Board name -->
              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Nome do board</label>
                <input [(ngModel)]="name" name="name" autofocus
                       placeholder="Ex: Retrospectiva Sprint 12"
                       (keydown.enter)="$event.preventDefault()"
                       class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-base text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder:text-slate-400" />
              </div>

              <!-- Columns -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Colunas ({{ columns.length }})</label>
                  <button (click)="addColumn()" [disabled]="columns.length >= 8"
                          class="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
                    + Adicionar coluna
                  </button>
                </div>

                <div class="space-y-2">
                  @for (col of columns; track col.id; let i = $index) {
                    <div class="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2">
                      <!-- Color picker -->
                      <button (click)="cycleColor(i)"
                              [title]="colorLabel(col.colorIdx)"
                              class="w-7 h-7 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800 ring-transparent hover:ring-slate-300 transition"
                              [style.backgroundColor]="colorOf(col.colorIdx).cardColor"></button>
                      <input [(ngModel)]="col.name" [attr.name]="'col-' + col.id"
                             placeholder="Nome da coluna"
                             class="flex-1 bg-transparent border-0 px-1 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400" />
                      <button (click)="removeColumn(i)" [disabled]="columns.length <= 3"
                              title="Remover coluna"
                              class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm">
                        ✕
                      </button>
                    </div>
                  }
                </div>

                @if (columns.length <= 3) {
                  <p class="text-[11px] text-amber-500 mt-2">Mínimo de 3 colunas.</p>
                }
                @if (columns.length >= 8) {
                  <p class="text-[11px] text-amber-500 mt-2">Máximo de 8 colunas.</p>
                }
              </div>
            </div>

            <!-- Footer -->
            <div class="px-7 py-5 mt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button (click)="closeModal()"
                      class="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                Cancelar
              </button>
              <button (click)="handleCreate()" [disabled]="!canSubmit() || creating"
                      class="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {{ creating ? 'Criando...' : 'Criar board' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class MyBoardsComponent implements OnInit {
  boards: RetroBoard[] = [];
  showModal = false;
  creating = false;
  name = '';
  columns: ColumnDraft[] = [];
  readonly COLUMN_COLORS = COLUMN_COLORS;

  constructor(private router: Router) {}

  ngOnInit() {
    fetch('/api/boards', { credentials: 'include' })
      .then(r => r.json())
      .then(data => this.boards = data)
      .catch(() => {});
  }

  openModal() {
    this.name = '';
    this.columns = [
      { id: 'c1', name: 'O que foi bom?', colorIdx: 0 },
      { id: 'c2', name: 'O que pode melhorar?', colorIdx: 1 },
      { id: 'c3', name: 'Ações', colorIdx: 2 },
    ];
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  colorOf(idx: number) {
    return COLUMN_COLORS[idx] ?? COLUMN_COLORS[0];
  }

  colorLabel(idx: number): string {
    return this.colorOf(idx).label;
  }

  cycleColor(i: number) {
    this.columns[i].colorIdx = (this.columns[i].colorIdx + 1) % COLUMN_COLORS.length;
  }

  addColumn() {
    if (this.columns.length >= 8) return;
    this.columns.push({
      id: 'c' + Date.now(),
      name: '',
      colorIdx: this.columns.length % COLUMN_COLORS.length,
    });
  }

  removeColumn(i: number) {
    if (this.columns.length <= 3) return;
    this.columns.splice(i, 1);
  }

  canSubmit(): boolean {
    return this.name.trim().length > 0 && this.columns.length >= 3 && this.columns.length <= 8;
  }

  async handleCreate() {
    if (!this.canSubmit() || this.creating) return;
    this.creating = true;

    const columnsPayload = this.columns.map((col, idx) => {
      const c = this.colorOf(col.colorIdx);
      return {
        name: col.name.trim() || `Coluna ${idx + 1}`,
        color: c.color,
        cardColor: c.cardColor,
        position: idx,
      };
    });

    try {
      const res = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: this.name.trim(), columns: columnsPayload }),
      });
      if (res.ok) {
        const board = await res.json();
        this.showModal = false;
        this.router.navigate(['/retro', board.inviteCode]);
      }
    } finally {
      this.creating = false;
    }
  }

  getCardCount(board: RetroBoard): number {
    return board.columns.reduce((acc, c) => acc + c.cards.length, 0);
  }
}
