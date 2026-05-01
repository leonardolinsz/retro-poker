import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import type { RetroBoard } from '@focusscrum/shared';

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
          <button (click)="creating = true"
                  class="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 hover:-translate-y-0.5">
            + Novo Board
          </button>
        </div>
      </header>

      <main class="max-w-5xl mx-auto px-6 py-8">
        @if (creating) {
          <form (submit)="handleCreate($event)" class="mb-8 flex gap-3">
            <input [(ngModel)]="name" name="name" autofocus
                   placeholder="Nome da retrospectiva..."
                   class="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-500 transition" />
            <button type="submit" class="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition">
              Criar
            </button>
            <button type="button" (click)="creating = false"
                    class="rounded-xl px-4 py-3 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
              Cancelar
            </button>
          </form>
        }

        @if (boards.length === 0 && !creating) {
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
    </div>
  `,
})
export class MyBoardsComponent implements OnInit {
  boards: RetroBoard[] = [];
  creating = false;
  name = '';

  constructor(private router: Router) {}

  ngOnInit() {
    fetch('/api/boards', { credentials: 'include' })
      .then(r => r.json())
      .then(data => this.boards = data)
      .catch(() => {});
  }

  async handleCreate(e: Event) {
    e.preventDefault();
    if (!this.name.trim()) return;
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: this.name.trim() }),
    });
    if (res.ok) {
      const board = await res.json();
      this.router.navigate(['/retro', board.inviteCode]);
    }
  }

  getCardCount(board: RetroBoard): number {
    return board.columns.reduce((acc, c) => acc + c.cards.length, 0);
  }
}
